'use strict';

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function requireObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new HttpError(400, 'Dữ liệu phải là một JSON object.');
  }
  return value;
}

function text(value, name, maximum = 255, required = false) {
  if (value === undefined && !required) {
    return '';
  }
  if (typeof value !== 'string' || value.length > maximum || (required && !value.trim())) {
    throw new HttpError(400, name + ' không hợp lệ.');
  }
  return value.trim();
}

function password(value) {
  if (typeof value !== 'string' || value.length < 8 || Buffer.byteLength(value, 'utf8') > 72) {
    throw new HttpError(400, 'Mật khẩu cần ít nhất 8 ký tự và tối đa 72 byte UTF-8.');
  }
  return value;
}

function sensorValues(body) {
  requireObject(body);
  let temperature = body.temperature;
  let humidity = body.humidity;
  if (temperature === undefined) {
    temperature = body.temp;
  }
  if (humidity === undefined) {
    humidity = body.humid;
  }
  if (!Number.isFinite(temperature) || temperature < -40 || temperature > 80) {
    throw new HttpError(400, 'Nhiệt độ không hợp lệ.');
  }
  if (!Number.isFinite(humidity) || humidity < 0 || humidity > 100) {
    throw new HttpError(400, 'Độ ẩm phải từ 0 đến 100.');
  }
  if (body.light !== 0 && body.light !== 1) {
    throw new HttpError(400, 'Ánh sáng DO của firmware hiện tại chỉ nhận 0 hoặc 1.');
  }
  return { temperature, humidity, light: body.light };
}

function positiveInteger(value, fallback, maximum) {
  if (value === undefined || value === '') {
    return fallback;
  }
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > maximum) {
    throw new HttpError(400, 'Tham số phân trang không hợp lệ.');
  }
  return parsed;
}

function choice(value, allowed, fallback) {
  if (value === undefined || value === '') {
    return fallback;
  }
  if (!allowed.includes(value)) {
    throw new HttpError(400, 'Bộ lọc không hợp lệ.');
  }
  return value;
}

function dateFilter(value) {
  if (value === undefined || value === '') {
    return null;
  }
  let input = text(value, 'Thời gian', 40, true);
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(input)) {
    input = input.replace(' ', 'T') + '+07:00';
  }
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?(Z|[+-]\d{2}:\d{2})$/.test(input)) {
    throw new HttpError(400, 'Thời gian cần ISO 8601 hoặc yyyy-MM-dd HH:mm:ss (giờ Việt Nam).');
  }
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) {
    throw new HttpError(400, 'Thời gian không hợp lệ.');
  }
  return date;
}

function listFilters(query, kind) {
  const result = {
    page: positiveInteger(query.page, 1, 1000000),
    limit: positiveInteger(query.limit, 10, 100),
    sort: choice(query.sort, ['asc', 'desc'], 'desc'),
    q: text(query.q, 'Từ khóa', 100),
    from: dateFilter(query.from),
    to: dateFilter(query.to)
  };
  if (result.from && result.to && result.from > result.to) {
    throw new HttpError(400, 'Thời gian bắt đầu phải trước thời gian kết thúc.');
  }
  if (kind === 'sensors') {
    result.type = choice(query.type, ['all', 'temperature', 'humidity', 'light'], 'all');
    result.by = choice(query.by, ['time', 'temperature', 'humidity', 'light'], 'time');
  } else {
    result.device = choice(query.device, ['all', 'pump', 'light', 'led1', 'led2'], 'all');
    result.action = choice(query.action, ['on', 'off'], '');
    result.result = choice(query.result, ['pending', 'success', 'failed', 'timeout'], '');
  }
  return result;
}

module.exports = { HttpError, requireObject, text, password, sensorValues, positiveInteger, listFilters };
