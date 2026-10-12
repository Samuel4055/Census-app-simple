document.addEventListener('DOMContentLoaded', () => {
  const existingUser = getUser();
  if (existingUser) {
    window.location.replace(homeForRole(existingUser.role));
    return;
  }

  document.getElementById('offline-banner').style.display = navigator.onLine ? 'none' : 'block';

  const form = document.getElementById('login-form');
  const errorBanner = document.getElementById('error-banner');
  const submitBtn = document.getElementById('submit-btn');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorBanner.style.display = 'none';
    submitBtn.disabled = true;
    submitBtn.textContent = 'Signing in…';

    try {
      const username = document.getElementById('username').value;
      const password = document.getElementById('password').value;
      const data = await apiFetch('/auth/login', { method: 'POST', body: { username, password } });
      setSession(data.token, data.user);
      window.location.href = homeForRole(data.user.role);
    } catch (err) {
      errorBanner.textContent = err.message;
      errorBanner.style.display = 'block';
      submitBtn.disabled = false;
      submitBtn.textContent = 'Sign in';
    }
  });
});
