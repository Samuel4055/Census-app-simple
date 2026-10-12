const API_BASE = '/api';

async function apiFetch(path, { method = 'GET', body } = {}) {
  const token = localStorage.getItem('census_token');

  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(data.error || `Request failed (${response.status})`);
    error.status = response.status;
    error.issues = data.issues;
    throw error;
  }

  return data;
}
