'use strict';

/**
 * server/middleware/validate.js
 *
 * Input sanitization and validation helpers.
 * All user-supplied strings are trimmed; arrays are filtered to non-empty strings.
 * Validation errors are collected and returned as an array so the client
 * can display all problems at once rather than one at a time.
 */

// ── Primitive sanitizers ──────────────────────────────────────────────────────

/** Trim a string value; return empty string if not a string. */
function str(val) {
  return typeof val === 'string' ? val.trim() : '';
}

/** Sanitize an array of strings; filter out empty entries. */
function arr(val) {
  if (!Array.isArray(val)) return [];
  return val.map((v) => str(v)).filter(Boolean);
}

/** Basic email format check. */
function isValidEmail(val) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);
}

/** Basic URL format check. */
function isValidUrl(val) {
  try {
    new URL(val);
    return true;
  } catch (_) {
    return false;
  }
}

/** ISO date string (YYYY-MM-DD) check. */
function isValidDate(val) {
  return /^\d{4}-\d{2}-\d{2}$/.test(val) && !isNaN(Date.parse(val));
}

// ── Allowed value sets (whitelist) ────────────────────────────────────────────

const ALLOWED = {
  org_type_request:   ['commercial', 'dod', 'federal', 'academic', 'startup', 'other'],
  org_type_affiliate: ['commercial', 'dod', 'federal', 'academic', 'state', 'other'],
  uxs_domain:         ['uas', 'ugs', 'usv', 'uuv', 'multi'],
  classification:     ['unclassified', 'cui', 'secret', 'ts'],
  classification_lvl: ['unclassified', 'cui', 'secret', 'ts', 'ts-sci'],
  capabilities:       ['airspace', 'bvlos', 'waterspace', 'underwater', 'instrumentation',
                       'chase', 'ew', 'gps-denied', 'hangar'],
  preferred_state:    ['northeast', 'southeast', 'midwest', 'southwest', 'west',
                       'alaska', 'hawaii', 'oconus', ''],
  team_size:          ['1-5', '6-15', '16-30', '31+', ''],
  duration:           ['half-day', '1-day', '2-3-days', '1-week', '2-weeks', '1-month', 'ongoing'],
  flexibility:        ['fixed', 'some', 'flexible', 'very-flexible', ''],
  how_heard:          ['colleague', 'conference', 'search', 'social', 'publication',
                       'government', 'other', ''],
  domains:            ['uas', 'ugs', 'usv', 'uuv'],
  airspace:           ['restricted', 'sua', 'class-d', 'bvlos-waiver', 'maritime',
                       'inland-water', 'subsurface'],
  infrastructure:     ['runway', 'hangar', 'telemetry', 'chase', 'fuel', 'comms',
                       'ew', 'gps-denied', 'lodging', 'classified'],
  years_operating:    ['new', '1-3', '4-10', '10+', ''],
  availability:       ['year-round', 'seasonal', 'limited', 'weekdays'],
  max_team:           ['1-10', '11-25', '26-50', '50+', ''],
};

function inAllowed(val, key) {
  return ALLOWED[key] ? ALLOWED[key].includes(val) : true;
}

function arrInAllowed(vals, key) {
  return vals.every((v) => ALLOWED[key].includes(v));
}

// ── Range Request validator ───────────────────────────────────────────────────

/**
 * Validate and sanitize a range request body.
 * @param {object} body - Raw req.body
 * @returns {{ errors: string[], data: object|null }}
 */
function validateRangeRequest(body) {
  const errors = [];
  const d = {};

  // Section 1 — Organization & Contact
  d.org_name = str(body.org_name);
  if (!d.org_name) errors.push('org_name is required.');

  d.org_type = str(body.org_type);
  if (!d.org_type) errors.push('org_type is required.');
  else if (!inAllowed(d.org_type, 'org_type_request'))
    errors.push(`org_type "${d.org_type}" is not a valid option.`);

  d.contact_name = str(body.contact_name);
  if (!d.contact_name) errors.push('contact_name is required.');

  d.contact_title = str(body.contact_title) || null;

  d.contact_email = str(body.contact_email);
  if (!d.contact_email) errors.push('contact_email is required.');
  else if (!isValidEmail(d.contact_email)) errors.push('contact_email is not a valid email address.');

  d.contact_phone = str(body.contact_phone) || null;

  // Section 2 — UxS System & Mission
  d.uxs_domain = str(body.uxs_domain);
  if (!d.uxs_domain) errors.push('uxs_domain is required.');
  else if (!inAllowed(d.uxs_domain, 'uxs_domain'))
    errors.push(`uxs_domain "${d.uxs_domain}" is not a valid option.`);

  d.platform_type = str(body.platform_type);
  if (!d.platform_type) errors.push('platform_type is required.');

  d.test_objectives = str(body.test_objectives);
  if (!d.test_objectives) errors.push('test_objectives is required.');

  d.classification = str(body.classification);
  if (!d.classification) errors.push('classification is required.');
  else if (!inAllowed(d.classification, 'classification'))
    errors.push(`classification "${d.classification}" is not a valid option.`);

  // Section 3 — Range Requirements
  d.capabilities = arr(body.capabilities);
  if (d.capabilities.length === 0) errors.push('At least one capability must be selected.');
  else if (!arrInAllowed(d.capabilities, 'capabilities'))
    errors.push('One or more capability values are invalid.');

  d.preferred_state = str(body.preferred_state) || null;
  if (d.preferred_state && !inAllowed(d.preferred_state, 'preferred_state'))
    errors.push(`preferred_state "${d.preferred_state}" is not a valid option.`);

  d.team_size = str(body.team_size) || null;
  if (d.team_size && !inAllowed(d.team_size, 'team_size'))
    errors.push(`team_size "${d.team_size}" is not a valid option.`);

  // Section 4 — Scheduling
  d.date_start = str(body.date_start);
  if (!d.date_start) errors.push('date_start is required.');
  else if (!isValidDate(d.date_start)) errors.push('date_start must be a valid date (YYYY-MM-DD).');

  d.date_end = str(body.date_end);
  if (!d.date_end) errors.push('date_end is required.');
  else if (!isValidDate(d.date_end)) errors.push('date_end must be a valid date (YYYY-MM-DD).');

  if (d.date_start && d.date_end && isValidDate(d.date_start) && isValidDate(d.date_end)) {
    if (new Date(d.date_end) <= new Date(d.date_start))
      errors.push('date_end must be after date_start.');
  }

  d.duration = str(body.duration);
  if (!d.duration) errors.push('duration is required.');
  else if (!inAllowed(d.duration, 'duration'))
    errors.push(`duration "${d.duration}" is not a valid option.`);

  d.flexibility = str(body.flexibility) || null;
  if (d.flexibility && !inAllowed(d.flexibility, 'flexibility'))
    errors.push(`flexibility "${d.flexibility}" is not a valid option.`);

  // Section 5 — Additional
  d.special_requirements = str(body.special_requirements) || null;

  d.how_heard = str(body.how_heard) || null;
  if (d.how_heard && !inAllowed(d.how_heard, 'how_heard'))
    errors.push(`how_heard "${d.how_heard}" is not a valid option.`);

  return { errors, data: errors.length === 0 ? d : null };
}

