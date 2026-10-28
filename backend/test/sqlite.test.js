'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { SqliteRepository } = require('../src/sqlite-repository');
const { listFilters } = require('../src/validation');
const { createFixture, waitFor } = require('./fixture');

async function temporaryDatabase(t) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'smartgarden-sqlite-test-'));
  const filename = path.join(directory, 'garden.sqlite');
  t.after(async function removeTestFiles() {
    // mkdtemp tạo thư mục riêng cho test, không dùng đường dẫn database thật.
    await fs.rm(directory, { recursive: true, force: true });
  });
  return filename;
}

test('SQLite lưu bền, lọc và phân trang bằng SQL, khôi phục pending sau restart', async function persistence(t) {
  const filename = await temporaryDatabase(t);
  let repository = new SqliteRepository(filename);
  try {
    const user = await repository.createUser('student', 'hash-for-storage-test', 'Tên gốc', 'test@example.com');
    await assert.rejects(repository.createUser('STUDENT', 'other', '', ''), { code: 'ER_DUP_ENTRY' });
    await repository.saveProfile(user.id, { name: 'Tên đã lưu', studentId: 'B23' });
    const first = new Date('2026-10-28T00:00:00Z');
    const second = new Date('2026-10-28T00:00:02Z');
    await repository.insertReadings({ temperature: 27.4, humidity: 65, light: 0 }, first);
    await repository.insertReadings({ temperature: 28.6, humidity: 67, light: 1 }, second);
    let page = await repository.listReadings(listFilters({ page: '2', limit: '2', sort: 'asc' }, 'sensors'));
    assert.equal(page.pagination.total, 6);
    assert.deepEqual(page.items.map(function id(row) { return row.id; }), [3, 4]);
    page = await repository.listReadings(listFilters({ by: 'time', q: '28/10/26 07:00:02' }, 'sensors'));
    assert.equal(page.pagination.total, 3);
    page = await repository.listReadings(listFilters({ by: 'time', q: '28/10/2026 07:00:00' }, 'sensors'));
    assert.equal(page.pagination.total, 3);
    page = await repository.listReadings(listFilters({ type: 'temperature', from: '2026-10-28 07:00:01', to: '2026-10-28 07:00:02' }, 'sensors'));
    assert.equal(page.items[0].value, 28.6);
    page = await repository.listReadings(listFilters({ by: 'temperature', q: '27,4' }, 'sensors'));
    assert.equal(page.pagination.total, 1);
    page = await repository.listReadings(listFilters({ by: 'temperature', q: "' OR 1=1 --" }, 'sensors'));
    assert.equal(page.pagination.total, 0);
    const command = await repository.createCommand('pump', 'on', user);
    await repository.finishCommand(command, 'success', null);
    await assert.rejects(repository.finishCommand(command, 'timeout', 'late'));
    assert.equal((await repository.devices())[0].current_status, 'on');
    await repository.createCommand('light', 'on', user);
    await repository.invalidateTokens(user.id);
    repository.close();

    repository = new SqliteRepository(filename);
    assert.equal((await repository.findUser('student')).profile.name, 'Tên đã lưu');
    assert.equal((await repository.findUser('student')).tokenVersion, 1);
    assert.equal((await repository.latestReadings(15)).length, 6);
    await repository.recoverPending();
    const history = await repository.listCommands(listFilters({ result: 'timeout', device: 'led2' }, 'actions'));
    assert.equal(history.pagination.total, 1);
    assert.equal((await repository.devices())[0].current_status, null);
  } finally {
    repository.close();
  }
});

test('SQLite rollback cả batch và giữ khóa một backend cho mỗi file', async function rollbackAndLock(t) {
  const filename = await temporaryDatabase(t);
  const repository = new SqliteRepository(filename);
  try {
    assert.throws(function duplicateBackend() { new SqliteRepository(filename); }, /backend khác/);
    await assert.rejects(repository.insertReadings({ temperature: 25, humidity: null, light: 1 }, new Date()));
    assert.equal((await repository.latestReadings(15)).length, 0);
  } finally {
    repository.close();
  }
  const reopened = new SqliteRepository(filename);
  reopened.close();
});

test('SQLite thật + REST đăng nhập + MQTT thật trên broker thử nghiệm', { timeout: 20000 }, async function sqliteEndToEnd(t) {
  const filename = await temporaryDatabase(t);
  const repository = new SqliteRepository(filename);
  let fixture;
  try {
    fixture = await createFixture({ repository, storageDriver: 'sqlite' });
    const { base, hardware, config, garden } = fixture;
    const registration = await fetch(base + '/api/v1/auth/register', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'sqliteuser', password: 'sqlite-test-123', name: 'SQLite' })
    });
    assert.equal(registration.status, 201);
    const login = await fetch(base + '/api/v1/auth/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'sqliteuser', password: 'sqlite-test-123' })
    });
    assert.equal(login.status, 200);
    const token = (await login.json()).data.token;
    await hardware.publishAsync(config.sensorTopic, JSON.stringify({ temperature: 26.5, humidity: 70, light: 1 }));
    await waitFor(function online() { return garden.status().online; });
    const response = await fetch(base + '/api/v1/sensors/latest', { headers: { Authorization: 'Bearer ' + token } });
    assert.equal((await response.json()).data.length, 3);
    hardware.on('message', function acknowledge(topic, payload) {
      if (topic === config.controlTopic) {
        hardware.publish(config.responseTopic, payload.toString() + '_ok');
      }
    });
    const control = await fetch(base + '/api/v1/devices/control', {
      method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ led1: 'on' })
    });
    assert.equal(control.status, 200);
    assert.equal((await repository.devices())[0].current_status, 'on');
    const health = await fetch(base + '/api/v1/health');
    assert.equal((await health.json()).data.storage, 'sqlite');
    assert.equal((await fetch(base + '/data/smart-garden.sqlite')).status, 404);
  } finally {
    if (fixture) {
      await fixture.close();
    }
    repository.close();
  }
});
