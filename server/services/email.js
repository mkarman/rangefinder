'use strict';

/**
 * server/services/email.js
 *
 * Dual-mode email sender:
 *   EMAIL_PROVIDER=smtp  → nodemailer (local dev via Mailhog)
 *   EMAIL_PROVIDER=ses   → AWS SES SDK v3 (production)
 *
 * Both modes send to NOTIFY_EMAIL (karman@strategicmissionelements.com).
 */

const nodemailer = require('nodemailer');

// ── Lazy-load SES client only when needed (avoids import error if SDK not configured) ──
let sesClient = null;
let sesSendCommand = null;

async function getSesClient() {
  if (!sesClient) {
    const { SESClient, SendEmailCommand } = require('@aws-sdk/client-ses');
    sesClient = new SESClient({ region: process.env.AWS_REGION || 'us-east-1' });
    sesSendCommand = SendEmailCommand;
  }
  return { sesClient, SendEmailCommand: sesSendCommand };
}

// ── SMTP transporter (nodemailer) ──
function createSmtpTransport() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'mailhog',
    port: parseInt(process.env.SMTP_PORT || '1025', 10),
    secure: false,
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      : undefined,
  });
}

// ── Format a reference ID ──
function formatRef(type, id) {
  // type: 'RR' | 'AF'
  return `${type}-${String(id).padStart(4, '0')}`;
}

