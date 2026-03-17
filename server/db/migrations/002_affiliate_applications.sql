-- Migration 002: affiliate_applications table
-- Stores all submissions from become-affiliate.html
-- Run via: node server/db/migrate.js

CREATE TABLE IF NOT EXISTS affiliate_applications (
  -- Primary identifier (auto-incrementing, used as AF-XXXX reference)
  id              SERIAL PRIMARY KEY,
  submitted_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Section 1: Organization & Contact
  org_name        TEXT NOT NULL,
  org_type        TEXT NOT NULL,   -- commercial | dod | federal | academic | state | other
  contact_name    TEXT NOT NULL,
  contact_title   TEXT,
  contact_email   TEXT NOT NULL,
  contact_phone   TEXT NOT NULL,
  website         TEXT,

  -- Section 2: Range Information
  range_name      TEXT NOT NULL,
  range_state     TEXT NOT NULL,
  range_location  TEXT,
  range_acreage   TEXT,
  years_operating TEXT,            -- new | 1-3 | 4-10 | 10+

  -- Section 3: Supported UxS Domains
  -- stored as array: ['uas','ugs','usv','uuv']
  domains         TEXT[] NOT NULL DEFAULT '{}',

  -- Section 4: Range Capabilities & Infrastructure
  -- stored as arrays of selected checkbox values
  airspace        TEXT[] NOT NULL DEFAULT '{}',
  infrastructure  TEXT[] NOT NULL DEFAULT '{}',
  max_altitude    TEXT,
  classification_level TEXT,       -- unclassified | cui | secret | ts | ts-sci

  -- Section 5: Availability & Capacity
  availability    TEXT NOT NULL,   -- year-round | seasonal | limited | weekdays
  max_team        TEXT,
  range_description TEXT NOT NULL,
  limitations     TEXT,

  -- Section 6: Agreement & Submission
  how_heard       TEXT,

  -- Internal workflow status
  status          TEXT NOT NULL DEFAULT 'pending'  -- pending | approved | rejected
);

-- Index for common admin queries
CREATE INDEX IF NOT EXISTS idx_affiliate_submitted_at   ON affiliate_applications (submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_affiliate_status         ON affiliate_applications (status);
CREATE INDEX IF NOT EXISTS idx_affiliate_range_state    ON affiliate_applications (range_state);
