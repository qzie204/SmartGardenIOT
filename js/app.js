/* Khung ứng dụng, điều hướng và phiên đăng nhập backend. */
(function () {
  const select = SG.select;
  const state = SG.state;
  const pages = {
    home: 'Tổng quan',
    data: 'Dữ liệu cảm biến',
    history: 'Lịch sử điều khiển',
    profile: 'Hồ sơ'
  };

  function closeMenu(focus = false) {
    const wasOpen = select('#side').classList.contains('open');
    select('#side').classList.remove('open');
    select('#scrim').classList.remove('open');
    select('#menu').setAttribute('aria-expanded', 'false');
    select('.workspace').inert = false;
    document.body.style.overflow = '';
    select('#side').inert = window.innerWidth <= 1000;
    if (focus && wasOpen) {
      select('#menu').focus();
    }
  }

  function openMenu() {
    select('#side').inert = false;
    select('#side').classList.add('open');
    select('#scrim').classList.add('open');
    select('#menu').setAttribute('aria-expanded', 'true');
    select('.workspace').inert = true;
    document.body.style.overflow = 'hidden';
    select('#close-menu').focus();
  }

  function navigateToPage(page, focus = true) {
    if (!pages[page]) {
      page = 'home';
    }
    SG.currentPage = page;
    Object.keys(pages).forEach(key => {
      select('#p-' + key).classList.toggle('hide', key !== page);
    });
    document.querySelectorAll('.side nav [data-p]').forEach(button => {
      if (button.dataset.p === page) {
        button.setAttribute('aria-current', 'page');
      } else {
        button.removeAttribute('aria-current');
      }
    });
    const title = pages[page];
    select('#crumb').textContent = title;
    select('#page-title').textContent = title;
    document.title = title + ' · Smart Garden';
    closeMenu();
    const renderPage = {
      home: SG.renderHome,
      data: SG.renderData,
      history: SG.renderHist,
      profile: SG.renderProfile
    }[page];
    renderPage();
    if (focus) {
      select('#page-title').focus({
        preventScroll: true
      });
      window.scrollTo({
        top: 0,
        behavior: 'instant'
      });
    }
  }

  SG.go = navigateToPage;
  document.querySelectorAll('.side nav [data-p]').forEach(button => {
    button.onclick = () => {
      return SG.go(button.dataset.p);
    };
  });
  select('#menu').onclick = openMenu;

  select('#close-menu').onclick = () => {
    return closeMenu(true);
  };

  select('#scrim').onclick = () => {
    return closeMenu(true);
  };

  select('#profile-shortcut').onclick = () => {
    return SG.go('profile');
  };

  function handleMenuKeyDown(event) {
    if (!select('#side').classList.contains('open')) {
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      closeMenu(true);
    }
    if (event.key === 'Tab') {
      const targets = [...select('#side').querySelectorAll('button:not(:disabled)')].filter(element => {
        return element.offsetParent !== null;
      });
      const first = targets[0];
      const last = targets.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  }

  document.addEventListener('keydown', handleMenuKeyDown);
  window.addEventListener('resize', () => {
    if (window.innerWidth > 1000 || !select('#side').classList.contains('open')) {
      closeMenu();
    }
  });

  function startSession(username) {
    state.user = username;
    SG.loadProfile(username);
    select('#auth').classList.add('hide');
    select('#app').classList.remove('hide');
    SG.updateIdentity();
    SG.go('home');
  }

  function notifyCommandResult(command) {
    if (!state.user) {
      return;
    }
    const successful = command.result === 'success';
    const message = successful
      ? `${SG.getActionLabel(command.action)} ${SG.DEV[command.device].name.toLowerCase()} thành công.`
      : command.reason;
    SG.toast(message, successful ? 'success' : 'error');
  }

  async function restoreSession() {
    try {
      const user = await SG.api.restore();
      if (user) {
        SG.start(user.username);
      }
    } catch (error) {
      select('#le').textContent = error.message;
    }
  }

  SG.start = startSession;
  SG.on('complete', notifyCommandResult);
  SG.on('expired', function showLoginAgain() {
    state.user = null;
    select('#app').classList.add('hide');
    select('#auth').classList.remove('hide');
    select('#le').textContent = 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.';
  });
  closeMenu();
  restoreSession();
})();
