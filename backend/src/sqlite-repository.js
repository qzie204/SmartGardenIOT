'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

function mapUser(row) {
  if (!row) {
    return null;
  }
  return {
    id: row.id,
    username: row.username,
    passwordHash: row.password_hash,
    tokenVersion: row.token_version,
    profile: JSON.parse(row.profile_json)
  };
}

function mapReading(row) {
  return {
    id: row.id,
    type: row.type,
    value: row.value,
    ts: row.measured_at,
    measured_at: new Date(row.measured_at).toISOString()
  };
}

function mapCommand(row) {
  return {
    id: row.id,
    device: row.device_key,
    action: row.action,
    result: row.result,
    user: row.username,
    sentAt: row.created_at,
    respondedAt: row.responded_at,
    reason: row.reason
  };
}

function addDateFilters(filters, column, conditions, parameters) {
  if (filters.from) {
    conditions.push(column + ' >= ?');
    parameters.push(filters.from.getTime());
  }
  if (filters.to) {
    conditions.push(column + ' <= ?');
    parameters.push(filters.to.getTime());
  }
}

function addTimeSearch(query, column, conditions, parameters) {
  const digits = query.replace(/\D/g, '');
  if (!digits) {
    conditions.push('1 = 0');
    return;
  }
  const fullDate = "strftime('%d%m%Y%H%M%S', " + column + " / 1000, 'unixepoch', '+7 hours')";
  const shortDate = '(substr(' + fullDate + ', 1, 4) || substr(' + fullDate + ', 7))';
  conditions.push('(' + fullDate + ' LIKE ? OR ' + shortDate + ' LIKE ?)');
  parameters.push('%' + digits + '%', '%' + digits + '%');
}

class SqliteRepository {
  constructor(filename) {
    this.filename = path.resolve(filename);
    this.db = null;
    this.lock = null;
    fs.mkdirSync(path.dirname(this.filename), { recursive: true });
    try {
      // SQLite giữ khóa hệ điều hành; tự nhả cả khi tiến trình bị tắt đột ngột.
      // File khóa riêng tránh giữ transaction dài trên database chứa dữ liệu.
      this.lock = new DatabaseSync(this.filename + '.lock');
      this.lock.exec('BEGIN EXCLUSIVE');
      this.db = new DatabaseSync(this.filename);
      this.db.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;');
      const schema = fs.readFileSync(path.join(__dirname, '../sql/schema-sqlite.sql'), 'utf8');
      this.db.exec(schema);
    } catch (error) {
      this.close();
      if (error.message.includes('database is locked')) {
        throw new Error('File SQLite này đang được một backend khác sử dụng. Hãy dừng backend cũ trước.');
      }
      throw error;
    }
  }

  close() {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
    if (this.lock) {
      this.lock.close();
      this.lock = null;
    }
  }

  transaction(work) {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const result = work();
      this.db.exec('COMMIT');
      return result;
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }

  async health() {
    this.db.prepare('SELECT 1').get();
  }

  async findUser(username) {
    return mapUser(this.db.prepare('SELECT * FROM users WHERE username = ?').get(username));
  }

  async userById(id) {
    return mapUser(this.db.prepare('SELECT * FROM users WHERE id = ?').get(id));
  }

  async createUser(username, passwordHash, name, email) {
    const profile = {
      name, email, studentId: '', className: '', avatar: '',
      github: '', figma: '', postman: '', report: ''
    };
    try {
      const result = this.db.prepare('INSERT INTO users (username, password_hash, profile_json, created_at) VALUES (?, ?, ?, ?)')
        .run(username, passwordHash, JSON.stringify(profile), Date.now());
      return this.userById(Number(result.lastInsertRowid));
    } catch (error) {
      if (error.message.includes('UNIQUE constraint failed: users.username')) {
        error.code = 'ER_DUP_ENTRY';
      }
      throw error;
    }
  }

  async invalidateTokens(id) {
    this.db.prepare('UPDATE users SET token_version = token_version + 1 WHERE id = ?').run(id);
  }

  async changePassword(id, hash) {
    this.db.prepare('UPDATE users SET password_hash = ?, token_version = token_version + 1 WHERE id = ?').run(hash, id);
  }

  async saveProfile(id, profile) {
    const user = mapUser(this.db.prepare('SELECT * FROM users WHERE id = ?').get(id));
    const updatedProfile = { ...user.profile, ...profile };
    this.db.prepare('UPDATE users SET profile_json = ? WHERE id = ?').run(JSON.stringify(updatedProfile), id);
    return this.userById(id);
  }

  async insertReadings(values, date) {
    return this.transaction(() => {
      const statement = this.db.prepare('INSERT INTO sensor_reading (type, value, measured_at) VALUES (?, ?, ?)');
      const readings = [];
      for (const type of ['temperature', 'humidity', 'light']) {
        const result = statement.run(type, values[type], date.getTime());
        readings.push({
          id: Number(result.lastInsertRowid),
          type,
          value: values[type],
          ts: date.getTime(),
          measured_at: date.toISOString()
        });
      }
      return readings;
    });
  }

