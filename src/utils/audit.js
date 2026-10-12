const pool = require('../db');

async function logAudit({ userId, action, entityType, entityId, details }) {
  try {
    await pool.query(
      `INSERT INTO audit_trail (user_id, action, entity_type, entity_id, details)
       VALUES (?, ?, ?, ?, ?)`,
      [
        userId ?? null,
        action,
        entityType ?? null,
        entityId ?? null,
        details ? JSON.stringify(details) : null,
      ]
    );
  } catch (err) {
    console.error('Failed to write audit log entry', err);
  }
}

module.exports = { logAudit };
