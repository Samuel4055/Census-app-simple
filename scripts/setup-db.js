// One command to get a fresh database ready:  npm run setup
// - creates the tables (safe to re-run: uses IF NOT EXISTS)
// - creates the first administrator, only if there are no users yet
// - optionally adds a demo census centre / enumeration area / two more users
//
// Works with DATABASE_URL or the DB_* values, so it can run on a hosting
// platform's shell just as well as on a laptop. No mysql client needed.
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const mysql = require('mysql2/promise');
const { buildConfig } = require('../src/dbConfig');

function randomPassword() {
  // Readable, no look-alike characters.
  return crypto.randomBytes(9).toString('base64').replace(/[+/=lI0O]/g, 'x') + '#9';
}

// A small square in Bauchi town so the demo geofence has something to test.
const DEMO_BOUNDARY = {
  type: 'Polygon',
  coordinates: [[
    [9.975, 10.280],
    [9.995, 10.280],
    [9.995, 10.300],
    [9.975, 10.300],
    [9.975, 10.280],
  ]],
};

// allowRandom=true  -> missing passwords are generated and printed (manual run)
// allowRandom=false -> missing passwords are an error (automatic run at boot,
//                      where printing secrets into hosting logs would be bad)
async function runSetup({ allowRandom = true } = {}) {
  const demo = process.env.SEED_DEMO !== 'false';
  const conn = await mysql.createConnection(buildConfig({ multipleStatements: true }));
  const printed = [];
  let hasLock = false;

  try {
    const schema = fs.readFileSync(path.join(__dirname, '..', 'src', 'db', 'schema.sql'), 'utf8');
    await conn.query(schema);
    console.log('Tables are ready.');

    // On serverless hosts several instances can start at once. A named lock makes
    // sure only one of them seeds the first accounts; the others wait, then see
    // the users already exist. (If the database lacks GET_LOCK we just go on.)
    try {
      const [[lock]] = await conn.query("SELECT GET_LOCK('census_setup', 30) AS got");
      hasLock = lock.got === 1;
    } catch (err) {
      hasLock = false;
    }

    const [[{ n: userCount }]] = await conn.query('SELECT COUNT(*) AS n FROM users');
    if (userCount > 0) {
      console.log(`Found ${userCount} existing user(s) - leaving accounts untouched.`);
      return;
    }

    // Only now do we know accounts must be created, so only now are passwords required.
    if (!allowRandom) {
      const missing = [];
      if (!process.env.ADMIN_PASSWORD) missing.push('ADMIN_PASSWORD');
      if (demo && !process.env.DEMO_PASSWORD) missing.push('DEMO_PASSWORD (or set SEED_DEMO=false)');
      if (missing.length) {
        throw new Error('AUTO_SETUP needs these settings first: ' + missing.join(', '));
      }
    }

    let centreId = null;
    let areaId = null;

    if (demo) {
      const [centre] = await conn.query(
        'INSERT INTO census_centres (name, lga, state) VALUES (?, ?, ?)',
        ['Bauchi Central Census Centre', 'Bauchi', 'Bauchi']
      );
      centreId = centre.insertId;

      const [area] = await conn.query(
        'INSERT INTO enumeration_areas (census_centre_id, code, name, boundary_geojson) VALUES (?, ?, ?, ?)',
        [centreId, 'BC-EA-001', 'Bauchi Central Ward 1', JSON.stringify(DEMO_BOUNDARY)]
      );
      areaId = area.insertId;
    }

    const adminUser = process.env.ADMIN_USERNAME || 'admin';
    const adminPass = process.env.ADMIN_PASSWORD || randomPassword();
    await conn.query(
      `INSERT INTO users (username, password_hash, full_name, role, census_centre_id)
       VALUES (?, ?, 'System Administrator', 'administrator', ?)`,
      [adminUser, await bcrypt.hash(adminPass, 12), centreId]
    );
    printed.push(['administrator', adminUser, process.env.ADMIN_PASSWORD ? '(the ADMIN_PASSWORD you set)' : adminPass]);

    if (demo) {
      const demoPass = process.env.DEMO_PASSWORD || randomPassword();
      const demoHash = await bcrypt.hash(demoPass, 12);

      const [sup] = await conn.query(
        `INSERT INTO users (username, password_hash, full_name, role, census_centre_id)
         VALUES ('supervisor1', ?, 'Demo Supervisor', 'supervisor', ?)`,
        [demoHash, centreId]
      );
      await conn.query(
        `INSERT INTO users (username, password_hash, full_name, role, census_centre_id, enumeration_area_id, supervisor_id)
         VALUES ('enumerator1', ?, 'Demo Enumerator', 'enumerator', ?, ?, ?)`,
        [demoHash, centreId, areaId, sup.insertId]
      );
      const shown = process.env.DEMO_PASSWORD ? '(the DEMO_PASSWORD you set)' : demoPass;
      printed.push(['supervisor', 'supervisor1', shown]);
      printed.push(['enumerator', 'enumerator1', shown]);
    }

    console.log('\nAccounts created - note these down now, passwords are not shown again:\n');
    for (const [role, user, pass] of printed) {
      console.log(`  ${role.padEnd(14)} ${user.padEnd(14)} ${pass}`);
    }
    console.log('');
  } finally {
    if (hasLock) {
      await conn.query("SELECT RELEASE_LOCK('census_setup')").catch(() => {});
    }
    await conn.end();
  }
}

module.exports = { runSetup };

if (require.main === module) {
  runSetup({ allowRandom: true }).catch((err) => {
    console.error('Setup failed:', err.message);
    process.exit(1);
  });
}