// ── Build HTML email body from a field map ──
function buildHtmlBody(title, ref, submittedAt, rows) {
  const rowsHtml = rows
    .map(([label, value]) => {
      const display = Array.isArray(value)
        ? value.length > 0 ? value.join(', ') : '<em>none selected</em>'
        : value || '<em>not provided</em>';
      return `
        <tr>
          <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;font-weight:600;
                     color:#1A2E3B;white-space:nowrap;vertical-align:top;width:220px;">
            ${label}
          </td>
          <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;color:#374151;
                     vertical-align:top;">
            ${display}
          </td>
        </tr>`;
    })
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#EAF4FB;font-family:Inter,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#EAF4FB;padding:32px 16px;">
    <tr><td align="center">
      <table width="640" cellpadding="0" cellspacing="0"
             style="background:#ffffff;border-radius:8px;overflow:hidden;
                    box-shadow:0 2px 8px rgba(0,0,0,0.08);max-width:640px;width:100%;">

        <!-- Header -->
        <tr>
          <td style="background:#1A2E3B;padding:24px 32px;">
            <p style="margin:0;font-size:22px;font-weight:700;color:#ffffff;letter-spacing:0.5px;">
              🎯 RangeFinder
            </p>
            <p style="margin:6px 0 0;font-size:14px;color:#A8D4F0;">
              UxS Test Range Network
            </p>
          </td>
        </tr>

        <!-- Title bar -->
        <tr>
          <td style="background:#4A90C4;padding:16px 32px;">
            <p style="margin:0;font-size:18px;font-weight:600;color:#ffffff;">
              ${title}
            </p>
            <p style="margin:4px 0 0;font-size:13px;color:#dbeeff;">
              Reference: <strong>${ref}</strong> &nbsp;|&nbsp;
              Submitted: ${new Date(submittedAt).toLocaleString('en-US', {
                timeZone: 'America/New_York',
                dateStyle: 'medium',
                timeStyle: 'short',
              })} ET
            </p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:24px 32px;">
            <table width="100%" cellpadding="0" cellspacing="0"
                   style="border:1px solid #e2e8f0;border-radius:6px;overflow:hidden;">
              ${rowsHtml}
            </table>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f8fafc;padding:16px 32px;border-top:1px solid #e2e8f0;">
            <p style="margin:0;font-size:12px;color:#6b7280;">
              This notification was generated automatically by RangeFinder.
              Do not reply to this email — reply directly to the submitter's email address above.
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ── Build plain-text fallback ──
function buildTextBody(title, ref, submittedAt, rows) {
  const lines = rows.map(([label, value]) => {
    const display = Array.isArray(value)
      ? value.join(', ') || 'none selected'
      : value || 'not provided';
    return `${label}: ${display}`;
  });
  return [
    `RangeFinder — ${title}`,
    `Reference: ${ref}`,
    `Submitted: ${new Date(submittedAt).toISOString()}`,
    '',
    ...lines,
    '',
    'This notification was generated automatically by RangeFinder.',
  ].join('\n');
}

// ── Core send function ──
async function sendEmail({ subject, html, text }) {
  const from    = process.env.SES_FROM_ADDRESS || 'noreply@rangefinder.aero';
  const to      = process.env.NOTIFY_EMAIL     || 'karman@strategicmissionelements.com';
  const provider = process.env.EMAIL_PROVIDER  || 'smtp';

  if (provider === 'ses') {
    const { sesClient: client, SendEmailCommand } = await getSesClient();
    const command = new SendEmailCommand({
      Source: from,
      Destination: { ToAddresses: [to] },
      Message: {
        Subject: { Data: subject, Charset: 'UTF-8' },
        Body: {
          Html: { Data: html, Charset: 'UTF-8' },
          Text: { Data: text, Charset: 'UTF-8' },
        },
      },
    });
    const response = await client.send(command);
    console.log(`[email] SES sent. MessageId=${response.MessageId}`);
    return response;
  }

  // Default: SMTP via nodemailer
  const transport = createSmtpTransport();
  const info = await transport.sendMail({ from, to, subject, html, text });
  console.log(`[email] SMTP sent. MessageId=${info.messageId}`);
  return info;
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Send notification email for a new Range Request submission.
 * @param {object} data - Row as returned from the DB INSERT ... RETURNING *
 */
async function sendRangeRequestEmail(data) {
  const ref = formatRef('RR', data.id);

  const rows = [
    // Contact
    ['Organization',        data.org_name],
    ['Organization Type',   data.org_type],
    ['Contact Name',        data.contact_name],
    ['Title / Role',        data.contact_title],
    ['Email',               data.contact_email],
    ['Phone',               data.contact_phone],
    // Mission
    ['UxS Domain',          data.uxs_domain],
    ['Platform / Vehicle',  data.platform_type],
    ['Test Objectives',     data.test_objectives],
    ['Classification',      data.classification],
    // Requirements
    ['Required Capabilities', data.capabilities],
    ['Preferred Region',    data.preferred_state],
    ['Team Size',           data.team_size],
    // Schedule
    ['Earliest Start Date', data.date_start],
    ['Latest End Date',     data.date_end],
    ['Duration',            data.duration],
    ['Schedule Flexibility',data.flexibility],
    // Additional
    ['Special Requirements',data.special_requirements],
    ['How Heard',           data.how_heard],
  ];

  const subject = `[RangeFinder] New Range Request ${ref} — ${data.org_name}`;
  const html    = buildHtmlBody('New Range Access Request', ref, data.submitted_at, rows);
  const text    = buildTextBody('New Range Access Request', ref, data.submitted_at, rows);

  return sendEmail({ subject, html, text });
}

/**
 * Send notification email for a new Affiliate Application submission.
 * @param {object} data - Row as returned from the DB INSERT ... RETURNING *
 */
async function sendAffiliateEmail(data) {
  const ref = formatRef('AF', data.id);

  const rows = [
    // Contact
    ['Organization',          data.org_name],
    ['Organization Type',     data.org_type],
    ['Contact Name',          data.contact_name],
    ['Title / Role',          data.contact_title],
    ['Email',                 data.contact_email],
    ['Phone',                 data.contact_phone],
    ['Website',               data.website],
    // Range Info
    ['Range / Facility Name', data.range_name],
    ['State / Territory',     data.range_state],
    ['Location',              data.range_location],
    ['Range Area',            data.range_acreage],
    ['Years Operating',       data.years_operating],
    // Capabilities
    ['Supported Domains',     data.domains],
    ['Airspace Authorizations', data.airspace],
    ['Infrastructure',        data.infrastructure],
    ['Max Altitude / Depth',  data.max_altitude],
    ['Highest Classification',data.classification_level],
    // Availability
    ['General Availability',  data.availability],
    ['Max Team Size',         data.max_team],
    ['Range Description',     data.range_description],
    ['Known Limitations',     data.limitations],
    // Meta
    ['How Heard',             data.how_heard],
  ];

  const subject = `[RangeFinder] New Affiliate Application ${ref} — ${data.range_name}`;
  const html    = buildHtmlBody('New Affiliate Application', ref, data.submitted_at, rows);
  const text    = buildTextBody('New Affiliate Application', ref, data.submitted_at, rows);

  return sendEmail({ subject, html, text });
}

module.exports = { sendRangeRequestEmail, sendAffiliateEmail };
