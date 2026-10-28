CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL COLLATE NOCASE UNIQUE,
  password_hash TEXT NOT NULL,
  profile_json TEXT NOT NULL DEFAULT '{}',
  token_version INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS sensor_reading (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL CHECK(type IN ('temperature', 'humidity', 'light')),
  value REAL NOT NULL,
  measured_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_reading_time ON sensor_reading(measured_at, id);
CREATE INDEX IF NOT EXISTS idx_reading_type_time ON sensor_reading(type, measured_at, id);

CREATE TABLE IF NOT EXISTS device (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  device_key TEXT NOT NULL UNIQUE,
  mqtt_topic TEXT NOT NULL UNIQUE,
  current_status TEXT CHECK(current_status IN ('on', 'off')),
  confirmed_at INTEGER
);

CREATE TABLE IF NOT EXISTS device_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  device_id INTEGER NOT NULL REFERENCES device(id),
  user_id INTEGER NOT NULL REFERENCES users(id),
  action TEXT NOT NULL CHECK(action IN ('on', 'off')),
  result TEXT NOT NULL CHECK(result IN ('pending', 'success', 'failed', 'timeout')),
  reason TEXT,
  created_at INTEGER NOT NULL,
  responded_at INTEGER,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_log_time ON device_log(created_at, id);
CREATE INDEX IF NOT EXISTS idx_log_device_time ON device_log(device_id, created_at, id);

INSERT OR IGNORE INTO device (id, name, device_key, mqtt_topic) VALUES
  (1, 'Máy bơm nước', 'pump', 'led1'),
  (2, 'Đèn', 'light', 'led2');
