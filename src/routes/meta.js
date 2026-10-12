const express = require('express');
const pool = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/census-centres', requireAuth, async (req, res) => {
  const [rows] = await pool.query(`SELECT id, name, lga, state FROM census_centres ORDER BY name`);
  return res.json({ censusCentres: rows });
});

// The device caches these boundaries so the "am I inside my area?" check
// keeps working with no signal.
router.get('/enumeration-areas', requireAuth, async (req, res) => {
  const { censusCentreId } = req.query;
  const params = [];
  let where = '';
  if (censusCentreId) {
    where = 'WHERE census_centre_id = ?';
    params.push(censusCentreId);
  }

  const [rows] = await pool.query(
    `SELECT id, census_centre_id, code, name, boundary_geojson
     FROM enumeration_areas ${where} ORDER BY code`,
    params
  );

  const enumerationAreas = [];
  for (const row of rows) {
    let boundary = null;
    try {
      boundary = JSON.parse(row.boundary_geojson);
    } catch (err) {
      console.error('Bad boundary GeoJSON for enumeration area', row.id, err);
    }
    enumerationAreas.push({
      id: row.id,
      censusCentreId: row.census_centre_id,
      code: row.code,
      name: row.name,
      boundary,
    });
  }

  return res.json({ enumerationAreas });
});

module.exports = router;
