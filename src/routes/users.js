const express = require('express');
const bcrypt = require('bcryptjs');
const pool = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { logAudit } = require('../utils/audit');

const router = express.Router();

router.post('/', requireAuth, requireRole('administrator'), async (req, res) => {
  const { username, password, fullName, role, censusCentreId, enumerationAreaId, supervisorId } = req.body;

  if (!username || !password || !fullName || !role) {
    return res.status(400).json({ error: 'username, password, fullName and role are required' });
  }

  const passwordHash = await bcrypt.hash(password, 12);

  try {
    const [result] = await pool.query(
      `INSERT INTO users (username, password_hash, full_name, role, census_centre_id, enumeration_area_id, supervisor_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [username, passwordHash, fullName, role, censusCentreId || null, enumerationAreaId || null, supervisorId || null]
    );

    await logAudit({
      userId: req.user.id,
      action: 'USER_CREATED',
      entityType: 'user',
      entityId: result.insertId,
      details: { role },
    });

    return res.status(201).json({
      user: { id: result.insertId, username, fullName, role, censusCentreId, enumerationAreaId },
    });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Username already exists' });
    }
    throw err;
  }
});

router.get('/', requireAuth, requireRole('supervisor', 'administrator'), async (req, res) => {
  const [rows] = await pool.query(
    `SELECT id, username, full_name, role, census_centre_id, enumeration_area_id, is_active
     FROM users ORDER BY id`
  );
  return res.json({ users: rows });
});

module.exports = router;
