'use strict';

const mqtt = require('mqtt');

function connectMqtt(service, config) {
  const client = mqtt.connect(config.mqttUrl, {
    username: config.mqttUsername,
    password: config.mqttPassword,
    clientId: 'smartgarden-backend-' + process.pid,
    clean: true,
    reconnectPeriod: 3000,
    connectTimeout: 10000,
    queueQoSZero: false,
    resubscribe: false
  });
  service.transport = client;
  let sensorQueue = Promise.resolve();
  let queuedReadings = 0;
  let responseQueue = Promise.resolve();

  function wasSubscriptionRejected(topic) {
    return topic.qos === 128;
  }

  client.on('connect', function subscribeTopics() {
    client.subscribe([config.sensorTopic, config.responseTopic], { qos: 0 }, function onSubscribed(error, granted) {
      if (error || granted.some(wasSubscriptionRejected)) {
        console.error('MQTT: không đăng ký được topic; kiểm tra tài khoản và ACL.');
        return;
      }
      service.setBrokerConnected(true).catch(service.reportError.bind(service));
      console.log('MQTT đã kết nối và đăng ký topic cảm biến/phản hồi.');
    });
  });

  client.on('close', function markOffline() {
    service.setBrokerConnected(false).catch(service.reportError.bind(service));
  });

  client.on('error', function reportMqttError(error) {
    console.error('MQTT:', error.code || error.message);
  });

  client.on('message', function handleMqttMessage(topic, payload, packet) {
    // Không coi retained message cũ là phép đo mới hoặc xác nhận lệnh hiện tại.
    if (packet.retain || payload.length > 4096) {
      return;
    }
    if (topic === config.sensorTopic) {
      if (queuedReadings >= 20) {
        console.error('MQTT: bỏ gói cảm biến do hàng đợi lưu DB đã đầy.');
        return;
      }
      queuedReadings += 1;
      const receivedAt = new Date();
      sensorQueue = sensorQueue.then(async function storeSensorPacket() {
        try {
          await service.ingestSensors(JSON.parse(payload.toString('utf8')), receivedAt);
        } catch (error) {
          service.reportError(error);
        } finally {
          queuedReadings -= 1;
        }
      });
    }
    if (topic === config.responseTopic) {
      responseQueue = responseQueue.then(function processResponse() {
        return service.receiveResponse(payload.toString('utf8').trim());
      }).catch(service.reportError.bind(service));
    }
  });

  return client;
}

module.exports = { connectMqtt };
