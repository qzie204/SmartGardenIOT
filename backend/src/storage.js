'use strict';

async function createStorage(config, onConnectionLost) {
  if (config.storageDriver === 'sqlite') {
    const { SqliteRepository } = require('./sqlite-repository');
    const repository = new SqliteRepository(config.sqliteFile);
    return {
      repository,
      label: 'SQLite: ' + repository.filename,
      async close() {
        repository.close();
      }
    };
  }

  const mysql = require('mysql2/promise');
  const { Repository } = require('./repository');
  const pool = mysql.createPool(config.database);
  let lockConnection;
  try {
    lockConnection = await pool.getConnection();
    const [rows] = await lockConnection.query("SELECT GET_LOCK('smartgarden_backend', 0) AS acquired");
    if (rows[0].acquired !== 1) {
      throw new Error('Đã có một backend Smart Garden đang chạy trên MySQL này.');
    }
    lockConnection.on('error', onConnectionLost);
  } catch (error) {
    if (lockConnection) {
      lockConnection.release();
    }
    await pool.end();
    throw error;
  }
  return {
    repository: new Repository(pool),
    label: 'MySQL: ' + config.database.database,
    async close() {
      try {
        await lockConnection.query("SELECT RELEASE_LOCK('smartgarden_backend')");
      } finally {
        lockConnection.release();
        await pool.end();
      }
    }
  };
}

module.exports = { createStorage };
