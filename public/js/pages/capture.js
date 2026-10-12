let boundary = null;
let gpsPoint = null; // { latitude, longitude }
let members = [];

function emptyMember(relationshipToHead = '') {
  return { fullName: '', age: '', sex: '', relationshipToHead, maritalStatus: '', educationLevel: '', occupation: '' };
}

function renderMembers() {
  const container = document.getElementById('members-container');
  container.innerHTML = '';

  members.forEach((member, idx) => {
    const row = document.createElement('div');
    row.className = 'member-row';
    row.innerHTML = `
      <div>
        <label>Full name</label>
        <input data-field="fullName" value="${escapeHtml(member.fullName)}" />
      </div>
      <div>
        <label>Age</label>
        <input data-field="age" type="number" min="0" max="130" value="${escapeHtml(member.age)}" />
      </div>
      <div>
        <label>Sex</label>
        <select data-field="sex">
          <option value="">—</option>
          <option value="M" ${member.sex === 'M' ? 'selected' : ''}>M</option>
          <option value="F" ${member.sex === 'F' ? 'selected' : ''}>F</option>
        </select>
      </div>
      <div>
        <label>Relationship to head</label>
        <input data-field="relationshipToHead" value="${escapeHtml(member.relationshipToHead)}" placeholder="Head / Spouse / Child…" />
      </div>
      <div>
        <label>Marital status</label>
        <input data-field="maritalStatus" value="${escapeHtml(member.maritalStatus)}" />
      </div>
      <div>
        <label>Education level</label>
        <input data-field="educationLevel" value="${escapeHtml(member.educationLevel)}" />
      </div>
      <div>
        <label>Occupation</label>
        <input data-field="occupation" value="${escapeHtml(member.occupation)}" />
      </div>
      ${members.length > 1 ? '<button type="button" class="danger" data-action="remove">Remove</button>' : ''}
    `;

    row.querySelectorAll('[data-field]').forEach((el) => {
      el.addEventListener('input', () => {
        members[idx][el.dataset.field] = el.value;
      });
    });
    const removeBtn = row.querySelector('[data-action="remove"]');
    if (removeBtn) {
      removeBtn.addEventListener('click', () => {
        members.splice(idx, 1);
        renderMembers();
      });
    }

    container.appendChild(row);
  });
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

async function loadBoundary(user) {
  const cached = await CensusDB.getBoundary(user.enumerationAreaId);
  if (cached) boundary = cached.boundary;

  if (navigator.onLine) {
    try {
      const data = await apiFetch(`/enumeration-areas?censusCentreId=${user.censusCentreId}`);
      const mine = data.enumerationAreas.find((ea) => ea.id === user.enumerationAreaId);
      if (mine) {
        await CensusDB.putBoundary(mine.id, { boundary: mine.boundary, name: mine.name, code: mine.code });
        boundary = mine.boundary;
      }
    } catch (err) {
      console.warn('Could not refresh enumeration area boundary', err);
    }
  }
}

async function refreshQueueSummary() {
  const { queued, rejected } = await getQueueCounts();
  document.getElementById('queue-summary').innerHTML =
    `<strong>${queued}</strong> pending sync · <strong>${rejected}</strong> needs attention`;

  const rejectedRecords = await CensusDB.getQueuedByStatus('rejected');
  const rejectedCard = document.getElementById('rejected-card');
  const rejectedList = document.getElementById('rejected-list');

  if (rejectedRecords.length === 0) {
    rejectedCard.style.display = 'none';
    return;
  }
  rejectedCard.style.display = 'block';
  rejectedList.innerHTML = rejectedRecords
    .map(
      (r) => `
        <div style="margin-bottom:0.75rem;">
          <strong>${escapeHtml(r.data.headFullName)}</strong>
          <ul class="issue-list">${(r.issues || []).map((i) => `<li>${escapeHtml(i.message)}</li>`).join('')}</ul>
          <button class="danger" data-discard="${r.clientUuid}">Discard</button>
        </div>`
    )
    .join('');

  rejectedList.querySelectorAll('[data-discard]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      await CensusDB.deleteQueued(btn.dataset.discard);
      notifyQueueChanged();
    });
  });
}

