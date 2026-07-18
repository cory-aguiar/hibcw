# KIAA Benefits OS — Architecture & Developer Notes

## Color Palette (from brand)
| Name       | Hex       | Use |
|------------|-----------|-----|
| Mid aqua   | #118C87   | Primary interactive |
| Deep teal  | #0D6965   | Primary dark |
| Darkest    | #08403E   | Sidebar, headings |
| Bright aqua| #1BE3DC   | Logo accent, highlights |
| Medium aqua| #16BAB5   | Secondary actions |

## Role System
Three roles enforced at both the app (React Router) and database (RLS) level:

| Role | Login goes to | Can see |
|------|--------------|---------|
| `super_admin` | `/` dashboard | Everything. Can promote users. |
| `staff` | `/` dashboard | All companies read/write. Cannot manage users. |
| `hr_client` | `/portal` | Only their linked company's data. |

### How to create a new admin/staff user
1. Go to Supabase → Authentication → Users → Invite user
2. They receive an email and set a password
3. In Supabase SQL editor:
   ```sql
   UPDATE profiles SET role = 'staff' WHERE email = 'newstaff@kiaa.org';
   ```

### How to create a client (HR) login for a company
1. Invite user as above
2. In SQL editor:
   ```sql
   UPDATE profiles
   SET role = 'hr_client', company_id = 'THE-COMPANY-UUID-HERE'
   WHERE email = 'hr@clientcompany.com';
   ```
3. The company UUID is shown in the URL when you open a company in the app.

## Row Level Security (RLS) Summary
- `profiles`: Users see their own row; admin/staff see all
- `companies`: Admin/staff full access; hr_client reads only their company
- `tasks`: Admin/staff full access; hr_client reads tasks for their company
- `forms`: All authenticated users can read; admin/staff can write

## Adding a New Page
1. Create `src/pages/MyPage.jsx`
2. Add route in `src/main.jsx`
3. Add nav item in `src/components/Layout.jsx`

## Supabase Realtime (optional upgrade)
To make the dashboard live-update without refresh:
```js
supabase.channel('companies').on('postgres_changes', { event: '*', schema: 'public', table: 'companies' }, () => load()).subscribe()
```

## Email Notifications (future)
Supabase Edge Functions can send email reminders for renewal dates.
File: `supabase/functions/send-renewal-reminder/index.ts`
Use Resend (resend.com) — free tier handles 3,000 emails/month.

## Deployment Checklist
- [ ] Create Supabase project at supabase.com
- [ ] Run `supabase/migrations/001_schema.sql` in SQL editor
- [ ] Copy `.env.example` to `.env.local`, fill in credentials
- [ ] `npm install && npm run build` — confirm no errors
- [ ] Push to GitHub
- [ ] Import repo in Vercel, add env vars, deploy
- [ ] Invite yourself as first user, set role to super_admin in SQL
- [ ] Test login and all 7 pages
- [ ] Invite first client HR user, link to company

## Known Limitations / Future Enhancements
- Document file upload (PDFs) — requires Supabase Storage
- Email reminders for renewals — requires Supabase Edge Functions + email provider
- Audit log (who changed what) — add `audit_log` table
- Multi-language support — HMSA serves Spanish, Tagalog, Chinese, Navajo speakers
- Bulk CSV import for 200 companies — add import page with Papa Parse
