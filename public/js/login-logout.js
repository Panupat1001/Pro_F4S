// /js/login-logout.js
(function () {
  const LOG_PREFIX = '[login-logout]';

  function getEl() {
    return {
      btn: document.getElementById('btnLogout'),
      modalEl: document.getElementById('logoutConfirmModal'),
      modalOkBtn: document.getElementById('btnLogoutConfirm'),
    };
  }

  function getCsrfToken() {
    const el = document.querySelector('meta[name="csrf-token"]');
    return el ? el.getAttribute('content') : '';
  }

  async function callLogoutApi() {
    const headers = { 'Content-Type': 'application/json' };
    const csrf = getCsrfToken();
    if (csrf) headers['X-CSRF-Token'] = csrf;

    try {
      const res = await fetch('/api/logout', {
        method: 'POST',
        headers,
        credentials: 'include',
      });
      console.debug(LOG_PREFIX, 'logout api status', res.status);
    } catch (e) {
      console.warn(LOG_PREFIX, 'logout api error', e);
    }
  }

  function clearClientSideSession() {
    try {
      localStorage.removeItem('authToken');
      sessionStorage.clear();
    } catch (e) {
      console.warn(LOG_PREFIX, 'clear session failed', e);
    }
  }

  function goToLogin(redirectUrl) {
    window.location.replace(redirectUrl || '/login/login.html');
  }

  function askConfirm(bsModal, modalEl, modalOkBtn) {
    if (!bsModal || !modalEl || !modalOkBtn) {
      return Promise.resolve(window.confirm('คุณต้องการออกจากระบบใช่หรือไม่?'));
    }
    return new Promise((resolve) => {
      const onConfirm = () => {
        cleanup();
        resolve(true);
      };
      const onHidden = () => {
        cleanup();
        resolve(false);
      };
      function cleanup() {
        modalOkBtn.removeEventListener('click', onConfirm);
        modalEl.removeEventListener('hidden.bs.modal', onHidden);
      }
      modalOkBtn.addEventListener('click', onConfirm, { once: true });
      modalEl.addEventListener('hidden.bs.modal', onHidden, { once: true });
      bsModal.show();
    });
  }

  function bindLogout() {
    const { btn, modalEl, modalOkBtn } = getEl();
    if (!btn) {
      console.debug(LOG_PREFIX, '#btnLogout not found yet');
      return false;
    }

    // ป้องกัน bind ซ้ำ
    if (btn.dataset.bound === '1') return true;
    btn.dataset.bound = '1';

    const redirectUrl = btn.getAttribute('data-redirect') || '/login/login.html';
    let busy = false;

    // เตรียม Bootstrap modal ถ้ามี
    const bsModal = (window.bootstrap && modalEl)
      ? new bootstrap.Modal(modalEl)
      : null;

    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      if (busy) return;

      const ok = await askConfirm(bsModal, modalEl, modalOkBtn);
      if (!ok) return;

      busy = true;
      btn.setAttribute('aria-disabled', 'true');
      btn.style.pointerEvents = 'none';
      btn.style.opacity = '0.6';

      try {
        clearClientSideSession();
        await callLogoutApi();
        goToLogin(redirectUrl);
      } catch (err) {
        console.error(LOG_PREFIX, 'error', err);
        goToLogin(redirectUrl);
      }
    });

    console.debug(LOG_PREFIX, 'bound click handler on #btnLogout');
    return true;
  }

  // 1) พยายาม bind ทันที (ในกรณี header อยู่แล้ว)
  if (bindLogout()) return;

  // 2) รอ event จาก include-header ว่า header พร้อม
  document.addEventListener('header:ready', () => {
    console.debug(LOG_PREFIX, 'received header:ready');
    bindLogout();
  });

  // 3) สำรอง: จับตา DOM ถ้ามีการ inject ภายหลัง
  const mo = new MutationObserver(() => {
    if (bindLogout()) mo.disconnect();
  });
  mo.observe(document.documentElement, { childList: true, subtree: true });

  // 4) สำรองอีกชั้น: timeout ลอง bind อีกรอบ
  setTimeout(() => bindLogout(), 1500);
})();
