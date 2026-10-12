const pool = require('../db');
const { logAudit } = require('../utils/audit');
const { validateStructure, validateAgainstDatabase } = require('../utils/householdValidation');

// The frontend expects GeoJSON-style points: coordinates are [lng, lat].
function toPoint(latitude, longitude) {
  return { type: 'Point', coordinates: [Number(longitude), Number(latitude)] };
}

async function insertHousehold(conn, payload, enumeratorId) {
  const structuralIssues = validateStructure(payload);
  if (structuralIssues.length > 0) {
    const err = new Error('Validation failed');
    err.issues = structuralIssues;
    throw err;
  }

  // A retried sync sends the same clientUuid; skip it instead of duplicating.
  const [existing] = await conn.query(`SELECT id FROM households WHERE client_uuid = ?`, [payload.clientUuid]);
  if (existing.length > 0) {
    return { skipped: true };
  }

  const { locationInBoundary, duplicateWarning } = await validateAgainstDatabase({
    enumerationAreaId: payload.enumerationAreaId,
    latitude: payload.latitude,
    longitude: payload.longitude,
    headFullName: payload.headFullName,
  });

  const [result] = await conn.query(
    `INSERT INTO households
       (client_uuid, enumeration_area_id, enumerator_id, head_full_name, address,
        latitude, longitude, location_in_boundary, status, captured_at, synced_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'synced', ?, NOW())`,
    [
      payload.clientUuid,
      payload.enumerationAreaId,
      enumeratorId,
      payload.headFullName.trim(),
      payload.address,
      payload.latitude,
      payload.longitude,
      locationInBoundary,
      payload.capturedAt.slice(0, 19).replace('T', ' '),
    ]
  );

  const householdId = result.insertId;

  for (const person of payload.individuals) {
    await conn.query(
      `INSERT INTO individuals
         (household_id, full_name, age, sex, relationship_to_head, marital_status, education_level, occupation)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        householdId,
        person.fullName,
        person.age,
        person.sex,
        person.relationshipToHead,
        person.maritalStatus || null,
        person.educationLevel || null,
        person.occupation || null,
      ]
    );
  }

  if (locationInBoundary === false) {
    await conn.query(
      `INSERT INTO validation_logs (household_id, rule_type, field_name, message)
       VALUES (?, 'logical_consistency', 'location', 'Capture point falls outside the assigned enumeration area boundary')`,
      [householdId]
    );
  }
  if (duplicateWarning) {
    await conn.query(
      `INSERT INTO validation_logs (household_id, rule_type, field_name, message)
       VALUES (?, 'duplication', 'headFullName', 'A household with the same head name exists within 50m')`,
      [householdId]
    );
  }

  return { skipped: false, householdId, locationInBoundary, duplicateWarning };
}

async function createHousehold(req, res) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const outcome = await insertHousehold(conn, req.body, req.user.id);
    await conn.commit();

    await logAudit({
      userId: req.user.id,
      action: 'HOUSEHOLD_CREATED',
      entityType: 'household',
      entityId: outcome.householdId,
      details: { duplicateWarning: outcome.duplicateWarning, locationInBoundary: outcome.locationInBoundary },
    });

    return res.status(201).json(outcome);
  } catch (err) {
    await conn.rollback();
    if (err.issues) return res.status(422).json({ error: 'Validation failed', issues: err.issues });
    throw err;
  } finally {
    conn.release();
  }
}

async function syncHouseholds(req, res) {
  const { deviceId, records } = req.body;
  if (!Array.isArray(records) || records.length === 0) {
    return res.status(400).json({ error: 'records must be a non-empty array' });
  }

  const conn = await pool.getConnection();
  const results = [];
  let failures = 0;

  try {
    for (const record of records) {
      try {
        await conn.beginTransaction();
        const outcome = await insertHousehold(conn, record, req.user.id);
        await conn.commit();
        results.push({ clientUuid: record.clientUuid, status: outcome.skipped ? 'already_synced' : 'synced' });
      } catch (err) {
        await conn.rollback();
        failures += 1;
        results.push({
          clientUuid: record.clientUuid,
          status: 'rejected',
          issues: err.issues || [{ message: err.message }],
        });
      }
    }

    await conn.query(
      `INSERT INTO sync_logs (user_id, device_id, records_count, status) VALUES (?, ?, ?, ?)`,
      [req.user.id, deviceId || null, records.length, failures === 0 ? 'success' : failures === records.length ? 'failed' : 'partial']
    );

    await logAudit({
      userId: req.user.id,
      action: 'SYNC_BATCH',
      entityType: 'sync',
      details: { deviceId, count: records.length, failures },
    });

    return res.json({ results });
  } finally {
    conn.release();
  }
}

async function listHouseholds(req, res) {
  const { status, enumerationAreaId } = req.query;
  const conditions = [];
  const params = [];
  if (status) {
    conditions.push('h.status = ?');
    params.push(status);
  }
  if (enumerationAreaId) {
    conditions.push('h.enumeration_area_id = ?');
    params.push(enumerationAreaId);
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const [rows] = await pool.query(
    `SELECT h.id, h.head_full_name, h.address, h.status, h.location_in_boundary,
            h.captured_at, h.synced_at, h.enumeration_area_id, h.latitude, h.longitude,
            ea.name AS enumeration_area_name
     FROM households h
     JOIN enumeration_areas ea ON ea.id = h.enumeration_area_id
     ${where}
     ORDER BY h.created_at DESC
     LIMIT 500`,
    params
  );

  const households = rows.map((row) => ({
    id: row.id,
    headFullName: row.head_full_name,
    address: row.address,
    status: row.status,
    locationInBoundary: row.location_in_boundary === null ? null : !!row.location_in_boundary,
    capturedAt: row.captured_at,
    syncedAt: row.synced_at,
    enumerationAreaId: row.enumeration_area_id,
    enumerationAreaName: row.enumeration_area_name,
    location: toPoint(row.latitude, row.longitude),
  }));

  return res.json({ households });
}

async function getHousehold(req, res) {
  const { id } = req.params;

  const [householdRows] = await pool.query(`SELECT * FROM households WHERE id = ?`, [id]);
  const household = householdRows[0];
  if (!household) return res.status(404).json({ error: 'Household not found' });

  const [individuals] = await pool.query(`SELECT * FROM individuals WHERE household_id = ? ORDER BY id`, [id]);
  const [validationIssues] = await pool.query(
    `SELECT * FROM validation_logs WHERE household_id = ? ORDER BY created_at DESC`,
    [id]
  );

  return res.json({
    household: { ...household, location: toPoint(household.latitude, household.longitude) },
    individuals,
    validationIssues,
  });
}

async function reviewHousehold(req, res) {
  const { id } = req.params;
  const { status } = req.body;
  if (!['approved', 'rejected'].includes(status)) {
    return res.status(400).json({ error: "status must be 'approved' or 'rejected'" });
  }

  const [result] = await pool.query(
    `UPDATE households SET status = ?, approved_by = ?, approved_at = NOW() WHERE id = ?`,
    [status, req.user.id, id]
  );
  if (result.affectedRows === 0) return res.status(404).json({ error: 'Household not found' });

  await logAudit({
    userId: req.user.id,
    action: status === 'approved' ? 'HOUSEHOLD_APPROVED' : 'HOUSEHOLD_REJECTED',
    entityType: 'household',
    entityId: id,
  });

  return res.json({ household: { id: Number(id), status } });
}

module.exports = { createHousehold, syncHouseholds, listHouseholds, getHousehold, reviewHousehold };
