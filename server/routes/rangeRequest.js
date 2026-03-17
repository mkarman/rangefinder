'use strict';

/**
 * server/routes/rangeRequest.js
 *
 * POST /api/range-request
 *
 * Flow:
 *   1. Validate & sanitize body via validateRangeRequest()
 *   2. INSERT row into range_requests, get back the new id + submitted_at
 *   3. Send HTML notification email to NOTIFY_EMAIL
 *   4. Return { success: true, id, ref } to client
 */

const { Router } = require('express');
const db         = require('../db/client');
const { validateRangeRequest } = require('../middleware/validate');
const { sendRangeRequestEmail } = require('../services/email');

const router = Router();

router.post('/', async (req, res) => {
  // ── 1. Validate ──────────────────────────────────────────────────────────
  const { errors, data } = validateRangeRequest(req.body);

  if (errors.length > 0) {
    return res.status(400).json({ success: false, errors });
  }

  // ── 2. Insert into database ───────────────────────────────────────────────
  const sql = `
    INSERT INTO range_requests (
      org_name, org_type,
      contact_name, contact_title, contact_email, contact_phone,
      uxs_domain, platform_type, test_objectives, classification,
      capabilities, preferred_state, team_size,
      date_start, date_end, duration, flexibility,
      special_requirements, how_heard
    ) VALUES (
      $1,  $2,
      $3,  $4,  $5,  $6,
      $7,  $8,  $9,  $10,
      $11, $12, $13,
      $14, $15, $16, $17,
      $18, $19
    )
    RETURNING id, submitted_at
  `;

  const params = [
    data.org_name,      data.org_type,
    data.contact_name,  data.contact_title,  data.contact_email, data.contact_phone,
    data.uxs_domain,    data.platform_type,  data.test_objectives, data.classification,
    data.capabilities,  data.preferred_state, data.team_size,
    data.date_start,    data.date_end,       data.duration,      data.flexibility,
    data.special_requirements, data.how_heard,
  ];

  let row;
  try {
    const result = await db.query(sql, params);
    row = result.rows[0];
  } catch (err) {
    console.error('[range-request] DB insert failed:', err.message);
    return res.status(500).json({ success: false, error: 'Internal server error.' });
  }

  // ── 3. Send notification email (non-blocking — don't fail the request) ────
  const fullRow = { ...data, id: row.id, submitted_at: row.submitted_at };
  sendRangeRequestEmail(fullRow).catch((err) => {
    console.error('[range-request] Email send failed:', err.message);
  });

  // ── 4. Respond ────────────────────────────────────────────────────────────
  const ref = `RR-${String(row.id).padStart(4, '0')}`;
  console.log(`[range-request] Submitted ${ref} from ${data.contact_email}`);

  return res.status(201).json({ success: true, id: row.id, ref });
});

module.exports = router;
