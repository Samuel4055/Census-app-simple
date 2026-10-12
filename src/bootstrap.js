// Start-up checks shared by every way of running the app.
// On serverless hosts there is no "boot" step, so the first request on each new
// instance runs this once (the result is remembered for later requests).
let setupPromise = null;

function configProblem() {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 16) {
    return 'JWT_SECRET is missing or too short (use at least 16 random characters).';
  }
  if (!process.env.DATABASE_URL && !process.env.DB_HOST) {
    return 'No database is configured (set DATABASE_URL).';
  }
  return null;
}

function ensureReady() {
  if (process.env.AUTO_SETUP !== 'true') return Promise.resolve();
  if (!setupPromise) {
    const { runSetup } = require('../scripts/setup-db');
    setupPromise = runSetup({ allowRandom: false }).catch((err) => {
      setupPromise = null; // try again on the next request
      throw err;
    });
  }
  return setupPromise;
}

module.exports = { configProblem, ensureReady };
