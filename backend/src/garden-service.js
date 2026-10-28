'use strict';

const { EventEmitter } = require('node:events');
const { HttpError, sensorValues, requireObject } = require('./validation');
const DEVICE_KEYS = { led1: 'pump', led2: 'light' };

class GardenService extends EventEmitter {
  constructor(repository, config) {
    super();
    this.repository = repository;
    this.config = config;
    this.transport = null;
    this.brokerConnected = false;
    this.lastSensorAt = 0;
    this.busy = false;
    this.pending = null;
    this.storageHealthy = true;
    this.closed = false;
    this.clock = setInterval(() => {
      this.emit('status', this.status());
    }, 2000);
    this.clock.unref();
  }

  status() {
    const recentlySeen = this.lastSensorAt > 0 && Date.now() - this.lastSensorAt < this.config.deviceOfflineMs;
    return {
      online: this.brokerConnected && recentlySeen && this.storageHealthy && !this.closed,
      brokerConnected: this.brokerConnected,
      lastSensorAt: this.lastSensorAt,
      busy: this.busy,
      lightUnit: 'DO',
      sensorIntervalMs: 2000
    };
  }

  async setBrokerConnected(connected) {
    this.brokerConnected = connected;
    if (!connected) {
      this.lastSensorAt = 0;
      await this.finishPending('failed', 'Mất kết nối MQTT; chưa xác định trạng thái thực của thiết bị.');
    }
    this.emit('status', this.status());
  }

  async ingestSensors(body, measuredAt = new Date()) {
    const values = sensorValues(body);
    const readings = await this.repository.insertReadings(values, measuredAt);
    this.lastSensorAt = measuredAt.getTime();
    this.emit('sensors', readings);
    this.emit('status', this.status());
    return readings;
  }

  async deviceSnapshot() {
    const devices = await this.repository.devices();
    for (const device of devices) {
      device.pending = false;
      if (this.pending && this.pending.command.device === device.device_key) {
        device.pending = true;
      }
    }
    return { devices, status: this.status() };
  }

  validateControl(body) {
    requireObject(body);
    const entries = Object.entries(body);
    if (entries.length < 1 || entries.length > 2) {
      throw new HttpError(400, 'Gửi led1 và/hoặc led2 với giá trị on hoặc off.');
    }
    for (const [key, action] of entries) {
      if (!Object.hasOwn(DEVICE_KEYS, key)) {
        throw new HttpError(404, 'Không tìm thấy thiết bị.');
      }
      if (action !== 'on' && action !== 'off') {
        throw new HttpError(400, 'Lệnh điều khiển chỉ nhận on hoặc off.');
      }
    }
    return entries;
  }

  async control(body, user) {
    const entries = this.validateControl(body);
    if (this.busy) {
      throw new HttpError(409, 'Đang chờ xác nhận lệnh trước.');
    }
    if (!this.status().online || !this.transport) {
      throw new HttpError(503, 'ESP8266/MQTT chưa kết nối hoặc chưa gửi dữ liệu cảm biến.');
    }
    // Giữ khóa trước await để hai HTTP request không gửi lệnh chồng nhau.
    this.busy = true;
    this.emit('status', this.status());
    const commands = [];
    try {
      for (const [key, action] of entries) {
        const command = await this.sendOne(key, action, user);
        commands.push(command);
        if (command.result !== 'success') {
          break;
        }
      }
      return commands;
    } finally {
      this.busy = false;
      this.emit('status', this.status());
    }
  }

  async sendOne(key, action, user) {
    const command = await this.repository.createCommand(DEVICE_KEYS[key], action, user);
    this.emit('command', command);
    return new Promise((resolve, reject) => {
      const pending = {
        command,
        expectedResponse: key + '_' + action + '_ok',
        resolve,
        reject,
        finishing: false,
        timer: null
      };
      this.pending = pending;
      pending.timer = setTimeout(() => {
        this.finishPending('timeout', 'Hết thời gian chờ phản hồi ESP8266; trạng thái thực chưa xác định.').catch(this.reportError.bind(this));
      }, this.config.commandTimeoutMs);
      if (!this.status().online) {
        this.finishPending('failed', 'Thiết bị mất kết nối trước khi gửi lệnh.').catch(this.reportError.bind(this));
        return;
      }
      try {
        this.transport.publish(this.config.controlTopic, key + '_' + action, { qos: 0, retain: false }, error => {
          if (error && this.pending === pending) {
            this.finishPending('failed', 'Không gửi được lệnh qua MQTT.').catch(this.reportError.bind(this));
          }
        });
      } catch (_) {
        this.finishPending('failed', 'Không gửi được lệnh qua MQTT.').catch(this.reportError.bind(this));
      }
    });
  }

  async receiveResponse(message) {
    if (message === 'ESP8266 da ket noi MQTT') {
      await this.finishPending('failed', 'ESP8266 kết nối lại trong khi chờ lệnh.');
      await this.repository.invalidateDeviceStatus();
      this.emit('devices', await this.deviceSnapshot());
      return false;
    }
    if (!this.pending || this.pending.expectedResponse !== message) {
      return false;
    }
    await this.finishPending('success', null);
    return true;
  }

  async finishPending(result, reason) {
    const pending = this.pending;
    if (!pending || pending.finishing) {
      return;
    }
    pending.finishing = true;
    clearTimeout(pending.timer);
    try {
      const command = await this.repository.finishCommand(pending.command, result, reason);
      this.pending = null;
      this.emit('command', command);
      this.emit('devices', await this.deviceSnapshot());
      pending.resolve(command);
    } catch (error) {
      this.pending = null;
      this.storageHealthy = false;
      pending.reject(new HttpError(503, 'Không lưu được kết quả điều khiển; cần kiểm tra bộ lưu trữ và khởi động lại backend.'));
      this.reportError(error);
    }
  }

  reportError(error) {
    console.error('Garden:', error.code || error.message);
  }

  async close() {
    this.closed = true;
    clearInterval(this.clock);
    await this.finishPending('failed', 'Backend đang dừng; trạng thái thiết bị chưa xác định.');
  }
}

module.exports = { GardenService };
