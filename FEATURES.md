# St. Mark Legacy Food Pantry — Features

> Offline-first PWA for food pantry client & volunteer tracking at St. Mark UMC
> Version: v1.0.0 | Stack: React 19, Vite 7, TypeScript, Dexie.js (IndexedDB), Tailwind CSS 4, shadcn/ui

---

## Dashboard (`/`)

- **Today's stats**: clients served, volunteers on duty, monthly unique clients
- **Quick actions**: Start Check-In, Register Client, Volunteers, View Reports
- **Recent check-ins**: last 5 today with client name + timestamp
- **Inactive clients alert**: yellow banner showing count of clients not visited this month → links to inactive report

---

## Client Management

### Client List (`/clients`)
- Searchable roster with name, family size, phone, city/state
- Link to bulk QR card printing

### Add / Edit Client (`/clients/new`, `/clients/:id/edit`)
- Name, phone, email, perishable food preference toggle
- Address (street, city, state defaults to TX, zip)
- Dynamic family members list (name, relationship, age) with auto-calculated family size
- Duplicate detection on name entry
- Notes field

### Client Detail (`/clients/:id`)
- Full info display with contact links
- Monthly visit warning badge
- QR card toggle (show/hide)
- Family members with relationships and ages
- Complete visit history (date, day, served by, items received when inventory enabled)
- Edit and delete with confirmation dialog

### QR Cards (`/clients/cards`)
- Search/filter + select all
- Print 2-column grid (3.5 × 2 in cards)
- Each card: header, QR code, name, family size

---

## Check-In (`/checkin`)

- **Day toggle**: Monday / Friday (auto-detects)
- **Served by**: volunteer name field (persists for session)
- **Client search**: real-time fuzzy search (Fuse.js), supports "Last, First" format
- **QR scanner**: camera-based scan via html5-qrcode
- **Monthly duplicate warning**: dialog with override option
- **Items received dialog** (when inventory enabled): free-text items entry after check-in
- **Today's visitors list**: live-updating with client names and times
- **Floating FAB**: quick link to register new client

---

## Volunteer Management

### Volunteer List (`/volunteers`)
- Searchable roster with name, recurring day badges (Mon/Fri), contact info
- Links to check-in and schedule pages

### Add / Edit Volunteer (`/volunteers/new`, `/volunteers/:id/edit`)
- Name, phone, email, notes
- Recurring schedule checkboxes (Every Monday, Every Friday)

### Volunteer Check-In (`/volunteers/checkin`)
- Day toggle (Monday/Friday)
- Search volunteers by name
- Role selection: Intake, Distribution, Setup, Cleanup, Other
- Today's volunteers list with role badges and recurring indicators

### Volunteer Schedule (`/volunteers/schedule`)
- 4-week lookahead of Monday/Friday sessions
- Per-date volunteer list with badges (recurring, signed up, role)
- Sign-up dialog: search + optional role assignment
- Exception handling: excuse recurring volunteers, remove one-off signups

---

## Reports & Analytics (`/reports`)

### Today's Summary
- Clients served (unique), volunteers, family members served

### Monthly Summary
- Unique clients, total visits, volunteer shifts, volunteer hours

### Monthly Visits Chart
- Horizontal bar chart — last 12 months

### Inactive Clients Link
- Card linking to `/reports/inactive` with icon and description

### Items Distributed (when inventory enabled)
- Cards showing client name, date, and items text for the current month

### Print Visit Log
- Printable visit log component

### Excel Exports
- Client list, visit log, volunteer log (multi-sheet: volunteers + shifts)

---

## Inactive Clients Report (`/reports/inactive`)

- **Filter pills**: 30 / 60 / 90 days
- **Summary badge**: "X clients haven't visited in Y+ days"
- **Client list**: name (linked to detail), family size badge, last visit date or "Never visited", days-since badge (red at 90+)
- **Excel export**: First Name, Last Name, Family Size, Phone, Last Visit, Days Since

---

## Settings (`/settings`)

### Features
- **Inventory Tracking** toggle (persists in localStorage)
  - When on: items dialog after check-in, items shown in visit history and reports
  - When off: all inventory UI hidden

### Data Management
- Export all data (JSON backup)
- Import data (JSON restore — replaces all data)
- Export clients + visits (Excel)

### Spreadsheet Import (3-step wizard)
1. **Upload**: drag & drop CSV/XLSX/XLS, preview first 5 rows
2. **Map columns**: auto-detection with manual override, supports "Full Name" auto-split
3. **Review & import**: duplicate detection, skip toggle, progress bar, completion summary

### Google Sheets Export
- CSV downloads: client list, visit log, volunteer log

### About
- App name, version, data storage note

---

## Technical Infrastructure

### Offline-First (PWA)
- All data in IndexedDB via Dexie.js
- Service worker with auto-update
- Runtime caching for Google Fonts
- Installable on mobile (standalone mode, portrait)
- Theme: #2D5016 green, #FEFCE8 cream background

### Database (Dexie v3 schema)
| Table | Key Indexes |
|-------|-------------|
| `clients` | id, firstName, lastName, [firstName+lastName], createdAt |
| `visits` | id, clientId, date, [clientId+date], dayOfWeek |
| `volunteers` | id, firstName, lastName, createdAt |
| `volunteerShifts` | id, volunteerId, date, dayOfWeek |
| `volunteerSignups` | id, volunteerId, date, [volunteerId+date], dayOfWeek, status |

### Search
- Fuse.js fuzzy search for clients (weighted: name 70%, phone 15%, address 15%)
- Fuse.js fuzzy search for volunteers (weighted: name 80%, phone 10%, email 10%)
- Supports "Last, First" input format

### Navigation
- Bottom nav: Home | Clients | Check-In | Reports | Settings
- Volunteers accessible from Dashboard quick actions and direct URLs

---

## Route Map

| Route | Page |
|-------|------|
| `/` | Dashboard |
| `/checkin` | Check-In |
| `/clients` | Client List |
| `/clients/new` | Add Client |
| `/clients/:id` | Client Detail |
| `/clients/:id/edit` | Edit Client |
| `/clients/cards` | Print QR Cards |
| `/volunteers` | Volunteer List |
| `/volunteers/new` | Add Volunteer |
| `/volunteers/:id` | Volunteer Detail |
| `/volunteers/:id/edit` | Edit Volunteer |
| `/volunteers/checkin` | Volunteer Check-In |
| `/volunteers/schedule` | Volunteer Schedule |
| `/reports` | Reports & Analytics |
| `/reports/inactive` | Inactive Clients Report |
| `/settings` | Settings & Data Management |
