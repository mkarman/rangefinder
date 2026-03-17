-- Migration 001: range_requests table
-- Stores all submissions from request-range.html
-- Run via: node server/db/migrate.js

CREATE TABLE IF NOT EXISTS range_requests (
  -- Primary identifier (auto-incrementing, used as RR-XXXX reference)
  id              SERIAL PRIMARY KEY,
  submitted_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Section 1: Organization & Contact
  org_name        TEXT NOT NULL,
  org_type        TEXT NOT NULL,   -- commercial | dod | federal | academic | startup | other
  contact_name    TEXT NOT NULL,
  contact_title   TEXT,
  contact_email   TEXT NOT NULL,
  contact_phone   TEXT,

  -- Section 2: UxS System & Mission
  uxs_domain      TEXT NOT NULL,   -- uas | ugs | usv | uuv | multi
  platform_type   TEXT NOT NULL,
  test_objectives TEXT NOT NULL,
  classification  TEXT NOT NULL,   -- unclassified | cui | secret | ts

  -- Section 3: Range Requirements
  -- capabilities stored as array: ['airspace','bvlos','instrumentation',...]
  capabilities    TEXT[] NOT NULL DEFAULT '{}',
  preferred_state TEXT,
  team_size       TEXT,

  -- Section 4: Scheduling & Timeline
  date_start      DATE NOT NULL,
  date_end        DATE NOT NULL,
  duration        TEXT NOT NULL,   -- half-day | 1-day | 2-3-days | 1-week | 2-weeks | 1-month | ongoing
  flexibility     TEXT,            -- fixed | some | flexible | very-flexible

  -- Section 5: Additional Information
  special_requirements TEXT,
  how_heard            TEXT,

  -- Internal workflow status
  status          TEXT NOT NULL DEFAULT 'new'  -- new | in-review | matched | closed
);

-- Index for common admin queries
CREATE INDEX IF NOT EXISTS idx_range_requests_submitted_at ON range_requests (submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_range_requests_status       ON range_requests (status);
CREATE INDEX IF NOT EXISTS idx_range_requests_uxs_domain   ON range_requests (uxs_domain);
