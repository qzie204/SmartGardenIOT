'use strict';

const SENSOR_IDS = { temperature: 1, humidity: 2, light: 3 };
const DEVICE_IDS = { pump: 1, light: 2 };
const PROFILE_COLUMNS = {
  name: 'full_name', studentId: 'student_id', className: 'class_name', email: 'email',
  avatar: 'avatar_url', github: 'github_link', figma: 'figma_link',
  postman: 'postman_link', report: 'report_link'
};

function mapUser(row) {
  if (!row) {
    return null;
  }
  const profile = {};
  for (const [key, column] of Object.entries(PROFILE_COLUMNS)) {
    profile[key] = row[column] || '';
  }
  return {
    id: row.id,
    username: row.username,
    passwordHash: row.password_hash,
    tokenVersion: row.token_version,
    profile
  };
}

function mapReading(row) {
  return {
    id: row.id,
    type: row.type,
    value: Number(row.value),
    ts: row.measured_at.getTime(),
    measured_at: row.measured_at.toISOString()
  };
}

function mapCommand(row) {
  let respondedAt = null;
  if (row.responded_at) {
    respondedAt = row.responded_at.getTime();
  }
  return {
    id: row.id,
    device: row.device_key,
    action: row.action,
    result: row.result,
    user: row.username,
    sentAt: row.created_at.getTime(),
    respondedAt,
    reason: row.reason
  };
}

function addTimeFilters(filters, column, conditions, parameters) {
  if (filters.from) {
    conditions.push(column + ' >= ?');
    parameters.push(filters.from);
  }
  if (filters.to) {
    conditions.push(column + ' <= ?');
    parameters.push(filters.to);
  }
}

function addTimeSearch(query, column, conditions, parameters) {
  const digits = query.replace(/\D/g, '');
  if (!digits) {
    conditions.push('1 = 0');
    return;
  }
  // DB lưu UTC; ô tìm kiếm trên giao diện dùng giờ Việt Nam.
  const localTime = 'DATE_ADD(' + column + ', INTERVAL 7 HOUR)';
  conditions.push('(DATE_FORMAT(' + localTime + ", '%d%m%y%H%i%s') LIKE ? OR DATE_FORMAT(" + localTime + ", '%d%m%Y%H%i%s') LIKE ?)");
  parameters.push('%' + digits + '%', '%' + digits + '%');
}

class Repository {
  constructor(pool) {
    this.pool = pool;
  }

