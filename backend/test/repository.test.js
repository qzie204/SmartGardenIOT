'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Repository } = require('../src/repository');
const { sensorValues, listFilters } = require('../src/validation');

test('Một cảm biến lỗi phải rollback cả ba bản ghi và trả connection', async function transactionRollback() {
  const calls = [];
  const connection = {
    async beginTransaction() { calls.push('begin'); },
    async execute(sql, values) {
      calls.push(values[0]);
      if (values[0] === 2) {
        throw new Error('DB write failed');
      }
      return [{ insertId: 1 }];
    },
    async commit() { calls.push('commit'); },
    async rollback() { calls.push('rollback'); },
    release() { calls.push('release'); }
  };
  const repository = new Repository({ async getConnection() { return connection; } });
  await assert.rejects(repository.insertReadings({ temperature: 20, humidity: 60, light: 1 }, new Date()), /DB write failed/);
  assert.deepEqual(calls, ['begin', 1, 2, 'rollback', 'release']);
});

test('Bộ lọc thời gian +07 và input không hợp lệ', function validation() {
  assert.throws(function invalidLight() { sensorValues({ temperature: 20, humidity: 50, light: '1' }); });
  assert.throws(function invalidHumidity() { sensorValues({ temperature: 20, humidity: 101, light: 1 }); });
  assert.throws(function invalidTimeRange() { listFilters({ from: '2026-10-29 00:00:00', to: '2026-10-28 00:00:00' }, 'sensors'); });
  const filters = listFilters({ from: '2026-10-28 07:00:00' }, 'sensors');
  assert.equal(filters.from.toISOString(), '2026-10-28T00:00:00.000Z');
});
