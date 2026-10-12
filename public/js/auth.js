function getToken() {
  return localStorage.getItem('census_token');
}

function getUser() {
  const raw = localStorage.getItem('census_user');
  return raw ? JSON.parse(raw) : null;
}

function setSession(token, user) {
  localStorage.setItem('census_token', token);
  localStorage.setItem('census_user', JSON.stringify(user));
}

function clearSession() {
  localStorage.removeItem('census_token');
  localStorage.removeItem('census_user');
}

function homeForRole(role) {
  return role === 'enumerator' ? '/capture.html' : '/dashboard.html';
}

// Call at the top of any protected page. Redirects away if not
// authenticated, or not in an allowed role for that page.
function requireRole(allowedRoles) {
  const user = getUser();
  if (!user) {
    window.location.href = '/login.html';
    return null;
  }
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    window.location.href = homeForRole(user.role);
    return null;
  }
  return user;
}
