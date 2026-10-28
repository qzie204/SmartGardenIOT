'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');
const { randomBytes } = require('node:crypto');

async function configure() {
  const root = path.resolve(__dirname, '../..');
  let content = await fs.readFile(path.join(root, '.env.example'), 'utf8');
  content = content.replace('replace_with_a_random_secret_at_least_32_characters', randomBytes(48).toString('hex'));
  content = content.replace('replace_with_another_random_secret_at_least_32_characters', randomBytes(48).toString('hex'));
  try {
    await fs.writeFile(path.join(root, '.env'), content, { flag: 'wx' });
    console.log('Đã tạo .env và hai khóa ngẫu nhiên. Điền DB_PASSWORD, MQTT_USERNAME, MQTT_PASSWORD trước khi chạy.');
  } catch (error) {
    if (error.code === 'EEXIST') {
      console.log('.env đã tồn tại; giữ nguyên cấu hình của bạn.');
      return;
    }
    throw error;
  }
}

configure().catch(function configurationFailed(error) {
  console.error(error.code || error.message);
  process.exitCode = 1;
});
