const mysql = require('mysql2/promise');
require('dotenv').config();
const { buildConfig } = require('./dbConfig');

// Serverless platforms start many small instances, so each keeps only a few
// connections open (hosted free databases allow few connections in total).
const onServerless = Boolean(process.env.VERCEL);
const poolSize = Number(process.env.DB_POOL_SIZE) || (onServerless ? 3 : 10);

const pool = mysql.createPool(
  buildConfig({
    waitForConnections: true,
    connectionLimit: poolSize,
    dateStrings: true,
    enableKeepAlive: true,
    ...(onServerless ? { idleTimeout: 20000, maxIdle: 1 } : {}),
  })
);

// On Vercel, lets the platform close idle connections before an instance sleeps.
if (onServerless) {
  try {
    require('@vercel/functions').attachDatabasePool(pool);
  } catch (err) {
    console.warn('Could not attach database pool to the platform:', err.message);
  }
}

module.exports = pool;
