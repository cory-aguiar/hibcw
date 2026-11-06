-- ════════════════════════════════════════════════════════════════════
-- HIBCW — Rate limits and upload limits   (2026-11-04)
--
-- Run ONCE in Supabase → SQL Editor on the live project. Safe to re-run.
--
-- What it does
--   1. Caps how often one internet connection can submit a report,
--      a membership application, or a business registration, plus an
--      island-wide cap per hour so a flood from many addresses still stops.
--   2. Photo/video limits: 50 MB per file, images and video only, at most
--      10 per report, only within 30 minutes of that report being made,
--      and an hourly upload cap.
--   3. Rejects oversized submissions (huge text pasted into a field).
--   Staff (anyone in admin_roles) are never limited.
--
-- Change a limit later (example: loosen reports for a live demo):
--   update private.hibcw_rate_settings
--      set per_ip_max = 30 where bucket = 'report';
--
-- Connection addresses are stored only as a one-way hash, and the log
-- deletes itself after 2 days.
-- ════════════════════════════════════════════════════════════════════

create schema if not exists private;          -- not exposed through the API
revoke all on schema private from public;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on schema private from anon, authenticated';
  end if;
end $$;

create extension if not exists pgcrypto;

-- ── Settings (one row per kind of submission) ─────────────────────────
create table if not exists private.hibcw_rate_settings (
  bucket            text primary key,
  per_ip_max        int      not null,   -- max from one connection …
  per_ip_window     interval not null,   -- … within this window
  per_ip_day_max    int,                 -- optional daily cap per connection
  global_max        int      not null,   -- max from everyone …
  global_window     interval not null,   -- … within this window
  message           text     not null    -- what the visitor sees
);

insert into private.hibcw_rate_settings values
  ('report',   6, '10 minutes', 30, 150, '1 hour',
   'You''ve sent several reports in a short time. Please wait a few minutes and try again. For emergencies, call 911.'),
  ('apply',    5, '1 hour',     10,  60, '1 hour',
   'Too many applications from this connection. Please try again in an hour, or email hibcw@kiaahilo.org.'),
  ('register', 5, '1 hour',     10,  60, '1 hour',
   'Too many registrations from this connection. Please try again in an hour, or email hibcw@kiaahilo.org.'),
  ('media',   40, '1 hour',    100, 300, '1 hour',
   'Too many photo uploads from this connection. Please try again later.')
on conflict (bucket) do nothing;

-- ── Event log (hashed address, auto-pruned) ──────────────────────────
create table if not exists private.hibcw_rate_events (
  id         bigint generated always as identity primary key,
  bucket     text        not null,
  ip_hash    text,                       -- null when the address was not available
  created_at timestamptz not null default now()
);
create index if not exists hibcw_rate_events_ip  on private.hibcw_rate_events (bucket, ip_hash, created_at);
create index if not exists hibcw_rate_events_all on private.hibcw_rate_events (bucket, created_at);

-- Caller's address, from the headers Supabase's API passes to Postgres.
create or replace function private.hibcw_client_ip()
returns text
language plpgsql stable
as $$
declare
  h   json;
  ip  text;
begin
  begin
    h := nullif(current_setting('request.headers', true), '')::json;
  exception when others then
    return null;
  end;
  if h is null then return null; end if;
  ip := coalesce(
          nullif(trim(split_part(h->>'x-forwarded-for', ',', 1)), ''),
          nullif(trim(h->>'cf-connecting-ip'), ''),
          nullif(trim(h->>'x-real-ip'), ''));
  return ip;
end;
$$;

-- True only for requests from the website (the API's anon/authenticated
-- roles) by non-staff. Admin tools, the service role and the SQL editor
-- are never limited.
create or replace function private.hibcw_is_limited_caller()
returns boolean
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
begin
  return coalesce(nullif(current_setting('role', true), ''), 'none') in ('anon', 'authenticated')
         and not public.hibcw_is_staff();
end;
$$;

