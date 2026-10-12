const pool = require('../db');
const { pointInPolygon, haversineMeters } = require('./geo');

const VALID_SEX = new Set(['M', 'F']);

function validateStructure(payload) {
  const issues = [];
  const { headFullName, address, latitude, longitude, capturedAt, individuals } = payload;

  if (!headFullName || !headFullName.trim()) {
    issues.push({ ruleType: 'completeness', fieldName: 'headFullName', message: 'Head of household name is required' });
  }
  if (!address || !address.trim()) {
    issues.push({ ruleType: 'completeness', fieldName: 'address', message: 'Address is required' });
  }
  if (!capturedAt) {
    issues.push({ ruleType: 'completeness', fieldName: 'capturedAt', message: 'Capture timestamp is required' });
  }
  if (!Array.isArray(individuals) || individuals.length === 0) {
    issues.push({ ruleType: 'completeness', fieldName: 'individuals', message: 'At least one household member is required' });
  }

  if (typeof latitude !== 'number' || latitude < -90 || latitude > 90) {
    issues.push({ ruleType: 'format_range', fieldName: 'latitude', message: 'Latitude must be between -90 and 90' });
  }
  if (typeof longitude !== 'number' || longitude < -180 || longitude > 180) {
    issues.push({ ruleType: 'format_range', fieldName: 'longitude', message: 'Longitude must be between -180 and 180' });
  }

  (individuals || []).forEach((person, idx) => {
    if (!person.fullName || !person.fullName.trim()) {
      issues.push({ ruleType: 'completeness', fieldName: `individuals[${idx}].fullName`, message: 'Member name is required' });
    }
    if (typeof person.age !== 'number' || person.age < 0 || person.age > 130) {
      issues.push({ ruleType: 'format_range', fieldName: `individuals[${idx}].age`, message: 'Age must be between 0 and 130' });
    }
    if (!VALID_SEX.has(person.sex)) {
      issues.push({ ruleType: 'format_range', fieldName: `individuals[${idx}].sex`, message: "Sex must be 'M' or 'F'" });
    }
    if (!person.relationshipToHead || !person.relationshipToHead.trim()) {
      issues.push({ ruleType: 'completeness', fieldName: `individuals[${idx}].relationshipToHead`, message: 'Relationship to head is required' });
    }
  });

  const heads = (individuals || []).filter((p) => (p.relationshipToHead || '').toLowerCase() === 'head');
  if (heads.length === 0) {
    issues.push({ ruleType: 'logical_consistency', fieldName: 'individuals', message: 'No household member is marked as Head' });
  } else if (heads.length > 1) {
    issues.push({ ruleType: 'logical_consistency', fieldName: 'individuals', message: 'More than one household member is marked as Head' });
  } else if (heads[0].age < 15) {
    issues.push({ ruleType: 'logical_consistency', fieldName: 'individuals', message: 'Declared Head is under the plausible minimum age (15)' });
  }

  return issues;
}

// Boundary check + near-duplicate check, done in JS against rows from the DB.
async function validateAgainstDatabase({ enumerationAreaId, latitude, longitude, headFullName }) {
  const [areaRows] = await pool.query(
    `SELECT boundary_geojson FROM enumeration_areas WHERE id = ?`,
    [enumerationAreaId]
  );

  let locationInBoundary = null;
  if (areaRows[0]) {
    try {
      locationInBoundary = pointInPolygon(latitude, longitude, JSON.parse(areaRows[0].boundary_geojson));
    } catch (err) {
      console.error('Bad boundary GeoJSON for enumeration area', enumerationAreaId, err);
    }
  }

  const [sameName] = await pool.query(
    `SELECT latitude, longitude FROM households
     WHERE enumeration_area_id = ? AND LOWER(head_full_name) = LOWER(?)`,
    [enumerationAreaId, headFullName.trim()]
  );
  const duplicateWarning = sameName.some(
    (row) => haversineMeters(latitude, longitude, row.latitude, row.longitude) < 50
  );

  return { locationInBoundary, duplicateWarning };
}

module.exports = { validateStructure, validateAgainstDatabase };
