/* Trang lịch sử: bộ lọc, bảng lệnh và hộp thoại chi tiết. */
(function () {
  const select = SG.select;
  const filters = {
    query: '',
    device: '',
    action: '',
    result: '',
    ascending: false,
    page: 1,
    size: 10
  };
  let pageCommands = [];
  let requestNumber = 0;

  function getResponseText(command) {
    if (command.respondedAt) {
      return SG.formatDateTime(command.respondedAt);
    }
    if (command.result === 'pending') {
      return 'Đang chờ';
    }
    return 'Không có phản hồi';
  }

  function showCommandDetails(id) {
    const command = [...SG.state.commands, ...pageCommands].find(candidate => {
      return candidate.id === id;
    });
    if (!command) {
      return;
    }
    const title = 'Chi tiết lệnh #' + String(command.id).padStart(3, '0');
    const reason = command.reason
      ? `<p class="notice">${SG.escapeHtml(command.reason)} Kiểm tra thiết bị trước khi gửi lại lệnh tại Tổng quan.</p>`
      : '';
    const body = [
      `<p>${SG.getActionLabel(command.action)} ${SG.DEV[command.device].name.toLowerCase()}</p>`,
      '<dl>',
      `<div><dt>Trạng thái</dt><dd>${SG.badge(command.result)}</dd></div>`,
      `<div><dt>Người thao tác</dt><dd>${SG.escapeHtml(command.user)}</dd></div>`,
      `<div><dt>Thời gian gửi</dt><dd>${SG.formatDateTime(command.sentAt)}</dd></div>`,
      `<div><dt>Phản hồi</dt><dd>${getResponseText(command)}</dd></div>`,
      '</dl>',
      reason,
      '<div class="dialog-actions">',
      '<button class="btn primary" type="button" data-close>Đóng</button>',
      '</div>'
    ].join('');
    SG.dialog(title, body);
    select('#dlg').dataset.commandId = String(id);
  }

  function renderCommandRow(command) {
    const device = SG.DEV[command.device];
    const recordId = String(command.id).padStart(3, '0');
    const timestamp = new Date(command.sentAt).toISOString();
    return [
      '<tr>',
      `<td class="record-id">#${recordId}</td>`,
      `<td><span class="sensor-label">${SG.renderIcon(device.icon)}${device.name}</span></td>`,
      `<td>${SG.getActionLabel(command.action)}</td>`,
      `<td>${SG.escapeHtml(command.user)}</td>`,
      `<td>${SG.badge(command.result)}</td>`,
      `<td><time datetime="${timestamp}">${SG.formatDateTime(command.sentAt)}</time></td>`,
      '<td>',
      `<button class="text-btn" data-id="${command.id}" aria-label="Chi tiết lệnh ${command.id}">`,
      `Chi tiết ${SG.renderIcon('ph-arrow-up-right')}</button>`,
      '</td>',
      '</tr>'
    ].join('');
  }

  async function renderHistoryPage() {
    requestNumber += 1;
    const currentRequest = requestNumber;
    let sort = 'desc';
    if (filters.ascending) {
      sort = 'asc';
    }
    const query = new URLSearchParams({ q: filters.query, device: filters.device, action: filters.action, result: filters.result, page: filters.page, limit: filters.size, sort });
    let result;
    try {
      result = await SG.api.request('/actions?' + query);
    } catch (error) {
      if (currentRequest === requestNumber) {
        select('#h-body').innerHTML = '<tr><td colspan="7" class="none">' + SG.escapeHtml(error.message) + '</td></tr>';
      }
      return;
    }
    if (currentRequest !== requestNumber) {
      return;
    }
    const rows = result.items;
    pageCommands = rows;
    filters.page = result.pagination.page;
    SG.pager('#h-pg', filters, result.pagination.total, renderHistoryPage);

    if (rows.length === 0) {
      select('#h-body').innerHTML = `<tr><td colspan="7" class="none">${SG.empty()}</td></tr>`;
    } else {
      select('#h-body').innerHTML = rows.map(renderCommandRow).join('');
    }

    select('#h-body').querySelectorAll('[data-id]').forEach(button => {

      button.onclick = () => {
        SG.showCommand(Number(button.dataset.id));
      };
    });
  }

  select('#h-q').oninput = event => {
    filters.query = event.target.value;
    filters.page = 1;
    renderHistoryPage();
  };
  const filterFields = [
    ['#h-dev', 'device'],
    ['#h-act', 'action'],
    ['#h-res', 'result']
  ];
  filterFields.forEach(([selector, key]) => {

    select(selector).onchange = event => {
      filters[key] = event.target.value;
      filters.page = 1;
      renderHistoryPage();
    };
  });

  select('#h-ord').onchange = event => {
    filters.ascending = event.target.value === 'old';
    filters.page = 1;
    renderHistoryPage();
  };

  function clearFilters() {
    Object.assign(filters, {
      query: '',
      device: '',
      action: '',
      result: '',
      ascending: false,
      page: 1
    });
    ['#h-q', '#h-dev', '#h-act', '#h-res'].forEach(selector => {
      select(selector).value = '';
    });
    select('#h-ord').value = 'new';
    renderHistoryPage();
  }

  select('#h-cl').onclick = clearFilters;
  select('#dlg').addEventListener('close', () => {
    delete select('#dlg').dataset.commandId;
  });
  SG.showCommand = showCommandDetails;
  SG.renderHist = renderHistoryPage;
  SG.on('cmd', () => {
    if (SG.state.user) {
      if (SG.currentPage === 'history') {
        renderHistoryPage();
      }
      if (select('#dlg').open && select('#dlg').dataset.commandId) {
        SG.showCommand(+select('#dlg').dataset.commandId);
      }
    }
  });
})();
