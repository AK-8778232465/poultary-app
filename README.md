# Gaikwad Poultry App

Mobile-first single-page order dashboard for Gaikwad Poultry, built with Next.js App Router for Vercel and Supabase as the backend.

## Features

- Private PIN login with secure HTTP-only session cookie
- Mobile-first single-screen dashboard with tabs for `New Order`, `Today`, `History`, and `Shops`
- Daily rate management with future-only pricing changes
- Fast order entry with recent shops and live amount calculation
- Shop management with archive guard when active orders still exist
- History KPIs with date grouping and filter modes
- Soft-delete orders so totals remain safe and auditable

## Environment Variables

Create `.env.local`:

```env
APP_PIN_HASH=
APP_SESSION_SECRET=
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
```

Generate the PIN hash in Node:

```bash
node -e "console.log(require('crypto').createHash('sha256').update('1234').digest('hex'))"
```

Use a long random value for `APP_SESSION_SECRET`.

## Supabase Setup

Run:

- [20260422_create_gaikwad_poultry.sql](/c:/Users/sipl2443/Test%20Projects/gaikwad-poultry-app/supabase/migrations/20260422_create_gaikwad_poultry.sql)

This creates:

- `shops`
- `daily_rates`
- `orders`

## Run Locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Quality Checks

```bash
npm run lint
npm run test
```

## Deployment Notes

- Deploy to Vercel as a standard Next.js app
- Add all environment variables in Vercel project settings
- The app uses server-side Supabase access, so `SUPABASE_SERVICE_ROLE_KEY` must stay server-only
