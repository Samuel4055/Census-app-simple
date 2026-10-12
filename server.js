require('dotenv').config();

// Fail fast with a clear message instead of running with a guessable secret.
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 16) {
  console.error('JWT_SECRET is missing or too short (use at least 16 random characters).');
  process.exit(1);
}

const app = require('./src/app');

const PORT = process.env.PORT || 4000;

async function start() {
  // Hosts without a shell (e.g. Render's free plan) can't run `npm run setup`,
  // so AUTO_SETUP=true does the same job on boot. It is safe to leave on:
  // tables use IF NOT EXISTS and accounts are only created when there are none.
  if (process.env.AUTO_SETUP === 'true') {
    const { runSetup } = require('./scripts/setup-db');
    await runSetup({ allowRandom: false });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Census app listening on port ${PORT}`);
  });
}

start().catch((err) => {
  console.error('Startup failed:', err.message);
  process.exit(1);
});