function showBanner(id, message) {
  const el = document.getElementById(id);
  if (message) {
    if (id === 'save-banner') el.textContent = message;
    el.style.display = 'block';
  } else {
    el.style.display = 'none';
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  const user = requireRole(['enumerator']);
  if (!user) return;

  members = [emptyMember('Head')];
  renderMembers();
  await loadBoundary(user);
  await refreshQueueSummary();
  window.addEventListener(QUEUE_UPDATED_EVENT, refreshQueueSummary);

  document.getElementById('add-member-btn').addEventListener('click', () => {
    members.push(emptyMember());
    renderMembers();
  });

  const gpsBtn = document.getElementById('gps-btn');
  const gpsStatus = document.getElementById('gps-status');
  gpsBtn.addEventListener('click', () => {
    if (!navigator.geolocation) {
      gpsStatus.textContent = 'Not supported on this device';
      return;
    }
    gpsStatus.textContent = 'Locating…';
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        gpsPoint = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
        gpsStatus.textContent = `${gpsPoint.latitude.toFixed(5)}, ${gpsPoint.longitude.toFixed(5)}`;
        if (boundary) {
          const inside = isPointInBoundary(gpsPoint.latitude, gpsPoint.longitude, boundary);
          showBanner('boundary-banner', inside === false ? true : null);
        }
      },
      () => { gpsStatus.textContent = 'Location permission denied'; },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  });

  document.getElementById('sync-now-btn').addEventListener('click', async () => {
    const result = await syncQueue();
    showBanner('save-banner', result.skipped ? "Can't sync while offline." : `Synced ${result.synced}, ${result.rejected} rejected.`);
  });

  document.getElementById('capture-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    showBanner('save-banner', null);

    const payload = {
      clientUuid: crypto.randomUUID(),
      enumerationAreaId: user.enumerationAreaId,
      headFullName: document.getElementById('headFullName').value,
      address: document.getElementById('address').value,
      latitude: gpsPoint?.latitude,
      longitude: gpsPoint?.longitude,
      capturedAt: new Date().toISOString(),
      individuals: members.map((m) => ({ ...m, age: m.age === '' ? '' : Number(m.age) })),
    };

    const issues = validateStructure(payload);
    const issuesList = document.getElementById('issues-list');
    if (issues.length > 0) {
      issuesList.innerHTML = issues.map((i) => `<li>${escapeHtml(i.message)}</li>`).join('');
      showBanner('issues-banner', true);
      return;
    }
    showBanner('issues-banner', null);

    const existingQueue = await CensusDB.getAllQueued();
    const isDuplicate = findLocalDuplicate(payload, existingQueue.map((r) => r.data));
    showBanner('duplicate-banner', isDuplicate ? true : null);

    await CensusDB.addQueued({
      clientUuid: payload.clientUuid,
      enumerationAreaId: payload.enumerationAreaId,
      status: 'queued',
      createdAt: payload.capturedAt,
      data: payload,
    });
    notifyQueueChanged();

    // Reset form for the next household.
    document.getElementById('headFullName').value = '';
    document.getElementById('address').value = '';
    members = [emptyMember('Head')];
    renderMembers();
    gpsPoint = null;
    gpsStatus.textContent = 'Not captured yet';
    showBanner('boundary-banner', null);

    if (navigator.onLine) {
      const result = await syncQueue();
      showBanner('save-banner', result.synced > 0 ? 'Household saved and synced.' : 'Household saved — will sync shortly.');
    } else {
      showBanner('save-banner', "Household saved offline — will sync once you're back online.");
    }
  });
});
