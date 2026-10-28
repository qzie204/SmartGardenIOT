'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const { WebSocket } = require('ws');
const { createFixture, waitFor } = require('./fixture');

test('REST, JWT, MQTT và WebSocket qua broker riêng trên loopback', { timeout: 20000 }, async function integration(t) {
  const fixture = await createFixture();
  t.after(async function cleanup() { await fixture.close(); });
  const { base, repository, garden, config, hardware } = fixture;
  let token = '';

  async function call(path, method = 'GET', body, headers = {}) {
    const options = { method, headers: { 'Content-Type': 'application/json', ...headers } };
    if (token) {
      options.headers.Authorization = 'Bearer ' + token;
    }
    if (body !== undefined) {
      options.body = JSON.stringify(body);
    }
    const response = await fetch(base + '/api/v1' + path, options);
    return { status: response.status, body: await response.json() };
  }

  await t.test('Bảo vệ API, đăng ký, mật khẩu hash, đăng nhập', async function authentication() {
    assert.equal((await call('/sensors/latest')).status, 401);
    assert.equal((await call('/auth/register', 'POST', { username: 'student', password: '123' })).status, 400);
    const body = { username: 'student', password: 'garden-test-123', name: 'Sinh viên', email: 'test@example.com' };
    assert.equal((await call('/auth/register', 'POST', body)).status, 201);
    assert.equal((await call('/auth/register', 'POST', body)).status, 409);
    assert.notEqual(repository.users[0].passwordHash, body.password);
    assert.equal((await call('/auth/login', 'POST', { ...body, password: 'wrong' })).status, 401);
    const login = await call('/auth/login', 'POST', body);
    assert.equal(login.status, 200);
    token = login.body.data.token;
    assert.equal(login.body.data.user.passwordHash, undefined);
    assert.equal((await call('/devices/control', 'POST', { led1: 'on' })).status, 503);
  });

  const socket = new WebSocket(base.replace('http:', 'ws:') + '/ws');
  const events = [];
  socket.on('message', function collect(data) { events.push(JSON.parse(data.toString())); });
  await once(socket, 'open');
  socket.send(JSON.stringify({ type: 'auth', token }));
  await waitFor(function authenticated() { return events.some(function ready(event) { return event.type === 'ready'; }); });

  await t.test('MQTT lưu ba chỉ số cùng thời điểm rồi phát WebSocket; bỏ gói sai/retained', async function sensors() {
    fixture.bridge.emit('message', config.sensorTopic, Buffer.from('{"temperature":27,"humidity":65,"light":1}'), { retain: true });
    assert.equal(repository.readings.length, 0);
    await hardware.publishAsync(config.sensorTopic, JSON.stringify({ temperature: 27.5, humidity: 65, light: 1 }));
    await waitFor(function saved() { return repository.readings.length === 3; });
    await waitFor(function pushed() { return events.some(function found(event) { return event.type === 'sensors'; }); });
    assert.equal(new Set(repository.readings.map(function time(row) { return row.ts; })).size, 1);
    await hardware.publishAsync(config.sensorTopic, JSON.stringify({ temperature: 27, humidity: 65, light: 999 }));
    await hardware.publishAsync(config.sensorTopic, '{broken-json');
    await waitFor(function online() { return garden.status().online; });
    const latest = await call('/sensors/latest?limit=15');
    assert.equal(latest.body.data.length, 3);
    assert.equal((await call('/sensors?limit=-1')).status, 400);
    assert.equal((await call('/sensors?sort=drop')).status, 400);
    assert.equal((await call('/sensors', 'POST', { temp: 20, humid: 30, light: 0 })).status, 401);
    assert.equal((await call('/sensors', 'POST', { temp: 20, humid: 30, light: 0 }, { 'X-Internal-Key': config.internalKey })).status, 201);
    const page = await call('/sensors?type=temperature&limit=1&page=2&sort=asc');
    assert.equal(page.body.data.pagination.total, 2);
    assert.equal(page.body.data.items[0].value, 20);
  });

  await t.test('Chờ đúng ACK mới bật, chặn lệnh đồng thời, lưu người thao tác', async function successfulCommand() {
    const pending = call('/devices/control', 'POST', { led1: 'on' });
    await waitFor(function waiting() { return Boolean(garden.pending); });
    assert.equal(repository.commands[0].result, 'pending');
    assert.equal(repository.deviceRows[0].current_status, null);
    assert.equal((await call('/devices/control', 'POST', { led2: 'on' })).status, 409);
    await hardware.publishAsync(config.responseTopic, 'led2_on_ok');
    assert.equal(repository.commands[0].result, 'pending');
    await hardware.publishAsync(config.responseTopic, 'led1_on_ok');
    const result = await pending;
    assert.equal(result.status, 200);
    assert.equal(result.body.data[0].result, 'success');
    assert.equal(repository.deviceRows[0].current_status, 'on');
    assert.equal(repository.commands[0].user, 'student');
  });

  await t.test('Timeout, ACK muộn không sửa lệnh; kiểm tra toàn bộ body trước khi gửi', async function timeout() {
    const result = await call('/devices/control', 'POST', { led1: 'off' });
    assert.equal(result.status, 504);
    assert.equal(result.body.data[0].result, 'timeout');
    assert.equal(repository.deviceRows[0].current_status, null);
    assert.equal(await garden.receiveResponse('led1_off_ok'), false);
    const count = repository.commands.length;
    assert.equal((await call('/devices/control', 'POST', { led1: 'on', bad: 'on' })).status, 404);
    assert.equal(repository.commands.length, count);
    const history = await call('/actions?result=timeout');
    assert.equal(history.body.data.pagination.total, 1);
  });

  await t.test('Lưu hồ sơ, chặn URL nguy hiểm, từ chối giả vờ gửi email', async function profile() {
    assert.equal((await call('/profile', 'PUT', { full_name: 'Tên đã sửa', student_id: 'B23' })).status, 200);
    assert.equal((await call('/users/me')).body.data.profile.name, 'Tên đã sửa');
    assert.equal((await call('/profile', 'PUT', { github: 'javascript:alert(1)' })).status, 400);
    assert.equal((await call('/auth/forgot', 'POST', { account: 'student' })).status, 501);
    assert.equal((await fetch(base + '/.env')).status, 404);
    assert.equal((await fetch(base + '/backend/src/config.js')).status, 404);
  });

  await t.test('Đăng xuất thu hồi JWT và đóng WebSocket', async function logout() {
    const closed = once(socket, 'close');
    assert.equal((await call('/auth/logout', 'POST')).status, 200);
    const [code] = await closed;
    assert.equal(code, 4401);
    assert.equal((await call('/users/me')).status, 401);
  });

  await t.test('Đổi mật khẩu thu hồi token cũ và đăng nhập được mật khẩu mới', async function passwordChange() {
    const login = await call('/auth/login', 'POST', { username: 'student', password: 'garden-test-123' });
    token = login.body.data.token;
    assert.equal((await call('/profile/password', 'PATCH', { old_password: 'wrong', new_password: 'new-garden-123' })).status, 400);
    assert.equal((await call('/profile/password', 'PATCH', { old_password: 'garden-test-123', new_password: 'new-garden-123' })).status, 200);
    assert.equal((await call('/users/me')).status, 401);
    assert.equal((await call('/auth/login', 'POST', { username: 'student', password: 'garden-test-123' })).status, 401);
    assert.equal((await call('/auth/login', 'POST', { username: 'student', password: 'new-garden-123' })).status, 200);
  });
});
