function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

async function loadUsers() {
  const data = await apiFetch('/users');
  document.getElementById('user-rows').innerHTML = data.users
    .map(
      (u) => `
        <tr>
          <td>${escapeHtml(u.username)}</td>
          <td>${escapeHtml(u.full_name)}</td>
          <td>${escapeHtml(u.role)}</td>
          <td>${u.is_active ? 'Yes' : 'No'}</td>
        </tr>`
    )
    .join('');
}

document.addEventListener('DOMContentLoaded', () => {
  const user = requireRole(['administrator']);
  if (!user) return;

  loadUsers();

  const roleSelect = document.getElementById('role');
  const eaField = document.getElementById('ea-field');
  function syncEaVisibility() {
    eaField.style.display = roleSelect.value === 'enumerator' ? 'block' : 'none';
  }
  syncEaVisibility();
  roleSelect.addEventListener('change', syncEaVisibility);

  const form = document.getElementById('create-user-form');
  const errorBanner = document.getElementById('error-banner');
  const submitBtn = document.getElementById('submit-btn');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorBanner.style.display = 'none';
    submitBtn.disabled = true;
    submitBtn.textContent = 'Saving…';

    const censusCentreId = document.getElementById('censusCentreId').value;
    const enumerationAreaId = document.getElementById('enumerationAreaId').value;

    try {
      await apiFetch('/users', {
        method: 'POST',
        body: {
          username: document.getElementById('username').value,
          password: document.getElementById('password').value,
          fullName: document.getElementById('fullName').value,
          role: roleSelect.value,
          censusCentreId: censusCentreId ? Number(censusCentreId) : null,
          enumerationAreaId: enumerationAreaId ? Number(enumerationAreaId) : null,
        },
      });
      form.reset();
      syncEaVisibility();
      loadUsers();
    } catch (err) {
      errorBanner.textContent = err.message;
      errorBanner.style.display = 'block';
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Create user';
    }
  });
});