-- Core check. Raises a friendly error when over the limit; otherwise logs.
create or replace function private.hibcw_rate_check(p_bucket text)
returns void
language plpgsql volatile security definer
set search_path = private, public, pg_temp
as $$
declare
  s     private.hibcw_rate_settings;
  ip    text;
  iph   text;
  n     int;
begin
  if not private.hibcw_is_limited_caller() then
    return;                                         -- staff/admin tools are never limited
  end if;

  select * into s from private.hibcw_rate_settings where bucket = p_bucket;
  if not found then return; end if;

  -- serialize checks for this bucket so parallel requests can't slip past
  perform pg_advisory_xact_lock(hashtext('hibcw_rate:' || p_bucket));

  ip  := private.hibcw_client_ip();
  iph := case when ip is null then null
              else encode(digest('hibcw:' || ip, 'sha256'), 'hex') end;

  -- per connection (skipped if the address isn't available, so one
  -- missing header can never lock out the whole island)
  if iph is not null then
    select count(*) into n from private.hibcw_rate_events
     where bucket = p_bucket and ip_hash = iph
       and created_at > now() - s.per_ip_window;
    if n >= s.per_ip_max then
      raise exception using errcode = 'P0429', message = s.message,
            hint = 'HIBCW_RATE_LIMIT';
    end if;
    if s.per_ip_day_max is not null then
      select count(*) into n from private.hibcw_rate_events
       where bucket = p_bucket and ip_hash = iph
         and created_at > now() - interval '1 day';
      if n >= s.per_ip_day_max then
        raise exception using errcode = 'P0429', message = s.message,
              hint = 'HIBCW_RATE_LIMIT';
      end if;
    end if;
  end if;

  -- island-wide
  select count(*) into n from private.hibcw_rate_events
   where bucket = p_bucket and created_at > now() - s.global_window;
  if n >= s.global_max then
    raise exception using errcode = 'P0429',
          message = 'HIBCW is receiving an unusually high number of submissions right now. Please try again shortly. For emergencies, call 911.',
          hint = 'HIBCW_RATE_LIMIT';
  end if;

  insert into private.hibcw_rate_events (bucket, ip_hash) values (p_bucket, iph);

  -- occasional cleanup (~1 in 50 calls)
  if random() < 0.02 then
    delete from private.hibcw_rate_events where created_at < now() - interval '2 days';
  end if;
end;
$$;

-- ── Trigger: reports, applications, registrations ───────────────────
create or replace function public.hibcw_rate_limit_insert()
returns trigger
language plpgsql security definer
set search_path = public, private, pg_temp
as $$
begin
  if private.hibcw_is_limited_caller() then
    -- reject oversized submissions (~20 KB of text is far more than any real form)
    if octet_length(row_to_json(new)::text) > 20000 then
      raise exception using errcode = 'P0413',
            message = 'That submission is too long. Please shorten the description and try again.',
            hint = 'HIBCW_TOO_LARGE';
    end if;
    perform private.hibcw_rate_check(tg_argv[0]);
  end if;
  return new;
end;
$$;

drop trigger if exists hibcw_rate_limit on public.incidents;
create trigger hibcw_rate_limit before insert on public.incidents
  for each row execute function public.hibcw_rate_limit_insert('report');

drop trigger if exists hibcw_rate_limit on public.member_applications;
create trigger hibcw_rate_limit before insert on public.member_applications
  for each row execute function public.hibcw_rate_limit_insert('apply');

drop trigger if exists hibcw_rate_limit on public.business_registry;
create trigger hibcw_rate_limit before insert on public.business_registry
  for each row execute function public.hibcw_rate_limit_insert('register');

-- ── Photos/videos: only for a fresh report, max 10, real storage links ──
-- Report id from a folder name, or null if it isn't a report made in the
-- last 30 minutes.
create or replace function public.hibcw_fresh_report(p_folder text)
returns uuid
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
declare
  inc_id uuid;
begin
  if p_folder is null
     or p_folder !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return null;
  end if;
  inc_id := p_folder::uuid;
  if exists (select 1 from public.incidents
              where id = inc_id and created_at > now() - interval '30 minutes') then
    return inc_id;
  end if;
  return null;
