# HIBCW security update: rate limits and locked email functions (Nov 2026)

## Why
- The Report, Join and Register forms write straight to Supabase with the public key that's built into every page. Anyone could script thousands of fake reports onto the live map, or flood the applications.
- Photo uploads had no size, type or count limits.
- The five email functions run with sign-in checks turned off and never checked who was calling. Anyone could send an official-looking "HIBCW District Alert" from noreply@support.kiaahilo.org to a district's members, or send approval emails to any address.

## What's in this update
| File | What it does |
|---|---|
| `supabase/migrations/20261104_hibcw_rate_limits.sql` | Database limits (below). Run once in the SQL Editor. |
| `supabase/functions/_shared/require-staff.ts` | New: checks that the caller is signed-in HIBCW staff. |
| `supabase/functions/*/index.ts` (all 5) | Now require staff. Captains can only send alerts to their own district. |

The website pages did not change. The forms already show the database's message, for example: *"You've sent several reports in a short time. Please wait a few minutes and try again. For emergencies, call 911."*

### Limits (staff are never limited)
| Submission | Per connection | Island-wide |
|---|---|---|
| Incident report | 6 per 10 min, 30 per day | 150 per hour |
| Membership application | 5 per hour, 10 per day | 60 per hour |
| Business registration | 5 per hour, 10 per day | 60 per hour |
| Photo/video upload | 40 per hour, 100 per day | 300 per hour |

Also:
- Photos and videos: 50 MB max per file, images and video only, 10 per report, and only while the report is being sent (within 30 minutes of it being created).
- Photo links must point to HIBCW's own storage.
- Very large submissions (over about 20 KB of text) are refused.

Internet addresses are stored only as a one-way hash, and the log deletes itself after 2 days.

## How to install (about 10 minutes)
1. **Database.** In Supabase Dashboard → SQL Editor, open a new query. Paste all of `supabase/migrations/20261104_hibcw_rate_limits.sql` and click **Run**. It's safe to run again.
2. **Email functions.** From the repo folder, using the Supabase CLI:
   ```
   supabase functions deploy send-approval-email --no-verify-jwt
   supabase functions deploy send-denial-email --no-verify-jwt
   supabase functions deploy send-member-approval-email --no-verify-jwt
   supabase functions deploy send-member-denial-email --no-verify-jwt
   supabase functions deploy send-district-alert-email --no-verify-jwt
   ```
   The `_shared` folder is included automatically. No new secrets are needed.
   **No CLI?** In Supabase Dashboard → Edge Functions, open each function, replace its code with the matching file from `supabase/dashboard-paste/`, and deploy. Those files have the staff check built in.
3. **Check it worked.**
   - Submit one test report on the live site. Then run this in the SQL Editor:
     ```sql
     select bucket, ip_hash is not null as address_seen, created_at
       from private.hibcw_rate_events order by created_at desc limit 5;
     ```
     `address_seen` should be **true**. If it's false, the per-connection limits are inactive, but the island-wide caps still protect the site.
   - Sign in to the admin, approve or deny something, and confirm the email still sends.

## Presentation day (11/19)
A room full of people on the same venue Wi-Fi counts as one connection. Loosen the limits before the demo:
```sql
update private.hibcw_rate_settings set per_ip_max = 60, per_ip_day_max = 300
 where bucket in ('report','apply','register');
```
Afterward, put them back:
```sql
update private.hibcw_rate_settings set per_ip_max = 6, per_ip_day_max = 30 where bucket = 'report';
update private.hibcw_rate_settings set per_ip_max = 5, per_ip_day_max = 10 where bucket in ('apply','register');
```

## Also worth checking
- `invite-staff` is called by admin.html, but its code isn't in this repo, so I couldn't check it. Make sure it also confirms the caller is a superadmin.
- Reports appear on the public map immediately. If spam still gets through, an option is to hold first-time reports for staff review.

## How it was tested
- The migration was loaded twice on Postgres 16 on top of the repo's `schema.sql`. Then 43 checks ran as an anonymous visitor: the 7th rapid report was blocked while another connection still worked; staff were never blocked; the 10th photo on a report worked and the 11th was refused; uploads to old or made-up reports, links to outside sites and non-photo files were refused; the island-wide cap held across different addresses; and the member badge still worked.
- All five email functions pass Deno type-checking. The staff check refused a missing token, the public website key, and a signed-in non-staff account, and accepted a signed-in captain.
