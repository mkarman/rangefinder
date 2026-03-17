# RangeFinder — Backend, Database & AWS Deployment Plan

## Overview

This document describes the full backend architecture for RangeFinder as it migrates from a
static GitHub Pages site to a containerized, AWS-deployable full-stack application.

---

## System Architecture

```
Browser ──HTTPS──► ALB (Application Load Balancer)
                     │
                     ▼
              ECS Fargate Task
              ┌─────────────────────────────┐
              │  Node.js / Express          │
              │  ├── Serves static files    │
              │  ├── POST /api/range-request│
              │  └── POST /api/affiliate    │
              └──────────┬──────────────────┘
                         │
              ┌──────────┴──────────┐
              ▼                     ▼
     RDS PostgreSQL           AWS SES
     (private subnet)    karman@strategicmissionelements.com
```

---

## Project Structure

```
rangefinder/
├── index.html
├── request-range.html
├── become-affiliate.html
├── css/
│   └── styles.css
├── js/
│   └── main.js                    ← updated to fetch() POST
├── server/
│   ├── index.js                   ← Express entry point
│   ├── routes/
│   │   ├── rangeRequest.js        ← POST /api/range-request
│   │   └── affiliate.js           ← POST /api/affiliate
│   ├── db/
│   │   ├── client.js              ← pg Pool singleton
│   │   └── migrations/
│   │       ├── 001_range_requests.sql
│   │       └── 002_affiliate_applications.sql
│   ├── services/
│   │   └── email.js               ← SMTP (dev) / SES (prod) dual-mode
│   └── middleware/
│       └── validate.js            ← Input sanitization
├── Dockerfile
├── docker-compose.yml
├── .env.example
├── package.json
└── plans/
    ├── backend-aws-plan.md        ← this file
    └── aws-deployment.md          ← AWS infra detail
```

---

## Database Schema

### Table: `range_requests`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `SERIAL` | `PRIMARY KEY` | Auto-incrementing submission ID |
| `submitted_at` | `TIMESTAMPTZ` | `DEFAULT NOW()` | UTC timestamp |
| `org_name` | `TEXT` | `NOT NULL` | |
| `org_type` | `TEXT` | `NOT NULL` | commercial, dod, federal, academic, startup, other |
| `contact_name` | `TEXT` | `NOT NULL` | |
| `contact_title` | `TEXT` | | Optional |
| `contact_email` | `TEXT` | `NOT NULL` | |
| `contact_phone` | `TEXT` | | Optional |
| `uxs_domain` | `TEXT` | `NOT NULL` | uas, ugs, usv, uuv, multi |
| `platform_type` | `TEXT` | `NOT NULL` | |
| `test_objectives` | `TEXT` | `NOT NULL` | |
| `classification` | `TEXT` | `NOT NULL` | unclassified, cui, secret, ts |
| `capabilities` | `TEXT[]` | `NOT NULL` | Multi-select checkbox values |
| `preferred_state` | `TEXT` | | Optional |
| `team_size` | `TEXT` | | Optional |
| `date_start` | `DATE` | `NOT NULL` | |
| `date_end` | `DATE` | `NOT NULL` | |
| `duration` | `TEXT` | `NOT NULL` | |
| `flexibility` | `TEXT` | | Optional |
| `special_requirements` | `TEXT` | | Optional |
| `how_heard` | `TEXT` | | Optional |
| `status` | `TEXT` | `DEFAULT 'new'` | new, in-review, matched, closed |

