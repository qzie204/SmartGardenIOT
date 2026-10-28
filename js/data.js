/* Trang dữ liệu: lọc bản ghi, phân trang và dựng từng hàng của bảng. */
(function () {
  const select = SG.select;
  const filters = {
    searchBy: 'time',
    query: '',
    ascending: false,
    page: 1,
    size: 10
  };
  const hints = {
    time: 'dd/MM/yy HH:mm:ss',
    temperature: 'Nhập nhiệt độ, ví dụ 27',
    humidity: 'Nhập độ ẩm, ví dụ 66',
    light: 'Nhập tín hiệu ánh sáng: 0 hoặc 1'
  };
  // Backend lọc và phân trang trên toàn bộ dữ liệu MySQL.
  let requestNumber = 0;

  function renderReadingRow(reading) {
    const sensor = SG.META[reading.type];
    const recordId = String(reading.id).padStart(4, '0');
    const timestamp = new Date(reading.ts).toISOString();

    return [
      '<tr>',
      `<td class="record-id">#${recordId}</td>`,
      '<td>',
      `<span class="sensor-label" data-sensor="${reading.type}">`,
      `<span class="sensor-icon">${SG.renderIcon(sensor.icon)}</span>`,
      `${sensor.label}</span>`,
      '</td>',
      `<td class="num">${SG.formatReading(reading)}</td>`,
      `<td><time datetime="${timestamp}">${SG.formatDateTime(reading.ts)}</time></td>`,
      '</tr>'
    ].join('');
  }

  function renderTableBody(rows) {
    if (!SG.state.ready) {
      const loadingMessage = SG.empty('Đang tải dữ liệu…', 'Các bản ghi sẽ xuất hiện trong giây lát.');
      return `<tr><td colspan="4" class="none">${loadingMessage}</td></tr>`;
    }
    if (rows.length === 0) {
      return `<tr><td colspan="4" class="none">${SG.empty()}</td></tr>`;
    }

    return rows.map(renderReadingRow).join('');
  }

  async function renderDataPage() {
    requestNumber += 1;
    const currentRequest = requestNumber;
    let sort = 'desc';
    let sortLabel = 'descending';
    let sortIcon = 'ph-arrow-down';
    if (filters.ascending) {
      sort = 'asc';
      sortLabel = 'ascending';
      sortIcon = 'ph-arrow-up';
    }
    const query = new URLSearchParams({ by: filters.searchBy, q: filters.query, page: filters.page, limit: filters.size, sort });
    select('#d-time-head').setAttribute('aria-sort', sortLabel);
    select('#d-sort').innerHTML = 'Thời gian ghi nhận ' + SG.renderIcon(sortIcon);
    try {
      const result = await SG.api.request('/sensors?' + query);
      if (currentRequest !== requestNumber) {
        return;
      }
      filters.page = result.pagination.page;
      select('#data-count').textContent = `${result.pagination.total} bản ghi · Cập nhật khi nhận dữ liệu cảm biến`;
      SG.pager('#d-pg', filters, result.pagination.total, renderDataPage);
      select('#d-body').innerHTML = renderTableBody(result.items);
    } catch (error) {
      if (currentRequest === requestNumber) {
        select('#data-count').textContent = error.message;
        select('#d-body').innerHTML = '<tr><td colspan="4" class="none">Không tải được dữ liệu.</td></tr>';
      }
    }
  }
  // Lọc ngay khi gõ hoặc khi đổi ô chọn, không cần bấm nút.

  function applyFilters() {
    filters.searchBy = select('#d-by').value;
    filters.query = select('#d-q').value;
    filters.page = 1;
    renderDataPage();
  }

  function handleFilterTypeChange(event) {
    select('#d-q').placeholder = hints[event.target.value];
    applyFilters();
  }

  function clearFilters() {
    select('#d-form').reset();
    select('#d-q').placeholder = hints.time;
    Object.assign(filters, {
      searchBy: 'time',
      query: '',
      page: 1
    });
    renderDataPage();
  }

  function toggleSortOrder() {
    filters.ascending = !filters.ascending;
    filters.page = 1;
    renderDataPage();
  }

  // Gắn sự kiện sau khi khai báo các hàm xử lý.
  select('#d-by').onchange = handleFilterTypeChange;
  select('#d-q').oninput = applyFilters;

  select('#d-form').onsubmit = event => {
    event.preventDefault();
  };
  select('#d-cl').onclick = clearFilters;
  select('#d-sort').onclick = toggleSortOrder;

  SG.renderData = renderDataPage;
  SG.on('data', () => {
    if (SG.state.user && SG.currentPage === 'data') {
      renderDataPage();
    }
  });
})();
