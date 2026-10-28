/* Các biểu mẫu đăng nhập, đăng ký và quên mật khẩu. */
(function () {
  const select = SG.select;

  function togglePassword(button, input, label = 'mật khẩu') {
    const visible = input.type === 'password';
    input.type = visible ? 'text' : 'password';
    button.innerHTML = SG.renderIcon(visible ? 'ph-eye-slash' : 'ph-eye');
    button.setAttribute('aria-label', (visible ? 'Ẩn ' : 'Hiện ') + label);
    button.setAttribute('aria-pressed', String(visible));
  }

  select('#lt').onclick = () => {
    return togglePassword(select('#lt'), select('#lp'));
  };
  document.querySelectorAll('[data-password]').forEach(button => {
    button.onclick = () => {
      return togglePassword(button, document.getElementById(button.dataset.password), button.dataset.password === 'rc' ? 'mật khẩu nhập lại' : 'mật khẩu');
    };
  });

  function showAuth(id) {
    ['lf', 'rf', 'ff'].forEach(key => {
      select('#' + key).classList.toggle('hide', id !== key);
    });
    select('#auth-success').hidden = true;
    select('#le').textContent = '';
    select('#r-error').textContent = '';
    select('#fr').textContent = '';
    select('#fm').hidden = true;
    ({
      lf: select('#lu'),
      rf: select('#rn'),
      ff: select('#fe')
    })[id].focus();
  }

  select('#open-register').onclick = () => {
    return showAuth('rf');
  };

  select('#register-back').onclick = () => {
    return showAuth('lf');
  };

  async function handleRegisterSubmit(event) {
    event.preventDefault();
    if (select('#r-submit').disabled) {
      return;
    }
    select('#r-error').textContent = '';
    select('#r-submit').disabled = true;
    select('#r-submit').innerHTML = SG.renderIcon('ph-spinner spin') + ' Đang tạo tài khoản…';
    try {
      const result = await SG.api.register({
        name: select('#rn').value,
        email: select('#re').value,
        username: select('#ru').value,
        password: select('#rp').value,
        confirm: select('#rc').value
      });
      select('#rf').reset();
      showAuth('lf');
      select('#lu').value = result.username;
      select('#lp').value = '';
      select('#auth-success').textContent = 'Đăng ký thành công. Bạn có thể đăng nhập bằng tài khoản vừa tạo.';
      select('#auth-success').hidden = false;
      select('#lp').focus();
    } catch (error) {
      select('#r-error').textContent = error.message;
    } finally {
      select('#r-submit').disabled = false;
      select('#r-submit').innerHTML = 'Đăng ký ' + SG.renderIcon('ph-arrow-right');
    }
  }

  async function handleLoginSubmit(event) {
    event.preventDefault();
    if (select('#lb').disabled) {
      return;
    }
    const username = select('#lu').value.trim();
    const password = select('#lp').value;
    if (!username || !password) {
      select('#le').textContent = 'Vui lòng nhập tài khoản và mật khẩu.';
      (!username ? select('#lu') : select('#lp')).focus();
      return;
    }
    select('#le').textContent = '';
    select('#lb').disabled = true;
    select('#lb').innerHTML = SG.renderIcon('ph-spinner spin') + ' Đang đăng nhập…';
    try {
      const result = await SG.api.login(username, password, select('#lr').checked);
      SG.start(result.username);
    } catch (error) {
      select('#le').textContent = error.message;
      select('#lp').focus();
    } finally {
      select('#lb').disabled = false;
      select('#lb').innerHTML = 'Đăng nhập ' + SG.renderIcon('ph-arrow-right');
    }
  }

  select('#lf-forgot').onclick = () => {
    return showAuth('ff');
  };

  select('#fback').onclick = () => {
    return showAuth('lf');
  };

  async function handleForgotPasswordSubmit(event) {
    event.preventDefault();
    if (select('#fb').disabled) {
      return;
    }
    const value = select('#fe').value.trim();
    if (!value) {
      select('#fr').textContent = 'Vui lòng nhập tài khoản hoặc email.';
      return;
    }
    if (value.includes('@') && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      select('#fr').textContent = 'Email chưa đúng định dạng.';
      return;
    }
    select('#fr').textContent = '';
    select('#fm').hidden = true;
    select('#fb').disabled = true;
    select('#fb').textContent = 'Đang xử lý…';
    try {
      await SG.api.forgot(value);
      select('#fm').hidden = false;
      select('#fm').textContent = 'Yêu cầu đã được xử lý.';
    } catch (error) {
      select('#fr').textContent = error.message;
    } finally {
      select('#fb').disabled = false;
      select('#fb').textContent = 'Thử yêu cầu khôi phục';
    }
  }

  async function handleLogout() {
    try {
      await SG.api.logout();
    } catch (_) {
      // Token cục bộ đã xóa; token trên server tự hết hạn sau tối đa 24 giờ.
    }
    SG.storage.remove('sg_user');
    SG.storage.remove('sg_user', 'sessionStorage');
    location.reload();
  }

  // Mỗi biểu mẫu có một hàm xử lý riêng.
  select('#rf').onsubmit = handleRegisterSubmit;
  select('#lf').onsubmit = handleLoginSubmit;
  select('#ff').onsubmit = handleForgotPasswordSubmit;
  select('#logout').onclick = handleLogout;
})();