end;
$$;

-- Storage upload rule: fresh report, fewer than 10 files in its folder,
-- and under the hourly upload cap. Explains itself when it says no.
create or replace function public.hibcw_media_upload_ok(p_folder text)
returns boolean
language plpgsql volatile security definer
set search_path = public, private, pg_temp
as $$
declare
  n int;
begin
  if not private.hibcw_is_limited_caller() then
    return true;
  end if;
  if public.hibcw_fresh_report(p_folder) is null then
    raise exception using errcode = 'P0429',
          message = 'Photos can only be added while sending a new report.',
          hint = 'HIBCW_MEDIA_LIMIT';
  end if;
  select count(*) into n from storage.objects
   where bucket_id = 'incident-media' and name like p_folder || '/%';
  if n >= 10 then
    raise exception using errcode = 'P0429',
          message = 'A report can have up to 10 photos or videos.',
          hint = 'HIBCW_MEDIA_LIMIT';
  end if;
  perform private.hibcw_rate_check('media');   -- raises a friendly error when over
  return true;
end;
$$;

-- incident_media rows: fresh report, max 10, link must point at our own storage.
create or replace function public.hibcw_check_media_insert()
returns trigger
language plpgsql security definer
set search_path = public, private, pg_temp
as $$
declare
  n int;
begin
  if not private.hibcw_is_limited_caller() then
    return new;
  end if;
  if public.hibcw_fresh_report(new.incident_id::text) is null then
    raise exception using errcode = 'P0429',
          message = 'Photos can only be added while sending a new report.',
          hint = 'HIBCW_MEDIA_LIMIT';
  end if;
  select count(*) into n from public.incident_media where incident_id = new.incident_id;
  if n >= 10 then
    raise exception using errcode = 'P0429',
          message = 'A report can have up to 10 photos or videos.',
          hint = 'HIBCW_MEDIA_LIMIT';
  end if;
  if new.file_path is null or new.file_path not like new.incident_id::text || '/%'
     or new.public_url is null
     or new.public_url not like '%/storage/v1/object/public/incident-media/' || new.file_path then
    raise exception using errcode = '22023',
          message = 'That photo link is not valid.', hint = 'HIBCW_MEDIA_INVALID';
  end if;
  if new.mime_type is null or new.mime_type !~* '^(image|video)/' then
    raise exception using errcode = '22023',
          message = 'Only photos and videos can be attached.', hint = 'HIBCW_MEDIA_INVALID';
  end if;
  return new;
end;
$$;

drop trigger if exists hibcw_check_media on public.incident_media;
create trigger hibcw_check_media before insert on public.incident_media
  for each row execute function public.hibcw_check_media_insert();

drop function if exists public.hibcw_media_slot_open(text);

-- Storage bucket: 50 MB per file, images and video only
update storage.buckets
   set file_size_limit    = 52428800,
       allowed_mime_types = array['image/*','video/*']
 where id = 'incident-media';

-- Storage uploads: public may only upload into the folder of a report
-- made in the last 30 minutes (the app names folders by report id).
drop policy if exists hibcw_media_upload on storage.objects;
create policy hibcw_media_upload on storage.objects
  for insert to anon, authenticated
  with check (
    bucket_id = 'incident-media'
    and public.hibcw_media_upload_ok((storage.foldername(name))[1])
  );

-- Functions are called by triggers/policies only; keep them off the public API.
revoke execute on function public.hibcw_rate_limit_insert()      from public;
revoke execute on function public.hibcw_check_media_insert()     from public;
revoke all     on function private.hibcw_rate_check(text)        from public;
revoke all     on function private.hibcw_client_ip()             from public;
revoke all     on function private.hibcw_is_limited_caller()     from public;
grant execute  on function public.hibcw_fresh_report(text)       to anon, authenticated;
grant execute  on function public.hibcw_media_upload_ok(text)    to anon, authenticated;
