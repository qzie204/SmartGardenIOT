/* Hồ sơ: lưu qua backend, xử lý ảnh và dựng các thành phần của trang. */
(function () {
  const select = SG.select;
  const fields = [
    ['name', 'Họ và tên', 'text'],
    ['studentId', 'Mã sinh viên', 'text'],
    ['className', 'Lớp', 'text'],
    ['email', 'Email', 'email'],
    ['github', 'Liên kết GitHub', 'url'],
    ['figma', 'Liên kết Figma', 'url'],
    ['postman', 'Liên kết Postman', 'url'],
    ['report', 'Liên kết báo cáo PDF', 'url']
  ];
  const defaults = {
    ...SG.PROFILE,
    avatar: ''
  };
  const isValidAvatar = value => {
    return typeof value === 'string' && value.length < 500000 && /^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(value);
  };
  SG.loadProfile = function loadProfile() {
    Object.assign(SG.PROFILE, defaults, SG.api.userInfo());
  };

  function getInitial() {
    return (SG.PROFILE.name.trim().split(/\s+/).at(-1) || SG.state.user || 'U').charAt(0).toUpperCase();
  }

  function renderAvatar() {
    return isValidAvatar(SG.PROFILE.avatar) ? `<img src="${SG.PROFILE.avatar}" alt="Ảnh đại diện">` : SG.escapeHtml(getInitial());
  }

  async function saveProfile(next) {
    const profile = await SG.api.saveProfile(next);
    Object.assign(SG.PROFILE, profile);
    renderProfilePage();
    SG.updateIdentity();
  }

  SG.updateIdentity = () => {
    select('#side-name').textContent = SG.PROFILE.name || SG.state.user || 'Tài khoản';
    select('#side-avatar').innerHTML = renderAvatar();
    select('#profile-shortcut').innerHTML = renderAvatar();
  };

  function loadImage(url) {
    return new Promise((resolve, reject) => {
      const image = new Image();

      image.onload = () => {
        resolve(image);
      };

      image.onerror = () => {
        reject(new Error('Không đọc được ảnh. Vui lòng thử file khác.'));
      };
      image.src = url;
    });
  }

  function createAvatarDataUrl(image) {
    if (!image.naturalWidth || !image.naturalHeight) {
      throw new Error('Ảnh không hợp lệ.');
    }
    // Cắt giữa ảnh và thu nhỏ trước khi lưu; không đưa ảnh lên máy chủ.
    const avatarSize = 384;
    const cropSize = Math.min(image.naturalWidth, image.naturalHeight);
    const cropLeft = (image.naturalWidth - cropSize) / 2;
    const cropTop = (image.naturalHeight - cropSize) / 2;
    const canvas = document.createElement('canvas');
    canvas.width = avatarSize;
    canvas.height = avatarSize;
    const context = canvas.getContext('2d');
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, avatarSize, avatarSize);
    context.drawImage(image, cropLeft, cropTop, cropSize, cropSize, 0, 0, avatarSize, avatarSize);
    return canvas.toDataURL('image/jpeg', 0.86);
  }

  async function uploadAvatar(file) {
    if (!file) {
      return;
    }
    const error = select('#avatar-error');
    error.textContent = '';
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      error.textContent = 'Chọn ảnh JPG, PNG hoặc WebP.';
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      error.textContent = 'Ảnh tối đa 5 MB. Vui lòng chọn ảnh nhỏ hơn.';
      return;
    }
    const button = select('#upload-avatar');
    button.disabled = true;
    button.innerHTML = SG.renderIcon('ph-spinner spin') + ' Đang xử lý ảnh…';
    const url = URL.createObjectURL(file);
    try {
      const image = await loadImage(url);
      await saveProfile({ avatar: createAvatarDataUrl(image) });
      SG.toast('Đã cập nhật ảnh đại diện.');
    } catch (err) {
      select('#avatar-error').textContent = err.message;
    } finally {
      URL.revokeObjectURL(url);
      const current = select('#upload-avatar');
      if (current) {
        current.disabled = false;
        current.innerHTML = SG.renderIcon('ph-upload-simple') + ' ' + (SG.PROFILE.avatar ? 'Đổi ảnh' : 'Thêm ảnh');
      }
    }
  }

  function renderProfileField([key, label, type]) {
    const isUrl = type === 'url';
    let autocomplete = '';
    if (key === 'name' || key === 'email') {
      autocomplete = `autocomplete="${key}"`;
    }
    return [
      `<label class="field ${isUrl ? 'full' : ''}">${label}`,
      `<input name="${key}" type="${type}" value="${SG.escapeHtml(SG.PROFILE[key])}"`,
      ` maxlength="${isUrl ? 500 : 120}" placeholder="${isUrl ? 'https://…' : 'Chưa cập nhật'}"`,
      ` ${autocomplete}>`,
      '</label>'
    ].join('');
  }

  function openProfileEditor() {
    const formFields = fields.map(renderProfileField).join('');
    const dialog = SG.dialog('Chỉnh sửa hồ sơ', [
      `<form id="profile-form">`,
      `<div class="form-grid">${formFields}</div>`,
      `<p class="err" id="profile-error" role="alert">`,
      `</p>`,
      `<div class="dialog-actions">`,
      `<button type="button" class="btn" data-close>Hủy</button>`,
      `<button type="submit" class="btn primary">Lưu thay đổi</button>`,
      `</div>`,
      `</form>`
    ].join(''));

    dialog.querySelector('form').onsubmit = async function submitProfile(event) {
      event.preventDefault();
      const data = new FormData(event.target);
      const next = {};
      for (const [key, label, type] of fields) {
        const value = String(data.get(key) || '').trim();
        if (type === 'url' && value && !SG.getSafeUrl(value)) {
          select('#profile-error').textContent = label + ' phải bắt đầu bằng http:// hoặc https://.';
          return;
        }
        next[key] = value;
      }
      try {
        await saveProfile(next);
        dialog.close();
        SG.toast('Đã lưu thay đổi hồ sơ.');
      } catch (error) {
        select('#profile-error').textContent = error.message;
      }
    };
  }

  function renderProfileCard() {
    const profile = SG.PROFILE;
    const removeAvatarButton = profile.avatar
      ? '<button class="text-btn muted" id="remove-avatar">Xóa ảnh</button>'
      : '';
    const details = [
      ['Mã sinh viên', profile.studentId],
      ['Lớp', profile.className],
      ['Email', profile.email]
    ];
    const detailRows = details.map(([label, value]) => {
      return `<div><dt>${label}</dt><dd>${SG.escapeHtml(value || 'Chưa cập nhật')}</dd></div>`;
    }).join('');
    select('#prof').innerHTML = [
      `<div class="avatar-editor">`,
      `<span class="avatar profile-avatar">${renderAvatar()}</span>`,
      `<button class="avatar-camera" id="avatar-camera" aria-label="Chọn ảnh đại diện">${SG.renderIcon('ph-camera')}</button>`,
      `</div>`,
      `<div class="avatar-actions">`,
      '<button class="text-btn" id="upload-avatar">',
      `${SG.renderIcon('ph-upload-simple')} ${profile.avatar ? 'Đổi ảnh' : 'Thêm ảnh'}</button>`,
      removeAvatarButton,
      '</div>',
      `<input type="file" id="avatar-file" accept="image/jpeg,image/png,image/webp" hidden>`,
      `<p class="avatar-hint">JPG, PNG, WebP · Tối đa 5 MB</p>`,
      `<p class="err" id="avatar-error" role="alert">`,
      `</p>`,
      `<h2>${SG.escapeHtml(profile.name || 'Hồ sơ của bạn')}</h2>`,
      `<p class="profile-user">@${SG.escapeHtml(SG.state.user || '')}</p>`,
      `<dl>${detailRows}</dl>`,
      `<button class="btn" id="edit-profile">${SG.renderIcon('ph-pencil-simple')} Chỉnh sửa hồ sơ</button>`,
      `<button class="text-btn" id="clear-profile" style="margin-top:14px">Xóa thông tin đã lưu</button>`
    ].join('');
  }

  function renderResourceLinks() {
    const profile = SG.PROFILE;
    const resources = [
      ['ph-github-logo', 'GitHub', 'Mã nguồn dự án', profile.github],
      ['ph-figma-logo', 'Figma', 'Thiết kế giao diện', profile.figma],
      ['ph-package', 'Postman', 'Tài liệu và bộ thử API', profile.postman],
      ['ph-file-pdf', 'Báo cáo PDF', 'Tài liệu dự án', profile.report]
    ];
    select('#links').innerHTML = resources.map(([icon, title, description, url]) => {
      const safe = SG.getSafeUrl(url);
      const tag = safe ? 'a' : 'div';
      const attributes = safe ? `href="${SG.escapeHtml(safe)}" target="_blank" rel="noopener noreferrer" aria-label="Mở ${title} trong tab mới"` : '';
      return [
        `<${tag} class="resource-link" ${attributes}>`,
        `<div class="resource-link-top">${SG.renderIcon(icon)}${SG.renderIcon(safe ? 'ph-arrow-up-right' : 'ph-minus')}</div>`,
        `<b>${title}</b>`,
        `<p>${description}</p>${safe ? '' : '<p>Chưa thêm liên kết</p>'}</${tag}>`
      ].join('');
    }).join('');
  }

  async function removeAvatar() {
    try {
      await saveProfile({ avatar: '' });
      SG.toast('Đã xóa ảnh đại diện.');
    } catch (error) {
      select('#avatar-error').textContent = error.message;
    }
  }

  async function confirmClearProfile() {
    try {
      await saveProfile(defaults);
      select('#dlg').close();
      SG.toast('Đã xóa thông tin hồ sơ đã lưu.');
    } catch (error) {
      select('#clear-error').textContent = error.message;
    }
  }

  function openClearProfileDialog() {
    SG.dialog('Xóa thông tin hồ sơ?', [
      '<p>Ảnh đại diện, tên, mã sinh viên, lớp, email và các liên kết đã lưu của tài khoản này sẽ được xóa.</p>',
      '<p class="err" id="clear-error" role="alert"></p>',
      '<div class="dialog-actions">',
      '<button class="btn" data-close>Giữ lại</button>',
      '<button class="btn primary" id="confirm-clear">Xóa thông tin</button>',
      '</div>'
    ].join(''));
    select('#confirm-clear').onclick = confirmClearProfile;
  }

  function bindProfileEvents() {
    select('#avatar-camera').onclick = select('#upload-avatar').onclick = () => {
      return select('#avatar-file').click();
    };

    select('#avatar-file').onchange = event => {
      const file = event.target.files[0];
      event.target.value = '';
      uploadAvatar(file);
    };
    if (select('#remove-avatar')) {
      select('#remove-avatar').onclick = removeAvatar;
    }
    select('#edit-profile').onclick = openProfileEditor;
    select('#clear-profile').onclick = openClearProfileDialog;
  }

  function renderProfilePage() {
    renderProfileCard();
    renderResourceLinks();
    bindProfileEvents();
  }

  SG.renderProfile = renderProfilePage;
})();
