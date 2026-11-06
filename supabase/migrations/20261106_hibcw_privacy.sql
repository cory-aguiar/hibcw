-- ════════════════════════════════════════════════════════════════════
-- HIBCW — Privacy fixes   (2026-11-06)
--
-- Run ONCE in Supabase → SQL Editor, AFTER 20261104_hibcw_rate_limits.sql.
-- Safe to re-run.  Upload the updated index.html and index-mobile.html
-- at the same time: the old pages ask for every column and would get a
-- "permission denied" error once this is in place.
--
-- 1. The public can no longer read a reporter's name or email.
--    Staff (signed in) still see everything, exactly as before.
-- 2. The "is this email a KIAA member?" check on the report form is
--    rate-limited, so nobody can test a long list of addresses.
-- 3. The public "District Captains" list returns only the captains.
--    Before: every approved member's application carries its district
--    captain's name, so the view exposed EVERY approved member's name,
--    email and photo. Now: one row per district; contact details only
--    for the captain's own record.
-- ════════════════════════════════════════════════════════════════════

-- ── 1. Column-level read access for the public ──────────────────────
-- Row access is still decided by the existing policies (public sees only
-- active reports). This adds a second layer: which COLUMNS anon may read.
revoke select on public.incidents from anon;
grant select (
  id, created_at, type, type_color, occurred_at, address, description,
  police_report,
  suspect_height, suspect_build, suspect_age, suspect_gender, suspect_race,
  suspect_clothing, suspect_other,
  vehicle_make, vehicle_model, vehicle_color, vehicle_year, vehicle_plate, vehicle_notes,
  lat, lng, status, is_recurring, is_verified_member, district
) on public.incidents to anon;
-- (reporter_name and reporter_email are deliberately NOT in this list.)

-- Staff sign in as "authenticated"; keep their full access.
grant select on public.incidents to authenticated;

-- ── 2. Rate-limit the member-email check ────────────────────────────
insert into private.hibcw_rate_settings values
  ('member_check', 30, '10 minutes', 150, 3000, '1 hour',
   'Too many membership checks from this connection. Please try again later.')
on conflict (bucket) do nothing;

drop function if exists public.hibcw_is_member_email(text);
create function public.hibcw_is_member_email(p_email text)
returns boolean
language plpgsql volatile security definer
set search_path = public, private, pg_temp
as $$
begin
  perform private.hibcw_rate_check('member_check');
  return exists (select 1 from public.member_emails
                  where lower(email) = lower(trim(p_email)));
end;
$$;
revoke all on function public.hibcw_is_member_email(text) from public;
grant execute on function public.hibcw_is_member_email(text) to anon, authenticated;

-- ── 3. District Captains list: captains only ────────────────────────
create or replace view public.public_captains as
select distinct on (district)
       district,
       case when is_captain then full_name else captain_name end as full_name,
       case when is_captain then email     else null         end as email,
       case when is_captain then photo_url else null         end as photo_url,
       captain_name
  from (select district, full_name, email, photo_url, captain_name, created_at,
               lower(trim(coalesce(full_name, ''))) = lower(trim(captain_name)) as is_captain
          from public.member_applications
         where status = 'approved' and captain_name is not null and captain_name <> '') s
 order by district, is_captain desc, created_at desc;
alter view public.public_captains set (security_invoker = false);
grant select on public.public_captains to anon, authenticated;