  async latestReadings(limit) {
    return this.db.prepare('SELECT * FROM sensor_reading ORDER BY measured_at DESC, id DESC LIMIT ?')
      .all(limit * 3).map(mapReading);
  }

  async listReadings(filters) {
    const conditions = ['1 = 1'];
    const parameters = [];
    if (filters.type !== 'all') {
      conditions.push('r.type = ?');
      parameters.push(filters.type);
    }
    addDateFilters(filters, 'r.measured_at', conditions, parameters);
    if (filters.q) {
      if (filters.by === 'time') {
        addTimeSearch(filters.q, 'r.measured_at', conditions, parameters);
      } else {
        conditions.push('r.type = ?');
        parameters.push(filters.by);
        const query = filters.q.replace(',', '.');
        if (!/^-?\d*\.?\d*$/.test(query)) {
          conditions.push('1 = 0');
        } else {
          let format = '%.0f';
          if (filters.by === 'temperature') {
            format = '%.1f';
          }
          conditions.push('printf(?, r.value) LIKE ?');
          parameters.push(format, '%' + query + '%');
        }
      }
    }
    const from = ' FROM sensor_reading r WHERE ' + conditions.join(' AND ');
    return this.paginate('r.*', from, parameters, 'r.measured_at', 'r.id', filters, mapReading);
  }

  async devices() {
    return this.db.prepare('SELECT * FROM device ORDER BY id').all();
  }

  async invalidateDeviceStatus() {
    this.db.exec('UPDATE device SET current_status = NULL, confirmed_at = NULL');
  }

  async recoverPending() {
    this.transaction(() => {
      this.db.prepare("UPDATE device_log SET result = 'timeout', reason = ?, updated_at = ? WHERE result = 'pending'")
        .run('Backend khởi động lại trước khi ghi nhận phản hồi.', Date.now());
      this.db.exec('UPDATE device SET current_status = NULL, confirmed_at = NULL');
    });
  }

  async createCommand(device, action, user) {
    const row = this.db.prepare('SELECT id FROM device WHERE device_key = ?').get(device);
    const date = Date.now();
    const result = this.db.prepare("INSERT INTO device_log (device_id, user_id, action, result, created_at, updated_at) VALUES (?, ?, ?, 'pending', ?, ?)")
      .run(row.id, user.id, action, date, date);
    return { id: Number(result.lastInsertRowid), device, action, result: 'pending', user: user.username, sentAt: date, respondedAt: null, reason: null };
  }

  async finishCommand(command, result, reason) {
    const date = Date.now();
    let respondedAt = null;
    let currentStatus = null;
    if (result === 'success') {
      respondedAt = date;
      currentStatus = command.action;
    }
    return this.transaction(() => {
      const update = this.db.prepare("UPDATE device_log SET result = ?, reason = ?, responded_at = ?, updated_at = ? WHERE id = ? AND result = 'pending'")
        .run(result, reason, respondedAt, date, command.id);
      if (update.changes !== 1) {
        throw new Error('Lệnh đã kết thúc hoặc không tồn tại.');
      }
      this.db.prepare('UPDATE device SET current_status = ?, confirmed_at = ? WHERE device_key = ?')
        .run(currentStatus, respondedAt, command.device);
      return { ...command, result, reason, respondedAt };
    });
  }

  async listCommands(filters) {
    const conditions = ['1 = 1'];
    const parameters = [];
    if (filters.device && filters.device !== 'all') {
      conditions.push('(d.device_key = ? OR d.mqtt_topic = ?)');
      parameters.push(filters.device, filters.device);
    }
    for (const key of ['action', 'result']) {
      if (filters[key]) {
        conditions.push('l.' + key + ' = ?');
        parameters.push(filters[key]);
      }
    }
    addDateFilters(filters, 'l.created_at', conditions, parameters);
    if (filters.q) {
      addTimeSearch(filters.q, 'l.created_at', conditions, parameters);
    }
    const from = ' FROM device_log l JOIN device d ON d.id = l.device_id JOIN users u ON u.id = l.user_id WHERE ' + conditions.join(' AND ');
    return this.paginate('l.*, d.device_key, u.username', from, parameters, 'l.created_at', 'l.id', filters, mapCommand);
  }

  paginate(columns, from, parameters, timeColumn, idColumn, filters, mapper) {
    const total = this.db.prepare('SELECT COUNT(*) AS total' + from).get(...parameters).total;
    const totalPages = Math.max(1, Math.ceil(total / filters.limit));
    const page = Math.min(filters.page, totalPages);
    let direction = 'DESC';
    if (filters.sort === 'asc') {
      direction = 'ASC';
    }
    const sql = 'SELECT ' + columns + from + ' ORDER BY ' + timeColumn + ' ' + direction + ', ' + idColumn + ' ' + direction + ' LIMIT ? OFFSET ?';
    const rows = this.db.prepare(sql).all(...parameters, filters.limit, (page - 1) * filters.limit);
    return { items: rows.map(mapper), pagination: { total, page, limit: filters.limit, total_pages: totalPages } };
  }
}

module.exports = { SqliteRepository };