### Table: `affiliate_applications`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `SERIAL` | `PRIMARY KEY` | Auto-incrementing submission ID |
| `submitted_at` | `TIMESTAMPTZ` | `DEFAULT NOW()` | UTC timestamp |
| `org_name` | `TEXT` | `NOT NULL` | |
| `org_type` | `TEXT` | `NOT NULL` | |
| `contact_name` | `TEXT` | `NOT NULL` | |
| `contact_title` | `TEXT` | | Optional |
| `contact_email` | `TEXT` | `NOT NULL` | |
| `contact_phone` | `TEXT` | `NOT NULL` | |
| `website` | `TEXT` | | Optional |
| `range_name` | `TEXT` | `NOT NULL` | |
| `range_state` | `TEXT` | `NOT NULL` | |
| `range_location` | `TEXT` | | Optional |
| `range_acreage` | `TEXT` | | Optional |
| `years_operating` | `TEXT` | | Optional |
| `domains` | `TEXT[]` | `NOT NULL` | uas, ugs, usv, uuv |
| `airspace` | `TEXT[]` | | Airspace authorization checkboxes |
| `infrastructure` | `TEXT[]` | | Infrastructure checkboxes |
| `max_altitude` | `TEXT` | | Optional |
| `classification_level` | `TEXT` | | Optional |
| `availability` | `TEXT` | `NOT NULL` | |
| `max_team` | `TEXT` | | Optional |
| `range_description` | `TEXT` | `NOT NULL` | |
| `limitations` | `TEXT` | | Optional |
| `how_heard` | `TEXT` | | Optional |
| `status` | `TEXT` | `DEFAULT 'pending'` | pending, approved, rejected |

---

## API Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/health` | Health check — returns `{ status: "ok" }` |
| `GET` | `/*` | Serves static HTML/CSS/JS |
| `POST` | `/api/range-request` | Validates, inserts to DB, sends email |
| `POST` | `/api/affiliate` | Validates, inserts to DB, sends email |

### Request Body Format

Both endpoints accept `application/json`. Checkbox fields are sent as arrays:

```json
{
  "org_name": "Acme Aerospace LLC",
  "capabilities": ["airspace", "bvlos", "instrumentation"],
  ...
}
```

### Response Format

**Success (201):**
```json
{ "success": true, "id": 42, "ref": "RR-0042" }
```

**Validation Error (400):**
```json
{ "success": false, "errors": ["contact_email is required", "..."] }
```

**Server Error (500):**
```json
{ "success": false, "error": "Internal server error" }
```

---

## Email Notification

Every successful submission triggers an HTML email to `karman@strategicmissionelements.com`.

**Subject line format:**
- Range Request: `[RangeFinder] New Range Request #RR-0042 — Acme Aerospace LLC`
- Affiliate: `[RangeFinder] New Affiliate Application #AF-0017 — Desert Sky Test Center`

**Email body includes:**
- Submission reference ID and timestamp
- Submitter contact info (name, email, phone, org)
- All form fields in a formatted HTML table
- Direct link to reply to submitter

**Provider switching via `EMAIL_PROVIDER` env var:**
- `smtp` → nodemailer (local dev with Mailhog)
- `ses` → AWS SES SDK (production)

---

## Local Development

### Prerequisites
- Docker Desktop
- No other local dependencies required

### Start all services
```bash
docker-compose up --build
```

### Services
| Service | URL |
|---|---|
| RangeFinder app | http://localhost:3000 |
| Mailhog email UI | http://localhost:8025 |
| PostgreSQL | localhost:5432 |

### Run DB migrations manually
```bash
docker-compose exec app node server/db/migrate.js
```

---

## Environment Variables

See [`.env.example`](.env.example) for the full list.

| Variable | Required | Description |
|---|---|---|
| `NODE_ENV` | Yes | `development` or `production` |
| `PORT` | No | Default: `3000` |
| `DATABASE_URL` | Yes | Full postgres connection string |
| `EMAIL_PROVIDER` | Yes | `smtp` or `ses` |
| `NOTIFY_EMAIL` | Yes | Destination for notifications |
| `SMTP_HOST` | If smtp | SMTP server hostname |
| `SMTP_PORT` | If smtp | SMTP port (1025 for Mailhog) |
| `AWS_REGION` | If ses | e.g., `us-east-1` |
| `SES_FROM_ADDRESS` | If ses | Verified SES sender address |

---

## Security Considerations

- All user input is sanitized server-side before DB insertion (parameterized queries via `pg`)
- No raw SQL string concatenation — all queries use `$1, $2, ...` placeholders
- `helmet` middleware sets security headers
- `express-rate-limit` limits form submissions to 10/hour per IP
- CORS restricted to same-origin in production
- `.env` files never committed (enforced via `.gitignore`)
- AWS production: credentials via Secrets Manager, not environment variables in task definition
