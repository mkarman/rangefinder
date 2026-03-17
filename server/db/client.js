'use strict';

/**
 * server/db/client.js
 *
 * Singleton pg Pool. All database access goes through this module.
 * Connection string is read from DATABASE_URL environment variable.
 *
 * Local dev:  postgres://rangefinder:password@db:5432/rangefinder  (docker-compose)
 * Production: injected via AWS Secrets Manager → ECS task environment
 */

const { Pool } = require('pg');

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is not set.');
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Keep connections alive in Fargate; RDS proxy handles pooling at scale
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
  // Force SSL in production; local docker-compose postgres has no SSL
  ssl: process.env.NODE_ENV === 'production'
    ? { rejectUnauthorized: true }
    : false,
});

// Surface connection errors immediately rather than on first query
pool.on('error', (err) => {
  console.error('[db] Unexpected pool error:', err.message);
});

/**
 * Execute a parameterized query.
 * @param {string} text   - SQL with $1, $2, ... placeholders
 * @param {Array}  params - Parameter values
 * @returns {Promise<import('pg').QueryResult>}
 */
async function query(text, params) {
  const start = Date.now();
  try {
    const result = await pool.query(text, params);
    const duration = Date.now() - start;
    if (process.env.NODE_ENV !== 'production') {
      console.debug(`[db] query (${duration}ms) rows=${result.rowCount}`);
    }
    return result;
  } catch (err) {
    console.error('[db] Query error:', err.message, '\nSQL:', text);
    throw err;
  }
}

/**
 * Acquire a client for multi-statement transactions.
 * Caller must call client.release() in a finally block.
 */
async function getClient() {
  return pool.connect();
}

module.exports = { query, getClient, pool };