  async transaction(work) {
    const connection = await this.pool.getConnection();
    try {
      await connection.beginTransaction();
      const result = await work(connection);
      await connection.commit();
      return result;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async health() {
    await this.pool.query('SELECT 1');
  }

  async findUser(username) {
    const [rows] = await this.pool.execute('SELECT * FROM users WHERE username = ?', [username]);
    return mapUser(rows[0]);
  }

  async userById(id) {
    const [rows] = await this.pool.execute('SELECT * FROM users WHERE id = ?', [id]);
    return mapUser(rows[0]);
  }

  async createUser(username, passwordHash, name, email) {
    const [result] = await this.pool.execute(
      'INSERT INTO users (username, password_hash, full_name, email, created_at) VALUES (?, ?, ?, ?, ?)',
      [username, passwordHash, name, email, new Date()]
    );
    return this.userById(result.insertId);
  }

  async invalidateTokens(id) {
    await this.pool.execute('UPDATE users SET token_version = token_version + 1 WHERE id = ?', [id]);
  }

  async changePassword(id, hash) {
    await this.pool.execute(
      'UPDATE users SET password_hash = ?, token_version = token_version + 1 WHERE id = ?', [hash, id]
    );
  }

  async saveProfile(id, profile) {
    const assignments = [];
    const parameters = [];
    for (const [key, column] of Object.entries(PROFILE_COLUMNS)) {
      if (profile[key] !== undefined) {
        assignments.push(column + ' = ?');
        parameters.push(profile[key]);
      }
    }
    if (assignments.length > 0) {
      parameters.push(id);
      await this.pool.execute('UPDATE users SET ' + assignments.join(', ') + ' WHERE id = ?', parameters);
    }
    return this.userById(id);
  }

  async insertReadings(values, measuredAt) {
    return this.transaction(async function insertBatch(connection) {
      const readings = [];
      for (const [type, sensorId] of Object.entries(SENSOR_IDS)) {
        const [result] = await connection.execute(
          'INSERT INTO sensor_reading (sensor_type_id, value, measured_at) VALUES (?, ?, ?)',
          [sensorId, values[type], measuredAt]
        );
        readings.push({ id: result.insertId, type, value: values[type], ts: measuredAt.getTime(), measured_at: measuredAt.toISOString() });
      }
      return readings;
    });
  }

  async latestReadings(limit) {
    const count = limit * 3;
    const [rows] = await this.pool.query(
      'SELECT r.*, t.name AS type FROM sensor_reading r JOIN sensor_type t ON t.id = r.sensor_type_id ORDER BY r.measured_at DESC, r.id DESC LIMIT ' + count
    );
    return rows.map(mapReading);
  }

  async listReadings(filters) {
    const conditions = ['1 = 1'];
    const parameters = [];
    if (filters.type !== 'all') {
      conditions.push('t.name = ?');
      parameters.push(filters.type);
    }
    addTimeFilters(filters, 'r.measured_at', conditions, parameters);
    if (filters.q) {
      if (filters.by === 'time') {
        addTimeSearch(filters.q, 'r.measured_at', conditions, parameters);
      } else {
        conditions.push('t.name = ?');
        parameters.push(filters.by);
        const query = filters.q.replace(',', '.');
        if (!/^-?\d*\.?\d*$/.test(query)) {
          conditions.push('1 = 0');
        } else {
          let decimals = 0;
          if (filters.by === 'temperature') {
            decimals = 1;
          }
          conditions.push('CAST(CAST(r.value AS DECIMAL(10,' + decimals + ')) AS CHAR) LIKE ?');
          parameters.push('%' + query + '%');
        }
      }
    }
    const from = ' FROM sensor_reading r JOIN sensor_type t ON t.id = r.sensor_type_id WHERE ' + conditions.join(' AND ');
    return this.paginate('r.*, t.name AS type', from, parameters, 'r.measured_at', 'r.id', filters, mapReading);
  }

  async devices() {
    const [rows] = await this.pool.query('SELECT * FROM device ORDER BY id');
    return rows;
  }

  async invalidateDeviceStatus() {
    await this.pool.query('UPDATE device SET current_status = NULL, confirmed_at = NULL');
  }

  async recoverPending() {
    await this.pool.execute(
      "UPDATE device_log SET result = 'timeout', reason = ?, updated_at = ? WHERE result = 'pending'",
      ['Backend khởi động lại trước khi ghi nhận phản hồi.', new Date()]
    );
    await this.invalidateDeviceStatus();
  }

  async createCommand(device, action, user) {
    const date = new Date();
    const [result] = await this.pool.execute(
      "INSERT INTO device_log (device_id, user_id, action, result, created_at, updated_at) VALUES (?, ?, ?, 'pending', ?, ?)",
      [DEVICE_IDS[device], user.id, action, date, date]
    );
    return { id: result.insertId, device, action, result: 'pending', user: user.username, sentAt: date.getTime(), respondedAt: null, reason: null };
  }

  async finishCommand(command, result, reason) {
    const date = new Date();
    let responseDate = null;
    if (result === 'success') {
      responseDate = date;
    }
    await this.transaction(async function saveResult(connection) {
      const [update] = await connection.execute(
        "UPDATE device_log SET result = ?, reason = ?, responded_at = ?, updated_at = ? WHERE id = ? AND result = 'pending'",
        [result, reason, responseDate, date, command.id]
      );
      if (update.affectedRows !== 1) {
        throw new Error('Lệnh đã kết thúc hoặc không tồn tại.');
      }
      if (result === 'success') {
        await connection.execute('UPDATE device SET current_status = ?, confirmed_at = ? WHERE id = ?', [command.action, date, DEVICE_IDS[command.device]]);
      } else {
        // Có thể thiết bị đã chạy nhưng phản hồi thất lạc: trạng thái thực chưa xác định.
        await connection.execute('UPDATE device SET current_status = NULL, confirmed_at = NULL WHERE id = ?', [DEVICE_IDS[command.device]]);
      }
    });
    let respondedAt = null;
    if (responseDate) {
      respondedAt = responseDate.getTime();
    }
    return { ...command, result, reason, respondedAt };
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
    addTimeFilters(filters, 'l.created_at', conditions, parameters);
    if (filters.q) {
      addTimeSearch(filters.q, 'l.created_at', conditions, parameters);
    }
    const from = ' FROM device_log l JOIN device d ON d.id = l.device_id JOIN users u ON u.id = l.user_id WHERE ' + conditions.join(' AND ');
    return this.paginate('l.*, d.device_key, u.username', from, parameters, 'l.created_at', 'l.id', filters, mapCommand);
  }

  async paginate(columns, from, parameters, timeColumn, idColumn, filters, mapper) {
    return this.transaction(async function readPage(connection) {
      const [counts] = await connection.execute('SELECT COUNT(*) AS total' + from, parameters);
      const total = Number(counts[0].total);
      const totalPages = Math.max(1, Math.ceil(total / filters.limit));
      const page = Math.min(filters.page, totalPages);
      const offset = (page - 1) * filters.limit;
      let order = 'DESC';
      if (filters.sort === 'asc') {
        order = 'ASC';
      }
      // LIMIT/OFFSET chỉ lấy từ số nguyên đã kiểm tra; bộ lọc luôn dùng placeholder.
      const sql = 'SELECT ' + columns + from + ' ORDER BY ' + timeColumn + ' ' + order + ', ' + idColumn + ' ' + order + ' LIMIT ' + filters.limit + ' OFFSET ' + offset;
      const [rows] = await connection.execute(sql, parameters);
      return { items: rows.map(mapper), pagination: { total, page, limit: filters.limit, total_pages: totalPages } };
    });
  }
}

module.exports = { Repository, PROFILE_COLUMNS };
