function renderTopbar() {
  const mount = document.getElementById('topbar');
  if (!mount) return;

  const user = getUser();

  mount.innerHTML = `
    <nav>
      <a href="/">Census Collector</a>
      ${user?.role === 'enumerator' ? '<a href="/capture.html">Capture</a>' : ''}
      ${user?.role === 'supervisor' || user?.role === 'administrator' ? '<a href="/dashboard.html">Dashboard</a>' : ''}
      ${user?.role === 'administrator' ? '<a href="/admin-users.html">Users</a>' : ''}
    </nav>
    <div style="display:flex; align-items:center; gap:0.75rem;">
      <span id="connectivity-pill" class="status-pill"></span>
      ${user?.role === 'enumerator' ? '<span id="queue-pill" class="status-pill" style="display:none;"></span>' : ''}
      ${user ? '<button class="secondary" id="signout-btn">Sign out</button>' : ''}
    </div>
  `;

  const pill = document.getElementById('connectivity-pill');
  function paintConnectivity() {
    pill.textContent = navigator.onLine ? 'Online' : 'Offline';
    pill.className = `status-pill ${navigator.onLine ? 'online' : 'offline'}`;
  }
  paintConnectivity();
  window.addEventListener('online', () => {
    paintConnectivity();
    if (typeof syncQueue === 'function') syncQueue().then(refreshQueuePill);
  });
  window.addEventListener('offline', paintConnectivity);

  const queuePill = document.getElementById('queue-pill');
  async function refreshQueuePill() {
    if (!queuePill || typeof getQueueCounts !== 'function') return;
    const { queued } = await getQueueCounts();
    queuePill.style.display = queued > 0 ? 'inline-block' : 'none';
    queuePill.textContent = `${queued} pending`;
  }
  refreshQueuePill();
  window.addEventListener(QUEUE_UPDATED_EVENT, refreshQueuePill);

  const signoutBtn = document.getElementById('signout-btn');
  if (signoutBtn) {
    signoutBtn.addEventListener('click', () => {
      clearSession();
      window.location.href = '/login.html';
    });
  }
}

document.addEventListener('DOMContentLoaded', renderTopbar);
