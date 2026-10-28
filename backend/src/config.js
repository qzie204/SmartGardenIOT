'use strict';

require('dotenv').config({ quiet: true });
const path = require('node:path');

function readInteger(name, fallback, minimum, maximum) {
  let value = fallback;
  if (process.env[name] !== undefined) {
    value = Number(process.env[name]);
  }
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new Error(name + ' phải là số nguyên từ ' + minimum + ' đến ' + maximum + '.');
  }
  return value;
}

function readSecret(name) {
  const value = process.env[name];
  if (!value || value.length < 32 || value.startsWith('replace_')) {
    throw new Error('Hãy cấu hình ' + name + ' trong .env (chuỗi ngẫu nhiên ít nhất 32 ký tự).');
  }
  return value;
}

function databaseConfig() {
  return {
    host: process.env.DB_HOST || '127.0.0.1',
    port: readInteger('DB_PORT', 3306, 1, 65535),
    database: process.env.DB_NAME || 'smart_garden',
    user: process.env.DB_USER || 'smartgarden',
    password: process.env.DB_PASSWORD || '',
    timezone: 'Z',
    decimalNumbers: true,
    connectionLimit: 10
  };
}

function loadConfig() {
  const storageDriver = process.env.STORAGE_DRIVER || 'mysql';
  if (!['mysql', 'sqlite'].includes(storageDriver)) {
    throw new Error('STORAGE_DRIVER chỉ nhận mysql hoặc sqlite.');
  }
  return {
    storageDriver,
    sqliteFile: path.resolve(__dirname, '../..', process.env.SQLITE_FILE || 'data/smart-garden.sqlite'),
    host: process.env.HOST || '127.0.0.1',
    port: readInteger('PORT', 8080, 1, 65535),
    database: databaseConfig(),
    jwtSecret: readSecret('JWT_SECRET'),
    internalKey: readSecret('INTERNAL_API_KEY'),
    allowRegistration: process.env.ALLOW_REGISTRATION === 'true',
    mqttUrl: process.env.MQTT_URL || 'mqtt://127.0.0.1:1884',
    mqttUsername: process.env.MQTT_USERNAME || '',
    mqttPassword: process.env.MQTT_PASSWORD || '',
    sensorTopic: process.env.MQTT_SENSOR_TOPIC || 'Qzie204/garden/data/sensors',
    controlTopic: process.env.MQTT_CONTROL_TOPIC || 'Qzie204/garden/device/control',
    responseTopic: process.env.MQTT_RESPONSE_TOPIC || 'Qzie204/garden/device/response',
    commandTimeoutMs: readInteger('COMMAND_TIMEOUT_MS', 10000, 1000, 60000),
    deviceOfflineMs: readInteger('DEVICE_OFFLINE_MS', 15000, 5000, 120000)
  };
}

module.exports = { loadConfig, databaseConfig };
