'use strict';

/**
 * server/index.js
 *
 * RangeFinder — Express application entry point.
 *
 * Responsibilities:
 *   - Load environment variables from .env (dev only)
 *   - Apply security middleware (helmet, rate-limit, CORS)
 *   - Serve static HTML/CSS/JS from project root
 *   - Mount API routes under /api
 *   - Expose GET /health for ALB / ECS health checks
 *   - Run DB migrations on startup (idempotent)
 *   - Graceful shutdown on SIGTERM (Fargate sends this before stopping a task)
 */

// Load .env before anything else (no-op in production where env is injected)
require('dotenv').config();

const path        = require('path');
const fs          = require('fs');
const express     = require('express');
const helmet      = require('helmet');
const rateLimit   = require('express-rate-limit');

const app  = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

// ── Security headers ──────────────────────────────────────────────────────────
app.use(
  helmet({
    // Allow Google Fonts loaded by the HTML pages
    contentSecurityPolicy: {
      directives: {
        defaultSrc:  ["'self'"],
        scriptSrc:   ["'self'"],
        styleSrc:    ["'self'", 'https://fonts.googleapis.com', "'unsafe-inline'"],
        fontSrc:     ["'self'", 'https://fonts.gstatic.com'],
        imgSrc:      ["'self'", 'data:'],
        connectSrc:  ["'self'"],
      },
    },
  })
);

// ── Body parsing ──────────────────────────────────────────────────────────────
app.use(express.json({ limit: '64kb' }));
app.use(express.urlencoded({ extended: false, limit: '64kb' }));

// ── Rate limiting for API endpoints ──────────────────────────────────────────
// 10 form submissions per hour per IP — prevents spam/abuse
const apiLimiter = rateLimit({
  windowMs:         60 * 60 * 1000, // 1 hour
  max:              10,
  standardHeaders:  true,
  legacyHeaders:    false,
  message: {
    success: false,
    error:   'Too many submissions from this IP. Please try again later.',
  },
});

// ── Health check (must be before static middleware) ───────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── API routes ────────────────────────────────────────────────────────────────
app.use('/api/range-request', apiLimiter, require('./routes/rangeRequest'));
app.use('/api/affiliate',     apiLimiter, require('./routes/affiliate'));

// ── Static file serving ───────────────────────────────────────────────────────
// Serve the project root (index.html, request-range.html, become-affiliate.html,
// css/, js/) as static assets.
const staticRoot = path.join(__dirname, '..');
app.use(
  express.static(staticRoot, {
    // Don't serve server/ directory contents
    index: 'index.html',
    dotfiles: 'ignore',
  })
);

// ── SPA-style fallback: unknown paths → index.html ───────────────────────────
// Handles direct navigation to /request-range.html etc. when served via ALB
app.get('*', (req, res) => {
  // Only serve HTML files that actually exist; 404 everything else
  const htmlFile = req.path.endsWith('.html')
    ? path.join(staticRoot, req.path)
    : path.join(staticRoot, 'index.html');

  if (req.path.endsWith('.html') && !fs.existsSync(htmlFile)) {
    return res.status(404).send('Not found');
  }

  res.sendFile(htmlFile);
});

// ── Global error handler ──────────────────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error('[server] Unhandled error:', err.message);
  res.status(500).json({ success: false, error: 'Internal server error.' });
});

// ── Startup: run migrations then listen ──────────────────────────────────────
async function start() {
  // Run DB migrations (idempotent — uses IF NOT EXISTS)
  try {
    const { pool } = require('./db/client');
    const migrationsDir = path.join(__dirname, 'db', 'migrations');
    const files = fs
      .readdirSync(migrationsDir)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    for (const file of files) {
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      await pool.query(sql);
      console.log(`[migrate] ✓ ${file}`);
    }
  } catch (err) {
    console.error('[migrate] Migration failed:', err.message);
    // In production, exit so ECS restarts the task and alerts on repeated failure
    if (process.env.NODE_ENV === 'production') process.exit(1);
    // In dev, continue anyway so the server still starts for non-DB work
  }

  const server = app.listen(PORT, () => {
    console.log(`[server] RangeFinder listening on http://localhost:${PORT}`);
    console.log(`[server] NODE_ENV=${process.env.NODE_ENV || 'development'}`);
    console.log(`[server] EMAIL_PROVIDER=${process.env.EMAIL_PROVIDER || 'smtp'}`);
  });

  // ── Graceful shutdown (ECS Fargate sends SIGTERM before stopping) ──────────
  function shutdown(signal) {
    console.log(`[server] ${signal} received — shutting down gracefully…`);
    server.close(() => {
      console.log('[server] HTTP server closed.');
      // Close DB pool
      try {
        require('./db/client').pool.end(() => {
          console.log('[server] DB pool closed.');
          process.exit(0);
        });
      } catch (_) {
        process.exit(0);
      }
    });

    // Force exit after 10 s if graceful shutdown stalls
    setTimeout(() => {
      console.error('[server] Forced exit after timeout.');
      process.exit(1);
    }, 10_000).unref();
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT',  () => shutdown('SIGINT'));
}

start().catch((err) => {
  console.error('[server] Fatal startup error:', err.message);
  process.exit(1);
});
