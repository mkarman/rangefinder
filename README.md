# 🎯 RangeFinder

**Connecting UxS Engineers and Flight Testers with the Ranges They Need**

RangeFinder is a static web platform that links unmanned systems (UxS) engineers, program offices, and flight test teams with certified test ranges across all operational domains — air, ground, surface, and subsurface.

---

## 🌐 Live Site

> Deploy via GitHub Pages: **Settings → Pages → Branch: `main` / root**
> Site will be available at: `https://mkarman.github.io/rangefinder`

---

## 📁 Project Structure

```
rangefinder/
├── index.html              # Landing page
├── request-range.html      # Range Access intake form
├── become-affiliate.html   # Affiliate application form
├── css/
│   └── styles.css          # Shared stylesheet (~1,300 lines)
├── js/
│   └── main.js             # Shared JavaScript (~220 lines)
├── .gitignore
└── README.md
```

---

## 📄 Pages

### `index.html` — Landing Page
- Fixed navbar with logo, nav links, and "Request Access" CTA; collapses to hamburger on mobile
- Full-viewport hero with **aerial drone imagery** backdrop, metallic blue gradient overlay, animated badge, tagline, and two primary CTA buttons
- Domain strip showcasing all 4 supported UxS domains
- Two-card CTA section linking to each intake form
- Info strip with network statistics
- Full footer with navigation, resources, and contact links

### `request-range.html` — Request Range Access
Intake form for engineers and test teams seeking range support. Sections:
1. **Organization & Contact** — org name, type, contact info
2. **UxS System & Mission** — domain, platform type, test objectives, classification level
3. **Range Requirements** — required capabilities (checkboxes), preferred region, team size
4. **Scheduling & Timeline** — date range, duration, flexibility
5. **Additional Information** — special requirements, referral source, terms agreement

### `become-affiliate.html` — Become an Affiliate
Application form for range operators and test facilities. Sections:
1. **Organization & Contact** — org name, type, contact info, website
2. **Range Information** — range name, state, location, acreage, years operating
3. **Supported UxS Domains** — UAS / UGS / USV / UUV checkboxes
4. **Capabilities & Infrastructure** — airspace authorizations, available infrastructure
5. **Availability & Capacity** — general availability, max team size, range description, limitations
6. **Agreement & Submission** — accuracy confirmation, terms agreement

---

## 🎨 Design System

### Color Palette

| Token | Hex | Usage |
|---|---|---|
| `--color-primary` | `#4A90C4` | Metallic blue — buttons, links, accents |
| `--color-primary-dark` | `#2E6A9E` | Hover states |
| `--color-primary-light` | `#A8D4F0` | Pale sky blue — badges, borders |
| `--color-accent` | `#7EC8E3` | Bright aqua — highlights, logo accent |
| `--color-surface` | `#EAF4FB` | Near-white blue tint — page background |
| `--color-dark` | `#1A2E3B` | Deep navy — navbar, footer, headings |
| `--color-dark-mid` | `#2C4A5E` | Mid-dark — info strip background |

### Typography
- **Headings:** [Rajdhani](https://fonts.google.com/specimen/Rajdhani) — technical, military feel
- **Body:** [Inter](https://fonts.google.com/specimen/Inter) — clean, readable

### Responsive Breakpoints
| Breakpoint | Behavior |
|---|---|
| `> 1024px` | Full desktop layout, sticky sidebar on form pages |
| `≤ 1024px` | Sidebar moves below form, 2-column footer |
| `≤ 768px` | Hamburger nav, stacked CTA buttons, single-column forms |
| `≤ 480px` | Single-column domain cards, simplified step indicator |

---

## 🛩️ Supported UxS Domains

| Domain | Description |
|---|---|
| ✈️ **UAS** | Unmanned Aerial Systems — fixed-wing, rotary, VTOL, tethered |
| 🚗 **UGS** | Unmanned Ground Systems — wheeled, tracked, legged platforms |
| 🚢 **USV** | Unmanned Surface Vessels — autonomous surface craft |
| 🤿 **UUV** | Unmanned Underwater Vehicles — AUVs, ROVs, gliders, torpedoes |

---

## ⚙️ JavaScript Features (`js/main.js`)

- **Navbar scroll effect** — `.scrolled` class applied after 20px scroll for backdrop blur intensification
- **Mobile hamburger toggle** — with body scroll lock and outside-click dismissal
- **Smooth scroll** — anchor links with navbar height offset compensation
- **Form validation** — required fields, email format, URL format, future date enforcement, date range logic, radio/checkbox group validation
- **Live blur validation** — errors clear as user corrects input
- **Simulated form submission** — loading state → success message (replace `setTimeout` with `fetch()` when backend is ready)
- **Active nav link highlighting** — based on current page filename
- **Hero parallax** — subtle `translateY` on scroll (respects `prefers-reduced-motion`)

---

## 🚀 Getting Started

No build tools or dependencies required. Open directly in a browser:

```bash
# Clone the repo
git clone https://github.com/mkarman/rangefinder.git
cd rangefinder

# Open in browser (Windows)
start index.html

# Open in browser (macOS)
open index.html
```

Or serve locally with any static file server:

```bash
# Python
python -m http.server 8080

# Node.js (npx)
npx serve .
```

---

## 🗺️ Roadmap

- [ ] Backend form submission (API endpoint or form service integration)
- [ ] Range directory / searchable affiliate listing page
- [ ] User authentication for returning test teams
- [ ] Admin dashboard for range coordinators
- [ ] Email notification system for form submissions
- [ ] Interactive map of affiliated ranges
- [ ] Mobile app (React Native)

---

## 📜 License

© 2025 RangeFinder Network. All rights reserved.

---

## 📬 Contact

- **Range Access:** ranges@rangefinder.aero
- **Affiliate Partnerships:** affiliates@rangefinder.aero
- **General:** info@rangefinder.aero
