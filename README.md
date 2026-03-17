# 🎯 RangeFinder

**Connecting UxS Engineers and Flight Testers with the Ranges They Need**

RangeFinder is a containerized full-stack web application that links unmanned systems (UxS) engineers, program offices, and flight test teams with certified test ranges across all operational domains — air, ground, surface, and subsurface.

Form submissions are persisted to a PostgreSQL database and trigger an HTML notification email to the RangeFinder coordination team.

---

## 🏗️ Architecture

```
Browser ──HTTPS──► ALB ──► ECS Fargate (Node.js/Express)
                                │
                    ┌───────────┴───────────┐
                    ▼                       ▼
             RDS PostgreSQL           AWS SES
             (range_requests,    (notification email to
          affiliate_applications)  karman@strategicmissionelements.com)
```

- **Frontend:** Static HTML/CSS/JS served directly by Express
- **Backend:** Node.js + Express REST API (`/api/range-request`, `/api/affiliate`)
- **Database:** PostgreSQL (Docker locally, AWS RDS in production)
- **Email:** nodemailer → Mailhog (local dev) / AWS SES (production)
- **Container:** Single `node:20-alpine` image, runnable with Docker or ECS Fargate

---

## 📁 Project Structure

```
rangefinder/
├── index.html                        # Landing page
├── request-range.html                # Range access intake form
├── become-affiliate.html             # Affiliate application form
├── css/
│   └── styles.css                    # Shared stylesheet
├── js/
│   └── main.js                       # Frontend JS (fetch() form submission)
│
├── server/
│   ├── index.js                      # Express entry point
│   ├── routes/
│   │   ├── rangeRequest.js           # POST /api/range-request
│   │   └── affiliate.js              # POST /api/affiliate
│   ├── db/
│   │   ├── client.js                 # pg Pool singleton
│   │   ├── migrate.js                # Migration runner (CLI)
│   │   └── migrations/
│   │       ├── 001_range_requests.sql
│   │       └── 002_affiliate_applications.sql
│   ├── services/
│   │   └── email.js                  # SMTP / SES dual-mode email sender
│   └── middleware/
│       └── validate.js               # Input sanitization & validation
│
├── Dockerfile                        # node:20-alpine single-stage build
├── docker-compose.yml                # Local dev: app + postgres + mailhog
├── .dockerignore
├── .env.example                      # Environment variable template
├── package.json
└── plans/
    ├── backend-aws-plan.md           # Architecture & schema reference
    └── aws-deployment.md             # Step-by-step AWS deployment guide
```

---

## 🚀 Local Development (Docker)

### Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (no other local installs needed)

### 1. Configure environment

```bash
cp .env.example .env
# The defaults in .env work out-of-the-box with docker-compose — no edits needed for local dev
```

### 2. Start all services

```bash
docker-compose up --build
```

This starts:

| Service | URL | Description |
|---|---|---|
| **RangeFinder app** | http://localhost:3000 | Full site + API |
| **Mailhog** | http://localhost:8025 | Inspect submitted emails |
| **PostgreSQL** | localhost:5432 | DB (user: `rangefinder`, pass: `password`) |

DB migrations run automatically on app startup.

### 3. Submit a form

1. Open http://localhost:3000
2. Fill out and submit either form
3. Check http://localhost:8025 — the notification email appears in Mailhog
4. Connect to the DB with any Postgres client (TablePlus, DBeaver, psql) at `localhost:5432`

### Stop services

```bash
docker-compose down          # stop containers, keep DB volume
docker-compose down -v       # stop containers AND delete DB data
```

### Tail logs

```bash
docker-compose logs -f app
```

---

## 🔌 API Reference

### `POST /api/range-request`

Accepts a JSON body matching the fields in `request-range.html`. Checkbox fields are arrays.

**Example request:**
```json
{
  "org_name": "Acme Aerospace LLC",
  "org_type": "commercial",
  "contact_name": "Jane Smith",
  "contact_email": "jane@acme.com",
  "uxs_domain": "uas",
  "platform_type": "Fixed-wing MALE UAS",
  "test_objectives": "Autonomous navigation and endurance testing",
  "classification": "unclassified",
  "capabilities": ["airspace", "bvlos", "instrumentation"],
  "date_start": "2025-06-01",
  "date_end": "2025-06-07",
  "duration": "1-week"
}
```

**Success response (201):**
```json
{ "success": true, "id": 1, "ref": "RR-0001" }
```

### `POST /api/affiliate`

Accepts a JSON body matching the fields in `become-affiliate.html`.

