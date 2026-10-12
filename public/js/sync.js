let syncInFlight = false;

async function syncQueue() {
  if (syncInFlight || !navigator.onLine) {
    return { synced: 0, rejected: 0, skipped: true };
  }
  syncInFlight = true;

  try {
    const pending = await CensusDB.getQueuedByStatus('queued');
    if (pending.length === 0) {
      return { synced: 0, rejected: 0, skipped: false };
    }

    const { results } = await apiFetch('/households/sync', {
      method: 'POST',
      body: { deviceId: getOrCreateDeviceId(), records: pending.map((p) => p.data) },
    });

    let synced = 0;
    let rejected = 0;

    for (const result of results) {
      if (result.status === 'synced' || result.status === 'already_synced') {
        await CensusDB.deleteQueued(result.clientUuid);
        synced += 1;
      } else {
        await CensusDB.updateQueued(result.clientUuid, { status: 'rejected', issues: result.issues || [] });
        rejected += 1;
      }
    }

    notifyQueueChanged();
    return { synced, rejected, skipped: false };
  } finally {
    syncInFlight = false;
  }
}
