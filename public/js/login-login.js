// public/js/login-login.js
async function login() {
  const btn = document.querySelector('.btn');
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;

  btn.disabled = true;
  try {
    const res = await fetch('/api/user/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email, password })
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'อีเมลหรือรหัสผ่านไม่ถูกต้อง');
    }

    window.location.href = '../chem/index.html';
  } catch (e) {
    alert(e.message);
  } finally {
    btn.disabled = false;
  }
}
