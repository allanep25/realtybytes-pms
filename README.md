# Amar Residence — Hotel Management System

Web-based HMS for **Amar Residence**, scaffolded from the SunnyView-style dashboard design (Phase 0).

## Stack

- **Next.js 15** (App Router) + TypeScript
- **Tailwind CSS v4** — design tokens for sidebar + room status colors
- **Prisma** + **PostgreSQL** (SQLite was used early in development; production uses Postgres)
- **Lucide React** — navigation icons

## Phase 0

- [x] Project structure and dependencies
- [x] Prisma schema (rooms, guests, reservations, folios, employees, housekeeping)
- [x] Seed script (room catalog + admin bootstrap)
- [x] App shell: dark sidebar, top bar, routing placeholders
- [x] Dashboard with KPI cards + room status grid

## Phase 1

- [x] Reservation Gantt calendar (dashboard preview + `/calendar` full view)
- [x] Today's revenue from folio payments with % vs yesterday

## Phase 2

- [x] Room numbers **21–28** (floor 2) and **31–38** (floor 3)
- [x] Room Management: filter by status/type/floor, edit status/type/rate
- [x] Calendar: week navigation, click booking for detail drawer

## Phase 3

- [x] Check-in form: guest info, room selection, date conflict checks
- [x] Auto room type/rate display; creates reservation, folio, sets room occupied
- [x] Check-out: select active stay, balance summary, payment, room → dirty

## Phase 4

- [x] Guest list with search; profile page with VIP badge, notes, stay history
- [x] Edit guest profile
- [x] Billing: open folios, line items, presets, discount, record payment

## Phase 5

- [x] Official room rates (₱1,950 – ₱5,100 per rate card)
- [x] Housekeeping: assign staff, Mark Clean / Dirty / Out of Order
- [x] Employee accounts: list, add, activate/deactivate

## Phase 6

- [x] Reports: daily sales, occupancy, revenue summary with KPI stats
- [x] Export Excel (CSV) and PDF (printable HTML)
- [x] Receipt preview with hotel branding, OR #, itemized charges, Print

## Phase 7 (complete)

- [x] Staff login with JWT session (8-hour cookie)
- [x] Role-based navigation: Administrator, Front Desk, Housekeeping
- [x] Settings page: hotel branding, tax rate, receipt footer (admin only)
- [x] Sign out from user menu

Set `SEED_ADMIN_PASSWORD` in `.env` before running `npm run db:seed` or `npm run db:reset`.

## Getting started

### 1. Install dependencies

```bash
cd C:\Users\Admin\Projects\amar-residence
npm install
```

### 2. Configure database

Start local PostgreSQL:

```powershell
docker compose up -d
copy .env.example .env
```

Edit `.env` if needed (default matches `docker-compose.yml`).

### 3. Push schema and seed

```powershell
npm run db:deploy
```

### 4. Run dev server

```powershell
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — you will be redirected to **/login**.

Add a strong `AUTH_SECRET` to `.env` (see `.env.example`).

## Deploy online (owner / staff remote access)

See **[DEPLOYMENT.md](./DEPLOYMENT.md)** for step-by-step instructions to publish on **Railway** with HTTPS so you can view bookings from anywhere.

Quick summary:

1. Push project to GitHub  
2. Connect Railway + add PostgreSQL  
3. Set `DATABASE_URL`, `AUTH_SECRET`, `NEXT_PUBLIC_APP_NAME`  
4. Open your public URL and log in as **Administrator**  
5. Change all demo passwords  

---

## Project structure

```
src/
├── app/(dashboard)/     # All HMS pages
├── components/
│   ├── layout/        # Sidebar, TopBar, AppShell
│   ├── dashboard/     # StatCard, RoomStatusGrid
│   └── ui/
└── lib/               # db, format, constants, dashboard-data
prisma/
├── schema.prisma
└── seed.ts
```

## Navigation routes

| Route | Module |
|-------|--------|
| `/` | Dashboard |
| `/rooms` | Room Management |
| `/calendar` | Reservation Calendar |
| `/check-in` | Check-In / Check-Out |
| `/guests` | Guest Profiles |
| `/billing` | Billing |
| `/reports` | Reports |
| `/employees` | Employee Accounts |
| `/housekeeping` | Housekeeping |
| `/receipts` | Receipt Printing |
| `/settings` | Settings (Admin) |
| `/login` | Staff login |

## All phases complete

Phases 0–7 are implemented. Future enhancements could include online booking, payment gateways, and multi-property support.

## Design tokens

| Token | Usage |
|-------|--------|
| `#1a233a` | Sidebar background |
| Blue `#4a90e2` | Occupied |
| Green `#5cb85c` | Vacant |
| Yellow `#f0ad4e` | Reserved |
| Red `#d9534f` | Dirty / maintenance |

Currency formatting uses Philippine Peso (₱) via `formatPHP()` in `src/lib/format.ts`.
