# Deploy Amar Residence Online

This guide puts the hotel system on the internet so staff (and you as owner) can log in from anywhere — front desk, home, or on the road — and view bookings on the **Dashboard** and **Reservation Calendar**.

**Recommended host:** [Railway](https://railway.app) (app + database in one place, HTTPS included).

---

## Before you deploy

1. **GitHub account** — [github.com](https://github.com)
2. **Railway account** — sign in with GitHub at [railway.app](https://railway.app)
3. This project uses **PostgreSQL** (not SQLite) so data persists in the cloud.

---

## Step 1 — Push code to GitHub

Open PowerShell in the project folder:

```powershell
cd C:\Users\Admin\Projects\amar-residence
git init
git add .
git commit -m "Prepare Amar Residence for deployment"
```

On GitHub, create a new **private** repository named `amar-residence`, then:

```powershell
git remote add origin https://github.com/YOUR_USERNAME/amar-residence.git
git branch -M main
git push -u origin main
```

Replace `YOUR_USERNAME` with your GitHub username.

---

## Step 2 — Create Railway project

1. Go to [railway.app/new](https://railway.app/new)
2. **Deploy from GitHub repo** → choose `amar-residence`
3. Railway detects Next.js and uses `railway.toml` automatically

---

## Step 3 — Add PostgreSQL

1. In your Railway project, click **+ New**
2. Choose **Database → PostgreSQL**
3. Wait until the database is running
4. Open the **PostgreSQL** service → **Variables** → copy `DATABASE_URL`

---

## Step 4 — Configure the web service

1. Open your **web app** service (not the database)
2. Go to **Variables** and add:

| Variable | Value |
|----------|--------|
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` (use Railway reference) **or** paste the full URL |
| `AUTH_SECRET` | A long random string (see below) |
| `SEED_ADMIN_PASSWORD` | Strong password for the first admin account (min 6 characters) |
| `SEED_ADMIN_EMAIL` | Optional — defaults to `admin@amarresidence.com` |
| `NEXT_PUBLIC_APP_NAME` | `Amar Residence` |

**Generate AUTH_SECRET** (PowerShell):

```powershell
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }) -as [byte[]])
```

Never use the demo secret from `.env.example` in production.

3. **Deploy** — Railway builds and runs `npm run db:deploy` automatically (schema + first-time seed).

---

## Step 5 — Get your public URL

1. Web service → **Settings** → **Networking** → **Generate Domain**
2. You get a URL like: `https://amar-residence-production.up.railway.app`
3. Open it in a browser → you should see the **login page**

---

## Step 6 — First login and reset demo data

On first deploy, the app creates **one administrator** and loads all **18 rooms as vacant** — no sample guests or bookings.

| | |
|--|--|
| **Email** | Value of `SEED_ADMIN_EMAIL` (default `admin@amarresidence.com`) |
| **Password** | Value of `SEED_ADMIN_PASSWORD` you set in Railway |

Log in as **Administrator**, then:

1. Go to **Employee Accounts** → add front desk and housekeeping staff
2. Update **Settings** with your hotel address and contact details
3. Start creating real reservations and check-ins

### Clear existing demo data (already deployed)

If your database still has sample guests/bookings from an older seed, reset it from your PC:

```powershell
cd C:\Users\Admin\Projects\amar-residence
$env:DATABASE_URL = "paste-your-railway-postgres-url-here"
$env:SEED_ADMIN_PASSWORD = "your-new-admin-password"
npm run db:reset
```

This **deletes all data** and reloads vacant rooms plus one admin account.

---

## Step 7 — Optional custom domain

If you own `amarresidence.com`:

1. Railway → web service → **Settings** → **Custom Domain**
2. Add e.g. `hms.amarresidence.com`
3. Add the CNAME record at your domain registrar (Railway shows the target)

---

## Local development (after PostgreSQL switch)

```powershell
docker compose up -d
copy .env.example .env
npm run db:deploy
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## Alternative hosts

| Host | Config file |
|------|----------------|
| **Render** | `render.yaml` — import as Blueprint |
| **Docker** (VPS, Fly.io) | `Dockerfile` + `docker-entrypoint.sh` |

Same environment variables: `DATABASE_URL`, `AUTH_SECRET`, `NEXT_PUBLIC_APP_NAME`.

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Build fails on Prisma | Ensure `DATABASE_URL` is set on Railway before deploy |
| Login works but no rooms | Run **Redeploy** — release command runs `db:deploy` |
| “Unauthorized” / session issues | Set `AUTH_SECRET` and redeploy |
| Owner can't access Settings | Log in as **Administrator**, not Front Desk |

---

## Costs (approximate)

- **Railway**: free trial credits, then roughly **$5–15/month** for a small app + Postgres
- **Neon Postgres** (if using Vercel): free tier available

---

## What stays private

- Guest data and bookings live in your PostgreSQL database
- Only people with login credentials can access the system
- Use strong passwords and keep the GitHub repo **private**
