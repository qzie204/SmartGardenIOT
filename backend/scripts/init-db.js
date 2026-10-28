'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');
const mysql = require('mysql2/promise');
const { databaseConfig } = require('../src/config');

async function initializeDatabase() {
  const connection = await mysql.createConnection(databaseConfig());
  try {
    const schema = await fs.readFile(path.join(__dirname, '../sql/schema.sql'), 'utf8');
    const statements = schema.split(';');
    for (const statement of statements) {
      if (statement.trim()) {
        await connection.query(statement);
      }
    }
    console.log('Đã tạo các bảng và danh mục cảm biến/thiết bị. Không tạo dữ liệu đo giả.');
  } finally {
    await connection.end();
  }
}

initializeDatabase().catch(function handleSetupError(error) {
  console.error('Không khởi tạo được database:', error.code || error.message);
  process.exitCode = 1;
});
