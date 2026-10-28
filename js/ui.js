/* Thành phần dùng chung: thông báo, hộp thoại và phân trang. */
(function () {
  const select = SG.select;

  SG.badge = result => {
    const meta = SG.RES[result] || SG.RES.pending;
    return `<span class="badge ${SG.escapeHtml(result)}">${SG.renderIcon(meta.icon)}${meta.label}</span>`;
  };

  SG.empty = (title = 'Không tìm thấy kết quả', hint = 'Thử đổi từ khóa hoặc xóa bộ lọc.') => {
    return `<div class="empty-state">${SG.renderIcon('ph-magnifying-glass')}<b>${SG.escapeHtml(title)}</b><p>${SG.escapeHtml(hint)}</p></div>`;
  };
  let toastTimer;

  SG.toast = (message, kind = 'success') => {
    clearTimeout(toastTimer);
    const element = select('#toast');
    element.innerHTML = SG.renderIcon(kind === 'error' ? 'ph-warning-circle' : 'ph-check-circle') + SG.escapeHtml(message);
    element.dataset.kind = kind;
    element.hidden = false;
    toastTimer = setTimeout(() => {
      return element.hidden = true;
    }, 4200);
  };

  SG.dialog = (title, body) => {
    const dialog = select('#dlg');
    dialog.innerHTML = [
      `<div class="section-head">`,
      `<h2 id="dialog-title">${SG.escapeHtml(title)}</h2>`,
      `<button type="button" class="icon-btn" data-close aria-label="Đóng hộp thoại">${SG.renderIcon('ph-x')}</button>`,
      `</div>${body}`
    ].join('');
    dialog.querySelectorAll('[data-close]').forEach(button => {
      button.onclick = () => {
        return dialog.close();
      };
    });
    if (!dialog.open) {
      dialog.showModal();
    }
    return dialog;
  };

  SG.pager = (selector, state, total, redraw) => {
    const element = select(selector);
    const pageCount = Math.max(1, Math.ceil(total / state.size));
    state.page = Math.min(Math.max(1, state.page), pageCount);
    // Giữ các nút và select để cập nhật nền không làm mất focus bàn phím.
    if (!element.children.length) {
      const pageSizeOptions = [10, 20, 50].map(pageSize => {
        return `<option value="${pageSize}">${pageSize}</option>`;
      }).join('');
      element.innerHTML = [
        `<span class="pager-count">`,
        `</span>`,
        `<div class="pager-controls">`,
        `<label class="per-page">Mỗi trang <select aria-label="Số bản ghi mỗi trang">${pageSizeOptions}</select>`,
        `</label>`,
        `<div class="page-buttons">`,
        `<button class="icon-btn" data-n="-1" aria-label="Trang trước">${SG.renderIcon('ph-caret-left')}</button>`,
        `<span class="pager-range" aria-live="polite">`,
        `</span>`,
        `<button class="icon-btn" data-n="1" aria-label="Trang sau">${SG.renderIcon('ph-caret-right')}</button>`,
        `</div>`,
        `</div>`
      ].join('');

      element.querySelector('select').onchange = event => {
        state.size = +event.target.value;
        state.page = 1;
        redraw();
      };
      element.querySelectorAll('[data-n]').forEach(button => {
        button.onclick = () => {
          state.page += +button.dataset.n;
          redraw();
        };
      });
    }
    const start = total ? (state.page - 1) * state.size + 1 : 0;
    const end = Math.min(total, state.page * state.size);
    element.querySelector('.pager-count').textContent = `${start}–${end} trong ${total} bản ghi`;
    element.querySelector('select').value = String(state.size);
    element.querySelector('.pager-range').textContent = `Trang ${state.page} / ${pageCount}`;
    element.querySelector('[data-n="-1"]').disabled = state.page <= 1;
    element.querySelector('[data-n="1"]').disabled = state.page >= pageCount;
  };
})();
