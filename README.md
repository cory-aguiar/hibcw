# KIAA Benefits OS — Developer Handoff

## Overview
A multi-tenant benefits management platform for Kanoelehua Industrial Area Association (KIAA).
Manages 200+ employer clients across HMSA group health plans.

## Tech Stack
- **Frontend**: React 18 + Vite
- **Auth & Database**: Supabase (PostgreSQL + Row Level Security)
- **Hosting**: Vercel (free tier)
- **Styling**: Tailwind CSS
- **Icons**: Lucide React

## User Roles
| Role | Access |
|------|--------|
| `super_admin` | Full access — all companies, all data, system settings |
| `staff` | All companies read/write, cannot manage users or billing |
| `hr_client` | Own company only — SPD viewer, forms, compliance status |

## Features (v1)
1. Company Registry — create/edit/delete client companies
2. Compliance Dashboard — auto COBRA/FMLA/ERISA status by employee count
3. SPD Builder — generate company-specific SPD text
4. Plan Comparison — all 7 HMSA plans side by side
5. Forms & Links Library — organized by type (enrollment, COBRA, FMLA, HIPAA, HMSA)
6. Client Portal — HR login sees only their own company
7. Renewal Tracker — renewal dates + task reminders per company

## Project Structure
```
kiaa-benefits-os/
├── src/
│   ├── components/       # Reusable UI components
│   ├── pages/            # Route-level page components
│   ├── lib/
│   │   ├── supabase.js   # Supabase client
│   │   ├── plans.js      # HMSA plan data
│   │   └── compliance.js # Compliance threshold logic
├── supabase/
│   └── migrations/       # SQL schema files
├── docs/
│   └── ARCHITECTURE.md
├── .env.example
├── package.json
└── vite.config.js
```

## Quick Start
```bash
# 1. Clone / unzip project
cd kiaa-benefits-os

# 2. Install dependencies
npm install

# 3. Copy env file and fill in Supabase credentials
cp .env.example .env.local

# 4. Run Supabase migrations (see supabase/migrations/)

# 5. Start dev server
npm run dev
```

## Deployment (Vercel)
1. Push repo to GitHub
2. Import repo at vercel.com
3. Add environment variables (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY)
4. Deploy — done

## Environment Variables
```
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

## First-Time Setup After Deploy
1. Go to Supabase → Authentication → Users → Invite your email
2. Sign in to the app
3. In Supabase SQL editor, run:
   UPDATE profiles SET role = 'super_admin' WHERE email = 'your@email.com';
4. You now have full admin access
