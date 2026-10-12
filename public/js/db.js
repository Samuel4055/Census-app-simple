const CensusDB = (function () {
  const DB_NAME = 'census-offline-db';
  const DB_VERSION = 1;

  function openDb() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('householdQueue')) {
          db.createObjectStore('householdQueue', { keyPath: 'clientUuid' });
        }
        if (!db.objectStoreNames.contains('enumerationAreas')) {
          db.createObjectStore('enumerationAreas', { keyPath: 'id' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async function addQueued(record) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('householdQueue', 'readwrite');
      tx.objectStore('householdQueue').add(record);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async function getAllQueued() {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('householdQueue', 'readonly');
      const req = tx.objectStore('householdQueue').getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async function getQueuedByStatus(status) {
    const all = await getAllQueued();
    return all.filter((r) => r.status === status);
  }

  async function updateQueued(clientUuid, changes) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('householdQueue', 'readwrite');
      const store = tx.objectStore('householdQueue');
      const getReq = store.get(clientUuid);
      getReq.onsuccess = () => {
        if (getReq.result) store.put({ ...getReq.result, ...changes });
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async function deleteQueued(clientUuid) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('householdQueue', 'readwrite');
      tx.objectStore('householdQueue').delete(clientUuid);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async function putBoundary(id, record) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('enumerationAreas', 'readwrite');
      tx.objectStore('enumerationAreas').put({ id, ...record });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async function getBoundary(id) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('enumerationAreas', 'readonly');
      const req = tx.objectStore('enumerationAreas').get(id);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  return { addQueued, getAllQueued, getQueuedByStatus, updateQueued, deleteQueued, putBoundary, getBoundary };
})();
