// /js/include-header.js
(async function () {
  const host = '';

  async function loadText(url) {
    const res = await fetch(url, { credentials: 'same-origin' });
    if (!res.ok) throw new Error(`Fetch failed ${res.status}: ${url}`);
    return res.text();
  }

  async function ensureBootstrapOnce() {
    if (window.bootstrap) return;
    await new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js';
      s.onload = resolve;
      s.onerror = reject;
      document.body.appendChild(s);
    });
  }

  // 1) ใส่ header
  try {
    const mount = document.getElementById('site-header');
    if (mount) {
      const html = await loadText(`${host}/components/header.html`);
      mount.innerHTML = html;
      console.debug('[include-header] header injected');
    } else {
      console.warn('[include-header] #site-header not found');
    }
  } catch (e) {
    console.error('[include-header] Load header failed:', e);
  }

  // 2) ใส่ modal ถ้ายังไม่มี
  try {
    if (!document.getElementById('logoutConfirmModal')) {
      const modalHtml = await loadText(`${host}/components/logout-modal.html`);
      const frag = document.createElement('div');
      frag.innerHTML = modalHtml;
      document.body.appendChild(frag.firstElementChild);
      console.debug('[include-header] logout modal injected');
    }
  } catch (e) {
    console.error('[include-header] Load modal failed:', e);
  }

  // 3) ตั้ง headerindex
  try {
    const el = document.querySelector('.headerindex');
    if (el) {
      const path = location.pathname.toLowerCase();
      const map = [
        ['/chem/index.html', 'สารเคมี'],
        ['/chem/create.html', 'เพิ่มสารเคมี'],
        ['/chem/edit.html', 'แก้ไขสารเคมี'],
        ['/brand/index.html', 'แบรนด์'],
      ];
      const hit = map.find(([p]) => path.endsWith(p));
      el.textContent = hit ? hit[1] : (document.title || '');
      console.debug('[include-header] headerindex set:', el.textContent);
    }
  } catch (e) {
    console.warn('[include-header] headerindex failed:', e);
  }

  // 4) ให้แน่ใจว่า Bootstrap พร้อม
  try {
    await ensureBootstrapOnce();
  } catch (e) {
    console.error('[include-header] load bootstrap failed:', e);
  }

  // 5) โหลด login-logout.js แค่ครั้งเดียว
  function ensureScriptOnce(src, id) {
    if (id && document.getElementById(id)) return Promise.resolve();
    if ([...document.scripts].some(s => s.src.includes(src))) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      if (id) s.id = id;
      s.src = src;
      s.defer = true;
      s.onload = resolve;
      s.onerror = reject;
      document.body.appendChild(s);
    });
  }

  try {
    await ensureScriptOnce('/js/login-logout.js', 'login-logout-js');
    console.debug('[include-header] login-logout.js loaded');
  } catch (e) {
    console.error('[include-header] load login-logout.js failed:', e);
  }

  // 6) ประกาศว่า header พร้อมใช้งานแล้ว
  document.dispatchEvent(new CustomEvent('header:ready'));
  console.debug('[include-header] dispatched header:ready');
})();
