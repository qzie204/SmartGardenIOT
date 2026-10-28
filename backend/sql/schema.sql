CREATE TABLE IF NOT EXISTS users (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(50) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(100) NOT NULL DEFAULT '',
  student_id VARCHAR(50) NOT NULL DEFAULT '',
  class_name VARCHAR(50) NOT NULL DEFAULT '',
  email VARCHAR(255) NOT NULL DEFAULT '',
  avatar_url MEDIUMTEXT,
  github_link VARCHAR(1000) NOT NULL DEFAULT '',
  figma_link VARCHAR(1000) NOT NULL DEFAULT '',
  postman_link VARCHAR(1000) NOT NULL DEFAULT '',
  report_link VARCHAR(1000) NOT NULL DEFAULT '',
  token_version INT UNSIGNED NOT NULL DEFAULT 0,
  created_at DATETIME(3) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS sensor_type (
  id INT UNSIGNED PRIMARY KEY,
  name VARCHAR(30) NOT NULL UNIQUE,
  unit VARCHAR(10) NOT NULL,
  description VARCHAR(255) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS sensor_reading (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  sensor_type_id INT UNSIGNED NOT NULL,
  value DECIMAL(10,2) NOT NULL,
  measured_at DATETIME(3) NOT NULL,
  FOREIGN KEY (sensor_type_id) REFERENCES sensor_type(id),
  INDEX idx_reading_time (measured_at, id),
  INDEX idx_reading_type_time (sensor_type_id, measured_at, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS device (
  id INT UNSIGNED PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  device_key VARCHAR(30) NOT NULL UNIQUE,
  mqtt_topic VARCHAR(30) NOT NULL UNIQUE,
  current_status ENUM('on','off') NULL,
  confirmed_at DATETIME(3) NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS device_log (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  device_id INT UNSIGNED NOT NULL,
  user_id INT UNSIGNED NOT NULL,
  action ENUM('on','off') NOT NULL,
  result ENUM('pending','success','failed','timeout') NOT NULL,
  reason VARCHAR(255) NULL,
  created_at DATETIME(3) NOT NULL,
  responded_at DATETIME(3) NULL,
  updated_at DATETIME(3) NOT NULL,
  FOREIGN KEY (device_id) REFERENCES device(id),
  FOREIGN KEY (user_id) REFERENCES users(id),
  INDEX idx_log_time (created_at, id),
  INDEX idx_log_device_time (device_id, created_at, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT IGNORE INTO sensor_type (id, name, unit, description) VALUES
  (1, 'temperature', '°C', 'Nhiệt độ DHT11'),
  (2, 'humidity', '%', 'Độ ẩm không khí DHT11'),
  (3, 'light', 'DO', 'Tín hiệu số 0/1, không phải lux');
INSERT IGNORE INTO device (id, name, device_key, mqtt_topic) VALUES
  (1, 'Máy bơm nước', 'pump', 'led1'),
  (2, 'Đèn', 'light', 'led2');
