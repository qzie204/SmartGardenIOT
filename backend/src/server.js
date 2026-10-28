'use strict';

const http = require('node:http');
const { loadConfig } = require('./config');
const { createStorage } = require('./storage');
const { GardenService } = require('./garden-service');
const { createApp } = require('./app');
const { attachWebSocket } = require('./websocket');
const { connectMqtt } = require('./mqtt-bridge');

async function startServer() {
  const config = loadConfig();
  let storage;
  let garden;
  let server;
  let closeWebSocket;
  let mqtt;
  let stopping = false;

  function handleConnectionLost() {
    console.error('Mất kết nối giữ khóa điều khiển. Backend sẽ dừng.');
    stop().catch(function reportStopFailure() {
      process.exitCode = 1;
    });
  }

  try {
    storage = await createStorage(config, handleConnectionLost);
    await storage.repository.recoverPending();
    garden = new GardenService(storage.repository, config);
    const { app, auth } = createApp(storage.repository, garden, config);
    server = http.createServer(app);
    closeWebSocket = attachWebSocket(server, auth, garden);
    mqtt = connectMqtt(garden, config);
  } catch (error) {
    if (garden) {
      await garden.close();
    }
    if (closeWebSocket) {
      closeWebSocket();
    }
    if (storage) {
      await storage.close();
    }
    throw error;
  }

  async function stop() {
    if (stopping) {
      return;
    }
    stopping = true;
    const forceExit = setTimeout(function forceShutdown() {
      process.exit(1);
    }, 10000);
    forceExit.unref();
    if (garden) {
      await garden.close();
    }
    if (closeWebSocket) {
      closeWebSocket();
    }
    if (mqtt) {
      await mqtt.endAsync(true);
    }
    if (server) {
      await new Promise(function closeHttp(resolve) {
        server.close(resolve);
      });
    }
    if (storage) {
      await storage.close();
    }
    clearTimeout(forceExit);
  }

  process.on('SIGINT', handleStopSignal);
  process.on('SIGTERM', handleStopSignal);

  function handleStopSignal() {
    stop().catch(function reportStopFailure(error) {
      console.error('Lỗi khi dừng backend:', error.code || error.message);
      process.exitCode = 1;
    });
  }
  server.on('error', function serverError(error) {
    console.error('HTTP:', error.code || error.message);
    stop().catch(function reportStopFailure() {
      process.exitCode = 1;
    });
    process.exitCode = 1;
  });
  server.listen(config.port, config.host, function listening() {
    console.log('Smart Garden: http://' + config.host + ':' + config.port);
    console.log('Lưu trữ: ' + storage.label);
    console.log('Đăng ký tài khoản trên giao diện. Không có tài khoản demo mặc định.');
  });
}

startServer().catch(function startupError(error) {
  console.error('Không khởi động được backend:', error.code || error.message);
  console.error('Xem docs/SETUP.md; có thể dùng STORAGE_DRIVER=sqlite để chạy không cần MySQL.');
  process.exitCode = 1;
});
