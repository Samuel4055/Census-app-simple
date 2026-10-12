let map;
let markers = [];
let selectedId = null;

const STATUS_COLORS = { synced: '#2471a3', approved: '#145a32', rejected: '#a93226' };

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function initMap() {
  if (typeof L === 'undefined') {
    document.getElementById('map').innerHTML =
      '<p style="padding:1rem;color:var(--color-text-muted);">The map could not be loaded. The household list below still works.</p>';
    return;
  }
  map = L.map('map').setView([10.29, 9.84], 12);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors',
  }).addTo(map);
}

function clearMarkers() {
  if (!map) return;
  markers.forEach((m) => map.removeLayer(m));
  markers = [];
}

function renderHouseholds(households) {
  clearMarkers();

  households.forEach((h) => {
    if (!map) return;
    const [lng, lat] = h.location.coordinates;
    const color = h.locationInBoundary === false ? '#b9770e' : STATUS_COLORS[h.status] || '#555';
    const marker = L.circleMarker([lat, lng], { radius: 7, color, fillOpacity: 0.8 }).addTo(map);
    marker.bindPopup(
      `<strong>${escapeHtml(h.headFullName)}</strong><br>${escapeHtml(h.enumerationAreaName)} · ${escapeHtml(h.status)}` +
        (h.locationInBoundary === false ? '<br><span style="color:#b9770e;">Outside boundary</span>' : '')
    );
    marker.on('click', () => openDetail(h.id));
    markers.push(marker);
  });

  if (map && households.length > 0) {
    const [lng, lat] = households[0].location.coordinates;
    map.setView([lat, lng], 13);
  }

  const tbody = document.getElementById('household-rows');
  if (households.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5">No households match this filter.</td></tr>';
    return;
  }
  tbody.innerHTML = households
    .map(
      (h) => `
        <tr data-clickable data-id="${h.id}">
          <td>${escapeHtml(h.headFullName)}</td>
          <td>${escapeHtml(h.enumerationAreaName)}</td>
          <td><span class="badge ${h.status}">${h.status}</span></td>
          <td>${h.locationInBoundary === false ? 'Outside boundary' : ''}</td>
          <td>${new Date(h.capturedAt).toLocaleString()}</td>
        </tr>`
    )
    .join('');

  tbody.querySelectorAll('tr[data-id]').forEach((row) => {
    row.addEventListener('click', () => openDetail(Number(row.dataset.id)));
  });
}

async function loadList() {
  const status = document.getElementById('status-filter').value;
  const query = status ? `?status=${status}` : '';
  const data = await apiFetch(`/households${query}`);
  renderHouseholds(data.households);
}

async function openDetail(id) {
  selectedId = id;
  const data = await apiFetch(`/households/${id}`);
  const card = document.getElementById('detail-card');
  card.style.display = 'block';

  const membersRows = data.individuals
    .map((p) => `<tr><td>${escapeHtml(p.full_name)}</td><td>${p.age}</td><td>${p.sex}</td><td>${escapeHtml(p.relationship_to_head)}</td></tr>`)
    .join('');

  const issuesHtml = data.validationIssues.length
    ? `<h4>Validation flags</h4><ul class="issue-list" style="color:var(--color-warning);">${data.validationIssues
        .map((v) => `<li>[${escapeHtml(v.rule_type)}] ${escapeHtml(v.message)}</li>`)
        .join('')}</ul>`
    : '';

  card.innerHTML = `
    <h3 style="margin-top:0;">${escapeHtml(data.household.head_full_name)}</h3>
    <p>${escapeHtml(data.household.address)}</p>
    <h4>Members</h4>
    <table>
      <thead><tr><th>Name</th><th>Age</th><th>Sex</th><th>Relationship</th></tr></thead>
      <tbody>${membersRows}</tbody>
    </table>
    ${issuesHtml}
    <div style="display:flex; gap:0.5rem; margin-top:1rem;">
      <button id="approve-btn">Approve</button>
      <button class="danger" id="reject-btn">Reject</button>
      <button class="secondary" id="close-detail-btn">Close</button>
    </div>
  `;

  document.getElementById('approve-btn').addEventListener('click', () => review('approved'));
  document.getElementById('reject-btn').addEventListener('click', () => review('rejected'));
  document.getElementById('close-detail-btn').addEventListener('click', () => {
    card.style.display = 'none';
    selectedId = null;
  });
}

async function review(status) {
  if (!selectedId) return;
  await apiFetch(`/households/${selectedId}/status`, { method: 'PATCH', body: { status } });
  document.getElementById('detail-card').style.display = 'none';
  selectedId = null;
  loadList();
}

document.addEventListener('DOMContentLoaded', () => {
  const user = requireRole(['supervisor', 'administrator']);
  if (!user) return;

  initMap();
  loadList();
  document.getElementById('status-filter').addEventListener('change', loadList);
});
