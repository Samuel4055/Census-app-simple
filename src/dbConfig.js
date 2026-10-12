// One place that turns environment settings into a mysql2 connection config,
// shared by the web app (src/db.js) and the setup script.
//
// Accepts either DATABASE_URL (what hosted providers hand you, e.g.
// mysql://user:pass@host:3306/db?ssl-mode=REQUIRED) or separate DB_* values.
// TLS is switched on by DB_SSL=true, or automatically when the URL asks for it.
const SSL_MODES = new Set(['REQUIRED', 'VERIFY_CA', 'VERIFY_IDENTITY']);

function buildConfig(extra = {}) {
  let useSsl = process.env.DB_SSL === 'true';
  let config;

  if (process.env.DATABASE_URL) {
    const url = new URL(process.env.DATABASE_URL);
    const mode = (url.searchParams.get('ssl-mode') || '').toUpperCase();
    if (SSL_MODES.has(mode) || url.searchParams.get('ssl') === 'true') useSsl = true;
    // mysql2 doesn't understand these URL options, so strip them (and handle above).
    url.searchParams.delete('ssl-mode');
    url.searchParams.delete('ssl');
    config = { uri: url.toString() };
  } else {
    config = {
      host: process.env.DB_HOST || 'localhost',
      port: Number(process.env.DB_PORT) || 3306,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'census_db',
    };
  }

  if (useSsl) {
    // Hosted providers use their own certificate authorities; set
    // DB_SSL_STRICT=true if you have supplied a trusted CA and want it verified.
    config.ssl = { rejectUnauthorized: process.env.DB_SSL_STRICT === 'true' };
  }

  return { ...config, ...extra };
}

module.exports = { buildConfig };
