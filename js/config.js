/* Cấu hình chung. Đơn vị/ý nghĩa cảm biến: sửa theo phần cứng thật. */
window.SG = window.SG || {};
SG.META = {
  temperature: { l: 'Nhiệt độ', u: '°C', d: 1, icon: 'ph-thermometer', c: 'var(--temp)' },
  humidity: { l: 'Độ ẩm không khí', u: '%', d: 0, icon: 'ph-drop-half', c: 'var(--hum)' },
  light: { l: 'Ánh sáng', u: 'lux', d: 0, icon: 'ph-sun', c: 'var(--lux)' }
};
SG.TYPES = ['temperature', 'humidity', 'light'];
SG.DEV = { light: { name: 'Đèn', icon: 'ph-lightbulb' }, pump: { name: 'Máy bơm nước', icon: 'ph-drop' } };
SG.RES = {
  pending: { t: 'Đang xử lý', i: 'ph-spinner spin' }, success: { t: 'Thành công', i: 'ph-check-circle' },
  failed: { t: 'Thất bại', i: 'ph-x-circle' }, timeout: { t: 'Hết thời gian chờ', i: 'ph-hourglass' }
};
/* Hồ sơ: để trống sẽ hiển thị "Chưa cập nhật". Không tự điền thông tin cá nhân. */
SG.PROFILE = { name: '', studentId: '', className: '', email: '', github: '', figma: '', postman: '', report: '' };
