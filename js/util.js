/* Tiện ích không phụ thuộc thư viện hoặc kết nối mạng. */

SG.select = selector => {
  return document.querySelector(selector);
};

SG.renderIcon = name => {
  return `<i class="ph ${name}" aria-hidden="true"></i>`;
};

SG.escapeHtml = value => {
  return String(value ?? '').replace(/[&<>"']/g, character => {
    return {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[character];
  });
};

SG.normalizeText = value => {
  return String(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd');
};

SG.getActionLabel = action => {
  return action === 'on' ? 'Bật' : 'Tắt';
};

SG.formatReading = reading => {
  const sensor = SG.META[reading.type];
  const formattedValue = Number(reading.value).toFixed(sensor.decimals);
  return `${formattedValue} ${sensor.unit}`;
};

SG.formatDateTime = timestamp => {
  const parts = {};
  new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Ho_Chi_Minh',
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(timestamp).forEach(part => {
    parts[part.type] = part.value;
  });
  return `${parts.day}/${parts.month}/${parts.year} ${parts.hour}:${parts.minute}:${parts.second}`;
};

SG.formatTime = timestamp => {
  return SG.formatDateTime(timestamp).slice(9);
};

SG.matchTime = (query, timestamp) => {
  const digits = query.replace(/\D/g, '');
  if (!digits) {
    return false;
  }
  const shortDateTime = SG.formatDateTime(timestamp);
  const year = new Intl.DateTimeFormat('en', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric'
  }).format(timestamp);
  const fullDateTime = shortDateTime.slice(0, 6) + year + shortDateTime.slice(8);
  return [shortDateTime, fullDateTime].some(value => {
    return value.replace(/\D/g, '').includes(digits);
  });
};
/* Một số chế độ riêng tư chặn storage ở file://. Ứng dụng vẫn chạy trong phiên. */
SG.storage = {
  get(key, kind = 'localStorage') {
    try {
      return window[kind].getItem(key);
    } catch (_) {
      return null;
    }
  },
  set(key, value, kind = 'localStorage') {
    try {
      window[kind].setItem(key, value);
      return true;
    } catch (_) {
      return false;
    }
  },
  remove(key, kind = 'localStorage') {
    try {
      window[kind].removeItem(key);
    } catch (_) {
      // Trình duyệt có thể chặn storage; không làm gián đoạn thao tác hiện tại.
    }
  }
};

SG.getSafeUrl = value => {
  try {
    const url = new URL(value);
    return ['https:', 'http:'].includes(url.protocol) ? url.href : '';
  } catch (_) {
    return '';
  }
};
