/* Cấu hình chung. Đơn vị/ý nghĩa cảm biến: sửa theo phần cứng thật. */
window.SG = window.SG || {};
SG.META = {
  temperature: {
    label: 'Nhiệt độ',
    unit: '°C',
    decimals: 1,
    icon: 'ph-thermometer',
    color: 'var(--temp)'
  },
  humidity: {
    label: 'Độ ẩm không khí',
    unit: '%',
    decimals: 0,
    icon: 'ph-drop-half',
    color: 'var(--hum)'
  },
  light: {
    label: 'Ánh sáng',
    unit: 'DO',
    decimals: 0,
    icon: 'ph-sun',
    color: 'var(--lux)'
  }
};
SG.TYPES = ['temperature', 'humidity', 'light'];
SG.DEV = {
  light: {
    name: 'Đèn',
    icon: 'ph-lightbulb'
  },
  pump: {
    name: 'Máy bơm nước',
    icon: 'ph-drop'
  }
};
SG.RES = {
  pending: {
    label: 'Đang xử lý',
    icon: 'ph-spinner spin'
  },
  success: {
    label: 'Thành công',
    icon: 'ph-check-circle'
  },
  failed: {
    label: 'Thất bại',
    icon: 'ph-x-circle'
  },
  timeout: {
    label: 'Hết thời gian chờ',
    icon: 'ph-hourglass'
  }
};
/* Hồ sơ: để trống sẽ hiển thị "Chưa cập nhật". Không tự điền thông tin cá nhân. */
SG.PROFILE = {
  name: '',
  studentId: '',
  className: '',
  email: '',
  github: '',
  figma: '',
  postman: '',
  report: ''
};
