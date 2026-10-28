'use strict';

// Chỉ dùng trong test; server.js dùng repository MySQL hoặc SQLite thực.
const http = require('node:http');
const net = require('node:net');
const { once } = require('node:events');
const mqtt = require('mqtt');
const { GardenService } = require('../src/garden-service');
const { createApp } = require('../src/app');
const { connectMqtt } = require('../src/mqtt-bridge');
const { attachWebSocket } = require('../src/websocket');

class MemoryRepository {
  constructor() {
    this.users = [];
    this.readings = [];
    this.commands = [];
    this.deviceRows = [
      { id: 1, name: 'Máy bơm nước', device_key: 'pump', mqtt_topic: 'led1', current_status: null },
      { id: 2, name: 'Đèn', device_key: 'light', mqtt_topic: 'led2', current_status: null }
    ];
  }

  async health() {}

  async findUser(username) {
    return this.users.find(function match(user) { return user.username === username; });
  }

  async userById(id) {
    return this.users.find(function match(user) { return user.id === id; });
  }

  async createUser(username, passwordHash, name, email) {
    if (await this.findUser(username)) {
      const error = new Error('Duplicate');
      error.code = 'ER_DUP_ENTRY';
      throw error;
    }
    const user = { id: this.users.length + 1, username, passwordHash, tokenVersion: 0, profile: { name, email } };
    this.users.push(user);
    return user;
  }

  async invalidateTokens(id) {
    const user = await this.userById(id);
    user.tokenVersion += 1;
  }

  async changePassword(id, hash) {
    const user = await this.userById(id);
    user.passwordHash = hash;
    user.tokenVersion += 1;
  }

  async saveProfile(id, profile) {
    const user = await this.userById(id);
    Object.assign(user.profile, profile);
    return user;
  }

  async insertReadings(values, date) {
    const batch = [];
    for (const [type, value] of Object.entries(values)) {
      const row = { id: this.readings.length + 1, type, value, ts: date.getTime(), measured_at: date.toISOString() };
      this.readings.push(row);
      batch.push(row);
    }
    return batch;
  }

  async latestReadings(limit) {
    return this.readings.slice().reverse().slice(0, limit * 3);
  }

  page(rows, filters) {
    if (filters.sort !== 'asc') {
      rows.reverse();
    }
    const totalPages = Math.max(1, Math.ceil(rows.length / filters.limit));
    const page = Math.min(filters.page, totalPages);
    return { items: rows.slice((page - 1) * filters.limit, page * filters.limit), pagination: { total: rows.length, page, limit: filters.limit, total_pages: totalPages } };
  }

  async listReadings(filters) {
    let rows = this.readings.slice();
    if (filters.type !== 'all') {
      rows = rows.filter(function match(row) { return row.type === filters.type; });
    }
    if (filters.q && filters.by !== 'time') {
      rows = rows.filter(function match(row) { return row.type === filters.by && String(row.value).includes(filters.q); });
    }
    return this.page(rows, filters);
  }

  async devices() {
    return structuredClone(this.deviceRows);
  }

  async invalidateDeviceStatus() {
    this.deviceRows.forEach(function clear(row) { row.current_status = null; });
  }

  async createCommand(device, action, user) {
    const command = { id: this.commands.length + 1, device, action, user: user.username, result: 'pending', sentAt: Date.now(), respondedAt: null, reason: null };
    this.commands.push(command);
    return command;
  }

  async finishCommand(command, result, reason) {
    let respondedAt = null;
    const device = this.deviceRows.find(function match(row) { return row.device_key === command.device; });
    device.current_status = null;
    if (result === 'success') {
      respondedAt = Date.now();
      device.current_status = command.action;
    }
    Object.assign(command, { result, reason, respondedAt });
    return { ...command };
  }

  async listCommands(filters) {
    const rows = this.commands.filter(function match(row) {
      return (!filters.device || filters.device === 'all' || row.device === filters.device) && (!filters.result || row.result === filters.result) && (!filters.action || row.action === filters.action);
    });
    return this.page(rows, filters);
  }
}

async function waitFor(predicate, timeout = 3000) {
  const end = Date.now() + timeout;
  while (!predicate()) {
    if (Date.now() >= end) {
      throw new Error('Test timed out');
    }
    await new Promise(function pause(resolve) { setTimeout(resolve, 10); });
  }
}

async function createFixture(options = {}) {
  const { Aedes } = await import('aedes');
  const broker = await Aedes.createBroker();
  const tcp = net.createServer(broker.handle);
  tcp.listen(0, '127.0.0.1');
  await once(tcp, 'listening');
  const config = {
    jwtSecret: 'isolated-test-secret-do-not-use-in-production',
    internalKey: 'isolated-test-internal-key-do-not-use-in-production',
    allowRegistration: true,
    mqttUrl: 'mqtt://127.0.0.1:' + tcp.address().port,
    sensorTopic: 'test/sensors', controlTopic: 'test/control', responseTopic: 'test/response',
    commandTimeoutMs: 300, deviceOfflineMs: 15000
  };
  let repository = options.repository;
  if (!repository) {
    repository = new MemoryRepository();
  }
  if (options.storageDriver) {
    config.storageDriver = options.storageDriver;
  }
  const garden = new GardenService(repository, config);
  const { app, auth } = createApp(repository, garden, config);
  const server = http.createServer(app);
  const closeWebSocket = attachWebSocket(server, auth, garden);
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const bridge = connectMqtt(garden, config);
  const hardware = mqtt.connect(config.mqttUrl, { reconnectPeriod: 0 });
  await once(hardware, 'connect');
  await hardware.subscribeAsync(config.controlTopic);
  await waitFor(function ready() { return garden.brokerConnected; });
  const base = 'http://127.0.0.1:' + server.address().port;
  return {
    base, repository, garden, config, hardware, bridge,
    async close() {
      await garden.close();
      closeWebSocket();
      await hardware.endAsync(true);
      await bridge.endAsync(true);
      await new Promise(function stop(resolve) { server.close(resolve); });
      await new Promise(function stop(resolve) { broker.close(resolve); });
      await new Promise(function stop(resolve) { tcp.close(resolve); });
    }
  };
}

module.exports = { createFixture, waitFor, MemoryRepository };
