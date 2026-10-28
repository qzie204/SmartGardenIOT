'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { GardenService } = require('../src/garden-service');
const { MemoryRepository, waitFor } = require('./fixture');

function setup(t) {
  const repository = new MemoryRepository();
  const garden = new GardenService(repository, { deviceOfflineMs: 15000, commandTimeoutMs: 100, controlTopic: 'isolated/control' });
  garden.brokerConnected = true;
  garden.lastSensorAt = Date.now();
  garden.transport = { publish(topic, message, options, callback) { callback(null); } };
  t.after(async function cleanup() { await garden.close(); });
  return { repository, garden };
}

test('Broker disconnect kết thúc pending và khóa yêu cầu khi offline', async function disconnect(t) {
  const { garden, repository } = setup(t);
  const operation = garden.control({ led2: 'on' }, { id: 1, username: 'student' });
  await waitFor(function waiting() { return Boolean(garden.pending); });
  await garden.setBrokerConnected(false);
  const results = await operation;
  assert.equal(results[0].result, 'failed');
  assert.equal(repository.deviceRows[1].current_status, null);
  assert.equal(garden.busy, false);
  await assert.rejects(garden.control({ led1: 'on' }, { id: 1 }), { status: 503 });
});

test('Không publish nếu ghi pending thất bại', async function failedInsert(t) {
  const { garden, repository } = setup(t);
  let published = false;
  garden.transport.publish = function recordPublish() { published = true; };
  repository.createCommand = async function failInsert() { throw new Error('DB unavailable'); };
  await assert.rejects(garden.control({ led1: 'on' }, { id: 1 }), /DB unavailable/);
  assert.equal(published, false);
  assert.equal(garden.busy, false);
});

test('Không phát success khi transaction lưu ACK thất bại', async function failedAcknowledgment(t) {
  const { garden, repository } = setup(t);
  const events = [];
  garden.on('command', function record(command) { events.push({ ...command }); });
  garden.reportError = function expectedFailure() {};
  repository.finishCommand = async function failTransaction() { throw new Error('DB unavailable'); };
  const operation = garden.control({ led1: 'on' }, { id: 1, username: 'student' });
  const rejected = assert.rejects(operation, { status: 503 });
  await waitFor(function waiting() { return Boolean(garden.pending); });
  await garden.receiveResponse('led1_on_ok');
  await rejected;
  assert.equal(events.length, 1);
  assert.equal(events[0].result, 'pending');
  assert.equal(garden.status().online, false);
});

test('Publish ném lỗi vẫn lưu failed và dọn timeout', async function publishThrows(t) {
  const { garden } = setup(t);
  garden.transport.publish = function failPublish() { throw new Error('Connection lost'); };
  const result = await garden.control({ led1: 'on' }, { id: 1, username: 'student' });
  assert.equal(result[0].result, 'failed');
  assert.equal(garden.pending, null);
  assert.equal(garden.busy, false);
});

test('Giá trị ánh sáng null không được lưu thành số 0', async function invalidSensor(t) {
  const { garden, repository } = setup(t);
  await assert.rejects(garden.ingestSensors({ temperature: 20, humidity: 60, light: null }), { status: 400 });
  assert.equal(repository.readings.length, 0);
});
