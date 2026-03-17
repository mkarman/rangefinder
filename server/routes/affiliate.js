'use strict';

/**
 * server/routes/affiliate.js
 *
 * POST /api/affiliate
 *
 * Flow:
 *   1. Validate & sanitize body via validateAffiliate()
 *   2. INSERT row into affiliate_applications, get back the new id + submitted_at
 *   3. Send HTML notification email to NOTIFY_EMAIL
 *   4. Return { success: true, id, ref } to client
 */

const { Router } = require('express');
const db         = require('../db/client');
const { validateAffiliate }   = require('../middleware/validate');
const { sendAffiliateEmail }  = require('../services/email');

const router = Router();

router.post('/', async (req, res) => {
  // ── 1. Validate ──────────────────────────────────────────────────────────
  const { errors, data } = validateAffiliate(req.body);

  if (errors.length > 0) {
    return res.status(400).json({ success: false, errors });
  }

  // ── 2. Insert into database ───────────────────────────────────────────────
  const sql = `
    INSERT INTO affiliate_applications (
      org_name, org_type,
      contact_name, contact_title, contact_email, contact_phone, website,
      range_name, range_state, range_location, range_acreage, years_operating,
      domains, airspace, infrastructure, max_altitude, classification_level,
      availability, max_team, range_description, limitations,
      how_heard
    ) VALUES (
      $1,  $2,
      $3,  $4,  $5,  $6,  $7,
      $8,  $9,  $10, $11, $12,
      $13, $14, $15, $16, $17,
      $18, $19, $20, $21,
      $22
    )
    RETURNING id, submitted_at
  `;

  const params = [
    data.org_name,        data.org_type,
    data.contact_name,    data.contact_title,   data.contact_email,
    data.contact_phone,   data.website,
    data.range_name,      data.range_state,     data.range_location,
    data.range_acreage,   data.years_operating,
    data.domains,         data.airspace,        data.infrastructure,
    data.max_altitude,    data.classification_level,
    data.availability,    data.max_team,        data.range_description,
    data.limitations,
    data.how_heard,
  ];

  let row;
  try {
    const result = await db.query(sql, params);
    row = result.rows[0];
  } catch (err) {
    console.error('[affiliate] DB insert failed:', err.message);
    return res.status(500).json({ success: false, error: 'Internal server error.' });
  }

  // ── 3. Send notification email (non-blocking — don't fail the request) ────
  const fullRow = { ...data, id: row.id, submitted_at: row.submitted_at };
  sendAffiliateEmail(fullRow).catch((err) => {
    console.error('[affiliate] Email send failed:', err.message);
  });

  // ── 4. Respond ────────────────────────────────────────────────────────────
  const ref = `AF-${String(row.id).padStart(4, '0')}`;
  console.log(`[affiliate] Submitted ${ref} from ${data.contact_email} — ${data.range_name}`);

  return res.status(201).json({ success: true, id: row.id, ref });
});

module.exports = router;
