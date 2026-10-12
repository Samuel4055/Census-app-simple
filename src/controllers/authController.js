const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../db');
const { logAudit } = require('../utils/audit');

async function login(req, res) {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  const [rows] = await pool.query(
    `SELECT id, username, password_hash, full_name, role, census_centre_id, enumeration_area_id, is_active
     FROM users WHERE username = ?`,
    [username]
  );
  const user = rows[0];

  if (!user || !user.is_active) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const passwordMatches = await bcrypt.compare(password, user.password_hash);
  if (!passwordMatches) {
    await logAudit({ userId: user.id, action: 'LOGIN_FAILED', entityType: 'user', entityId: user.id });
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const tokenPayload = {
    id: user.id,
    username: user.username,
    role: user.role,
    censusCentreId: user.census_centre_id,
    enumerationAreaId: user.enumeration_area_id,
  };
  const token = jwt.sign(tokenPayload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '8h',
  });

  await logAudit({ userId: user.id, action: 'LOGIN_SUCCESS', entityType: 'user', entityId: user.id });

  return res.json({
    token,
    user: {
      id: user.id,
      username: user.username,
      fullName: user.full_name,
      role: user.role,
      censusCentreId: user.census_centre_id,
      enumerationAreaId: user.enumeration_area_id,
    },
  });
}

async function me(req, res) {
  return res.json({ user: req.user });
}

module.exports = { login, me };