// ── Affiliate Application validator ──────────────────────────────────────────

/**
 * Validate and sanitize an affiliate application body.
 * @param {object} body - Raw req.body
 * @returns {{ errors: string[], data: object|null }}
 */
function validateAffiliate(body) {
  const errors = [];
  const d = {};

  // Section 1 — Organization & Contact
  d.org_name = str(body.org_name);
  if (!d.org_name) errors.push('org_name is required.');

  d.org_type = str(body.org_type);
  if (!d.org_type) errors.push('org_type is required.');
  else if (!inAllowed(d.org_type, 'org_type_affiliate'))
    errors.push(`org_type "${d.org_type}" is not a valid option.`);

  d.contact_name = str(body.contact_name);
  if (!d.contact_name) errors.push('contact_name is required.');

  d.contact_title = str(body.contact_title) || null;

  d.contact_email = str(body.contact_email);
  if (!d.contact_email) errors.push('contact_email is required.');
  else if (!isValidEmail(d.contact_email)) errors.push('contact_email is not a valid email address.');

  d.contact_phone = str(body.contact_phone);
  if (!d.contact_phone) errors.push('contact_phone is required.');

  d.website = str(body.website) || null;
  if (d.website && !isValidUrl(d.website))
    errors.push('website must be a valid URL (include https://).');

  // Section 2 — Range Information
  d.range_name = str(body.range_name);
  if (!d.range_name) errors.push('range_name is required.');

  d.range_state = str(body.range_state);
  if (!d.range_state) errors.push('range_state is required.');

  d.range_location  = str(body.range_location)  || null;
  d.range_acreage   = str(body.range_acreage)   || null;

  d.years_operating = str(body.years_operating) || null;
  if (d.years_operating && !inAllowed(d.years_operating, 'years_operating'))
    errors.push(`years_operating "${d.years_operating}" is not a valid option.`);

  // Section 3 — Supported Domains
  d.domains = arr(body.domains);
  if (d.domains.length === 0) errors.push('At least one supported domain must be selected.');
  else if (!arrInAllowed(d.domains, 'domains'))
    errors.push('One or more domain values are invalid.');

  // Section 4 — Capabilities
  d.airspace = arr(body.airspace);
  if (d.airspace.length > 0 && !arrInAllowed(d.airspace, 'airspace'))
    errors.push('One or more airspace values are invalid.');

  d.infrastructure = arr(body.infrastructure);
  if (d.infrastructure.length > 0 && !arrInAllowed(d.infrastructure, 'infrastructure'))
    errors.push('One or more infrastructure values are invalid.');

  d.max_altitude = str(body.max_altitude) || null;

  d.classification_level = str(body.classification_level) || null;
  if (d.classification_level && !inAllowed(d.classification_level, 'classification_lvl'))
    errors.push(`classification_level "${d.classification_level}" is not a valid option.`);

  // Section 5 — Availability
  d.availability = str(body.availability);
  if (!d.availability) errors.push('availability is required.');
  else if (!inAllowed(d.availability, 'availability'))
    errors.push(`availability "${d.availability}" is not a valid option.`);

  d.max_team = str(body.max_team) || null;
  if (d.max_team && !inAllowed(d.max_team, 'max_team'))
    errors.push(`max_team "${d.max_team}" is not a valid option.`);

  d.range_description = str(body.range_description);
  if (!d.range_description) errors.push('range_description is required.');

  d.limitations = str(body.limitations) || null;

  // Section 6
  d.how_heard = str(body.how_heard) || null;
  if (d.how_heard && !inAllowed(d.how_heard, 'how_heard'))
    errors.push(`how_heard "${d.how_heard}" is not a valid option.`);

  return { errors, data: errors.length === 0 ? d : null };
}

module.exports = { validateRangeRequest, validateAffiliate };
