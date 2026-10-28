/* Trang tổng quan: thẻ cảm biến, biểu đồ và trạng thái thiết bị. */
(function () {
  const select = SG.select;
  const state = SG.state;
  let chartMode = 'all';
  const chartLabels = {
    all: 'Tất cả',
    temperature: 'Nhiệt độ',
    humidity: 'Độ ẩm',
    light: 'Ánh sáng'
  };

  function selectChartMode(mode) {
    chartMode = mode;
    select('#chart').querySelectorAll('[data-mode]').forEach(button => {
      const active = button.dataset.mode === mode;
      button.setAttribute('aria-selected', String(active));
      button.tabIndex = active ? 0 : -1;
    });
    select('#c-body').setAttribute('aria-labelledby', 'tab-' + mode);
    SG.chart(select('#c-body'), mode);
  }

  function createChartFrame() {
    if (select('#c-body')) {
      return;
    }
    const modes = ['all', ...SG.TYPES];
    const tabButtons = modes.map(mode => {
      const selected = mode === chartMode;
      return [
        `<button id="tab-${mode}" type="button" role="tab" data-mode="${mode}"`,
        ` aria-controls="c-body" aria-selected="${selected}" tabindex="${selected ? '0' : '-1'}">`,
        `${chartLabels[mode]}</button>`
      ].join('');
    }).join('');
    select('#chart').innerHTML = [
      `<div class="section-head chart-head">`,
      `<h2>Biểu đồ</h2>`,
      `<span class="subtle-chip">${SG.CHART_POINT_LIMIT} mốc đo gần nhất</span>`,
      '</div>',
      '<div class="chart-tabs" role="tablist" aria-label="Chọn biểu đồ">',
      tabButtons,
      '</div>',
      `<div id="c-body" role="tabpanel" aria-labelledby="tab-${chartMode}"></div>`
    ].join('');
    const tabs = [...select('#chart').querySelectorAll('[data-mode]')];
    tabs.forEach((button, index) => {

      button.onclick = () => {
        return selectChartMode(button.dataset.mode);
      };

      button.onkeydown = event => {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
          return;
        }
        event.preventDefault();
        let nextIndex;
        if (event.key === 'Home') {
          nextIndex = 0;
        } else if (event.key === 'End') {
          nextIndex = tabs.length - 1;
        } else {
          const direction = event.key === 'ArrowRight' ? 1 : -1;
          nextIndex = (index + direction + tabs.length) % tabs.length;
        }
        tabs[nextIndex].focus();
        selectChartMode(tabs[nextIndex].dataset.mode);
      };
    });
  }

  function renderMetrics() {
    select('#metrics').innerHTML = SG.TYPES.map(type => {
      const meta = SG.META[type];
      const reading = state.readings.find(point => {
        return point.type === type && Number.isFinite(point.value);
      });
      const value = state.ready && reading ? `${reading.value.toFixed(meta.decimals)}<small>${meta.unit}</small>` : '—';
      return [
        `<article class="metric" data-t="${type}">
        <div class="metric-top">`,
        `<p class="metric-l">${meta.label}</p>`,
        `<span class="metric-ic">${SG.renderIcon(meta.icon)}</span>`,
        `</div>
        <div class="metric-main">`,
        `<p class="metric-v">${value}</p>`,
        `</div>
      </article>`
      ].join('');
    }).join('');
    SG.redrawChart();
  }

  function renderDeviceRow([deviceKey, device]) {
    return [
      `<div class="dev" data-device="${deviceKey}">`,
      '<div class="dev-row">',
      `<span class="dev-ic">${SG.renderIcon(device.icon)}</span>`,
      '<div class="dev-t">',
      `<b>${device.name}</b>`,
      '<span class="dev-s" aria-live="polite"></span>',
      '</div>',
      `<button class="switch" role="switch" data-d="${deviceKey}"`,
      ` aria-label="${device.name}" aria-checked="false"></button>`,
      '</div>',
      '</div>'
    ].join('');
  }

  function createControlsFrame() {
    if (select('#device-list')) {
      return;
    }

    const deviceRows = Object.entries(SG.DEV).map(renderDeviceRow).join('');
    select('#ctrl').innerHTML = [
      '<div class="section-head"><h2>Thiết bị</h2></div>',
      '<p class="offline-note" id="offline-note" hidden>',
      `${SG.renderIcon('ph-wifi-slash')} Mất kết nối. Chưa thể gửi lệnh.</p>`,
      `<div id="device-list">${deviceRows}</div>`,
      '<div class="ctrl-foot" id="ctrl-foot"></div>'
    ].join('');

    select('#device-list').querySelectorAll('.switch').forEach(button => {

      button.onclick = () => {
        SG.api.send(button.dataset.d);
      };
    });
  }

  function getDeviceStatusMarkup(deviceState) {
    if (deviceState.pending) {
      return SG.renderIcon('ph-spinner spin') + ' Đang chờ xác nhận';
    }
    if (!state.online) {
      return SG.renderIcon('ph-wifi-slash') + ' Mất kết nối';
    }
    if (!deviceState.known) {
      return 'Chưa xác định · bấm để bật';
    }
    return `<span class="status-dot"></span>${deviceState.on ? 'Đang bật' : 'Đang tắt'}`;
  }

  function updateDeviceRow(key, deviceState) {
    const item = select(`[data-device="${key}"]`);
    const button = item.querySelector('.switch');
    const actionHint = deviceState.on ? 'đang bật, bấm để tắt' : 'đang tắt, bấm để bật';

    item.classList.toggle('on', deviceState.on);
    button.setAttribute('aria-checked', String(deviceState.on));
    button.disabled = deviceState.pending || state.busy || !state.online;
    button.setAttribute('aria-label', `${SG.DEV[key].name}: ${actionHint}`);
    item.querySelector('.dev-s').innerHTML = getDeviceStatusMarkup(deviceState);
  }

  function renderLatestCommand() {
    const last = state.commands[0];
    select('#ctrl-foot').innerHTML = [
      `<div class="kv">`,
      `<span>Lệnh gần nhất</span>`,
      `<b>${last ? SG.getActionLabel(last.action) + ' ' + SG.DEV[last.device].name.toLowerCase() : 'Chưa có lệnh'}</b>`,
      `</div>`,
      `<div class="kv">`,
      `<span>Phản hồi</span>${last ? SG.badge(last.result) : '—'}</div>`,
      `<div class="kv">`,
      `<span>Thời gian gửi</span>`,
      `<time>${last ? SG.formatTime(last.sentAt) : '—'}</time>`,
      `</div>${last && ['failed', 'timeout'].includes(last.result) ? `<p class="err">${SG.escapeHtml(last.reason)} Bạn có thể gửi lại lệnh.</p>` : ''}`
    ].join('');
  }

  function renderControls() {
    createControlsFrame();
    select('#offline-note').hidden = state.online;
    Object.entries(state.dev).forEach(([key, deviceState]) => {
      updateDeviceRow(key, deviceState);
    });
    renderLatestCommand();
  }

  SG.renderHome = () => {
    renderMetrics();
    renderControls();
  };

  SG.redrawChart = () => {
    createChartFrame();
    SG.chart(select('#c-body'), chartMode);
  };
  SG.on('data', () => {
    if (state.user && SG.currentPage === 'home') {
      renderMetrics();
    }
  });
  SG.on('cmd', () => {
    if (state.user) {
      renderControls();
    }
  });
  let previousOnline = state.online;
  SG.on('status', function renderConnectionStatus() {
    if (state.user) {
      renderControls();
      if (SG.currentPage === 'home' && previousOnline !== state.online) {
        SG.redrawChart();
      }
    }
    previousOnline = state.online;
  });
  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (state.user && SG.currentPage === 'home') {
        SG.redrawChart();
      }
    }, 80);
  });
})();
