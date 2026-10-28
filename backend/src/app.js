'use strict';

const express = require('express');
const helmet = require('helmet');
const { rateLimit } = require('express-rate-limit');
const path = require('node:path');
const { timingSafeEqual } = require('node:crypto');
const { HttpError, positiveInteger, listFilters } = require('./validation');
const { AuthService, publicUser } = require('./auth-service');

function createApp(repository, garden, config) {
  const app = express();
  const auth = new AuthService(repository, config);
  app.disable('x-powered-by');
  app.use(helmet({
    contentSecurityPolicy: { directives: {
      'script-src': ["'self'"],
      'style-src': ["'self'", "'unsafe-inline'"],
      'img-src': ["'self'", 'data:', 'blob:'],
      'connect-src': ["'self'"],
      'upgrade-insecure-requests': null
    } },
    strictTransportSecurity: false
  }));
  app.use(express.json({ limit: '600kb' }));
  app.use('/api', function preventApiCaching(request, response, next) {
    response.set('Cache-Control', 'no-store');
    next();
  });
  const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: 'draft-8', legacyHeaders: false, message: { success: false, error: 'Quá nhiều yêu cầu đăng nhập/đăng ký. Thử lại sau 15 phút.' } });
  const controlLimiter = rateLimit({ windowMs: 60000, limit: 30, standardHeaders: 'draft-8', legacyHeaders: false, message: { success: false, error: 'Gửi lệnh quá nhanh. Vui lòng chờ.' } });
  const api = express.Router();
  app.use('/api/v1', api);

  function sendData(response, data, status = 200) {
    response.status(status).json({ success: true, data });
  }

  function requireInternalKey(request, response, next) {
    const supplied = Buffer.from(request.get('X-Internal-Key') || '');
    const expected = Buffer.from(config.internalKey);
    if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
      throw new HttpError(401, 'Cần khóa API nội bộ.');
    }
    next();
  }

  async function requireLogin(request, response, next) {
    const header = request.get('Authorization') || '';
    if (!header.startsWith('Bearer ')) {
      throw new HttpError(401, 'Vui lòng đăng nhập.');
    }
    request.user = await auth.verify(header.slice(7));
    next();
  }

  api.get('/health', async function health(request, response) {
    await repository.health();
    sendData(response, { database: 'connected', storage: config.storageDriver || 'mysql', mqtt: garden.brokerConnected });
  });

  api.post('/auth/register', authLimiter, async function register(request, response) {
    sendData(response, await auth.register(request.body), 201);
  });

  api.post('/auth/login', authLimiter, async function login(request, response) {
    sendData(response, await auth.login(request.body));
  });

  api.post('/auth/forgot', authLimiter, function forgotPassword() {
    throw new HttpError(501, 'Chưa cấu hình dịch vụ gửi email khôi phục mật khẩu. Liên hệ người quản trị.');
  });

  api.post('/sensors', requireInternalKey, async function ingestSensors(request, response) {
    sendData(response, await garden.ingestSensors(request.body), 201);
  });

  api.patch('/devices/status', requireInternalKey, async function confirmStatus(request, response) {
    const entries = garden.validateControl(request.body);
    let matched = false;
    for (const [key, action] of entries) {
      const accepted = await garden.receiveResponse(key + '_' + action + '_ok');
      if (accepted) {
        matched = true;
      }
    }
    if (!matched) {
      throw new HttpError(409, 'Không có lệnh đang chờ khớp với phản hồi.');
    }
    sendData(response, await garden.deviceSnapshot());
  });

  api.use(requireLogin);

  api.post('/auth/logout', async function logout(request, response) {
    await repository.invalidateTokens(request.user.id);
    garden.emit('revoke', request.user.id);
    sendData(response, { message: 'Đã đăng xuất tất cả phiên của tài khoản.' });
  });

  api.get('/users/me', function userProfile(request, response) {
    sendData(response, publicUser(request.user));
  });

  api.put('/profile', async function updateProfile(request, response) {
    sendData(response, await auth.updateProfile(request.user, request.body));
  });

  api.patch('/profile/password', async function changePassword(request, response) {
    await auth.changePassword(request.user, request.body);
    garden.emit('revoke', request.user.id);
    sendData(response, { message: 'Đã đổi mật khẩu. Vui lòng đăng nhập lại.' });
  });

  api.get('/sensors/latest', async function latestSensors(request, response) {
    const limit = positiveInteger(request.query.limit, 15, 100);
    sendData(response, await repository.latestReadings(limit));
  });

  api.get('/sensors', async function listSensors(request, response) {
    sendData(response, await repository.listReadings(listFilters(request.query, 'sensors')));
  });

  api.get('/devices', async function listDevices(request, response) {
    sendData(response, await garden.deviceSnapshot());
  });

  api.post('/devices/control', controlLimiter, async function controlDevices(request, response) {
    const commands = await garden.control(request.body, request.user);
    let status = 200;
    const last = commands.at(-1);
    if (last.result === 'timeout') {
      status = 504;
    } else if (last.result !== 'success') {
      status = 503;
    }
    response.status(status).json({ success: status === 200, data: commands, error: last.reason });
  });

  api.get('/actions', async function listActions(request, response) {
    sendData(response, await repository.listCommands(listFilters(request.query, 'actions')));
  });

  const root = path.resolve(__dirname, '../..');
  for (const directory of ['js', 'css', 'assets']) {
    app.use('/' + directory, express.static(path.join(root, directory), { dotfiles: 'deny' }));
  }
  app.get('/', function serveFrontend(request, response) {
    response.sendFile(path.join(root, 'index.html'));
  });
  app.use(function notFound(request, response) {
    response.status(404).json({ success: false, error: 'Không tìm thấy đường dẫn.' });
  });
  app.use(function handleError(error, request, response, next) {
    if (response.headersSent) {
      return next(error);
    }
    let status = error.status || 500;
    let message = error.message;
    if (status >= 500 && !(error instanceof HttpError)) {
      status = 503;
      message = 'Dịch vụ chưa sẵn sàng. Kiểm tra bộ lưu trữ và nhật ký backend.';
      console.error('API:', error.code || error.message);
    }
    if (error.type === 'entity.parse.failed') {
      message = 'JSON không hợp lệ.';
    }
    response.status(status).json({ success: false, error: message });
  });
  return { app, auth };
}

module.exports = { createApp };
