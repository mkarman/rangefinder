'use strict';

/**
 * server/db/migrate.js
 *
 * Simple sequential migration runner.
 * Reads all *.sql files from migrations/ in filename order and executes them.
 * Uses IF NOT EXISTS guards so it is safe to re-run.
 *
 * Usage:
 *   node server/db/migrate.js
 *   docker-compose exec app node server/db/migrate.js
 */

require('dotenv').config();

const fs   = require('fs');
const path = require('path');
const { pool } = require('./client');

async function runMigrations() {
  const migrationsDir = path.join(__dirname, 'migrations');
  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort(); // lexicographic order: 001_... before 002_...

  console.log(`[migrate] Found ${files.length} migration file(s).`);

  for (const file of files) {
    const filePath = path.join(migrationsDir, file);
    const sql = fs.readFileSync(filePath, 'utf8');
    console.log(`[migrate] Running: ${file}`);
    try {
      await pool.query(sql);
      console.log(`[migrate] ✓ ${file}`);
    } catch (err) {
      console.error(`[migrate] ✗ ${file}: ${err.message}`);
      throw err;
    }
  }

  console.log('[migrate] All migrations complete.');
}

runMigrations()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('[migrate] Fatal error:', err.message);
    process.exit(1);
  });