**Success response (201):**
```json
{ "success": true, "id": 1, "ref": "AF-0001" }
```

### `GET /health`

Returns `{ "status": "ok", "timestamp": "..." }` — used by ALB health checks.

---

## 🗄️ Database Schema

### `range_requests`

| Column | Type | Notes |
|---|---|---|
| `id` | `SERIAL PK` | Auto-incrementing — used as `RR-XXXX` reference |
| `submitted_at` | `TIMESTAMPTZ` | UTC timestamp |
| `org_name` | `TEXT NOT NULL` | |
| `org_type` | `TEXT NOT NULL` | commercial, dod, federal, academic, startup, other |
| `contact_name` | `TEXT NOT NULL` | |
| `contact_email` | `TEXT NOT NULL` | |
| `uxs_domain` | `TEXT NOT NULL` | uas, ugs, usv, uuv, multi |
| `capabilities` | `TEXT[]` | Multi-select checkbox values |
| `date_start` | `DATE NOT NULL` | |
| `date_end` | `DATE NOT NULL` | |
| `status` | `TEXT` | new → in-review → matched → closed |
| *(+ 10 more fields)* | | See `001_range_requests.sql` |

### `affiliate_applications`

| Column | Type | Notes |
|---|---|---|
| `id` | `SERIAL PK` | Auto-incrementing — used as `AF-XXXX` reference |
| `submitted_at` | `TIMESTAMPTZ` | UTC timestamp |
| `range_name` | `TEXT NOT NULL` | |
| `range_state` | `TEXT NOT NULL` | |
| `domains` | `TEXT[]` | uas, ugs, usv, uuv |
| `airspace` | `TEXT[]` | Airspace authorization checkboxes |
| `infrastructure` | `TEXT[]` | Infrastructure checkboxes |
| `status` | `TEXT` | pending → approved → rejected |
| *(+ 14 more fields)* | | See `002_affiliate_applications.sql` |

---

## ☁️ AWS Deployment

See [`plans/aws-deployment.md`](plans/aws-deployment.md) for the full step-by-step guide.

**Summary of services used:**

| AWS Service | Purpose |
|---|---|
| **ECR** | Container image registry |
| **ECS Fargate** | Serverless container hosting (no EC2) |
| **RDS PostgreSQL** | Managed database (`db.t3.micro`) |
| **ALB** | HTTPS load balancer + TLS termination |
| **SES** | Transactional email delivery |
| **Secrets Manager** | Secure credential storage |
| **ACM** | Free TLS certificate for the domain |

**Estimated cost:** ~$40/month for a minimal single-task production setup.

### Quick deploy (after initial setup)

```bash
# Build and push new image to ECR
docker build -t rangefinder .
docker tag rangefinder:latest $ECR_URI:latest
docker push $ECR_URI:latest

# Force ECS to pull the new image
aws ecs update-service \
  --cluster rangefinder \
  --service rangefinder \
  --force-new-deployment \
  --region us-east-1
```

---

## 🔒 Security

- All DB queries use parameterized placeholders (`$1, $2, ...`) — no SQL injection risk
- User input is sanitized and whitelisted server-side before DB insertion
- `helmet` sets security headers on every response
- `express-rate-limit` caps form submissions at 10/hour per IP
- `.env` files are excluded from git and Docker image
- Production credentials live in AWS Secrets Manager, never in source code

---

## 🎨 Design System

| Token | Hex | Usage |
|---|---|---|
| `--color-primary` | `#4A90C4` | Metallic blue — buttons, links, accents |
| `--color-dark` | `#1A2E3B` | Deep navy — navbar, footer, headings |
| `--color-surface` | `#EAF4FB` | Near-white blue tint — page background |

**Fonts:** [Rajdhani](https://fonts.google.com/specimen/Rajdhani) (headings) + [Inter](https://fonts.google.com/specimen/Inter) (body)

---

## 🛩️ Supported UxS Domains

| Domain | Description |
|---|---|
| ✈️ **UAS** | Unmanned Aerial Systems — fixed-wing, rotary, VTOL, tethered |
| 🚗 **UGS** | Unmanned Ground Systems — wheeled, tracked, legged platforms |
| 🚢 **USV** | Unmanned Surface Vessels — autonomous surface craft |
| 🤿 **UUV** | Unmanned Underwater Vehicles — AUVs, ROVs, gliders, torpedoes |

---

## 📄 License

© 2025 RangeFinder Network / Strategic Mission Elements. All rights reserved.
