const QUEUE_UPDATED_EVENT = 'census-queue-updated';

function notifyQueueChanged() {
  window.dispatchEvent(new Event(QUEUE_UPDATED_EVENT));
}

function getOrCreateDeviceId() {
  let deviceId = localStorage.getItem('census_device_id');
  if (!deviceId) {
    deviceId = crypto.randomUUID();
    localStorage.setItem('census_device_id', deviceId);
  }
  return deviceId;
}

async function getQueueCounts() {
  const [queued, rejected] = await Promise.all([
    CensusDB.getQueuedByStatus('queued'),
    CensusDB.getQueuedByStatus('rejected'),
  ]);
  return { queued: queued.length, rejected: rejected.length };
}
