-- ════════════════════════════════════════════════════════════════════
-- Hawaiʻi Island Business Crime Watch (HIBCW) — Database Schema
--
-- Generated 2026-11-02 from the live Supabase database, including the
-- November 2026 security rules. Running this file on an EMPTY Supabase
-- project rebuilds the HIBCW database (structure only, no data).
--
-- Do NOT run this on the live database — the tables already exist.
-- To re-apply only the security rules there, use the security section
-- (section 6) on its own.
-- ════════════════════════════════════════════════════════════════════

create extension if not exists "uuid-ossp";
create extension if not exists pgcrypto;   -- gen_random_uuid()

-- ── 1. Tables ───────────────────────────────────────────────────────

-- Incident reports from the public map
create table public.incidents (
  id uuid not null default uuid_generate_v4(),
  created_at timestamp with time zone not null default now(),
  type text not null,
  type_color text not null default 'teal'::text,
  occurred_at timestamp with time zone not null,
  address text not null,
  description text not null,
  reporter_name text,
  police_report text,
  suspect_height text,
  suspect_build text,
  suspect_age text,
  suspect_gender text,
  suspect_race text,
  suspect_clothing text,
  suspect_other text,
  vehicle_make text,
  vehicle_model text,
  vehicle_color text,
  vehicle_year text,
  vehicle_plate text,
  vehicle_notes text,
  lat double precision,
  lng double precision,
  status text not null default 'active'::text,
  is_recurring boolean not null default false,
  is_verified_member boolean not null default false,
  reporter_email text,
  district text,
  constraint incidents_pkey PRIMARY KEY (id)
);

-- Photos/videos attached to incidents (files live in the incident-media bucket)
create table public.incident_media (
  id uuid not null default uuid_generate_v4(),
  created_at timestamp with time zone not null default now(),
  incident_id uuid not null,
  file_path text not null,
  file_name text not null,
  file_type text not null,
  mime_type text not null,
  file_size bigint not null default 0,
  public_url text,
  constraint incident_media_pkey PRIMARY KEY (id)
);

-- Staff notes on incidents
create table public.incident_notes (
  id uuid not null default uuid_generate_v4(),
  created_at timestamp with time zone not null default now(),
  incident_id uuid not null,
  note text not null,
  author text not null default 'Admin'::text,
  constraint incident_notes_pkey PRIMARY KEY (id)
);

-- District / island-wide alerts posted by staff
create table public.district_alerts (
  id uuid not null default uuid_generate_v4(),
  created_at timestamp with time zone not null default now(),
  district text not null,
  message text not null,
  sent_by_email text,
  sent_by_name text,
  media_url text,
  media_type text,
  updated_at timestamp with time zone,
  is_edited boolean default false,
  alert_type text not null default 'incident'::text,
  archived_at timestamp with time zone,
  archived_by text,
  constraint district_alerts_pkey PRIMARY KEY (id)
);

-- Membership applications (apply.html) and approved member profiles
create table public.member_applications (
  id uuid not null default uuid_generate_v4(),
  created_at timestamp with time zone not null default now(),
  full_name text not null,
  email text not null,
  phone text not null,
  business_name text not null,
  business_address text not null,
  notes text,
  status text not null default 'pending'::text,
  business_city text,
  business_state text,
  business_zip text,
  district text,
  captain_name text,
  photo_url text,
  constraint member_applications_pkey PRIMARY KEY (id)
);

-- Verified member emails (drives the member badge on reports)
create table public.member_emails (
  id uuid not null default uuid_generate_v4(),
  created_at timestamp with time zone not null default now(),
  email text not null,
  constraint member_emails_pkey PRIMARY KEY (id),
  constraint member_emails_email_key UNIQUE (email)
);

-- Staff accounts: superadmin | admin | captain
create table public.admin_roles (
  id uuid not null default uuid_generate_v4(),
  created_at timestamp with time zone not null default now(),
  user_id uuid,
  email text not null,
  full_name text,
  role text not null default 'admin'::text,
  district text,
  last_sign_in_at timestamp with time zone,
  constraint admin_roles_pkey PRIMARY KEY (id),
  constraint admin_roles_email_key UNIQUE (email)
);

-- Business registrations (register-business.html)
create table public.business_registry (
  id uuid not null default gen_random_uuid(),
  business_name text not null,
  business_type text,
  street_address text,
  city text,
  zip text,
  full_address text,
  contact_name text,
  phone text,
  email text,
  employees text,
  website text,
  notes text,
  district text,
  captain_name text,
  status text default 'pending'::text,
  packet_sent_at timestamp with time zone,
  approved_at timestamp with time zone,
  approved_by text,
  submitted_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  mailing_street text,
  mailing_city text,
  mailing_zip text,
  mailing_address text,
  mailing_same_as_physical boolean default true,
  business_number text,
  constraint business_registry_pkey PRIMARY KEY (id),
  constraint business_registry_business_number_key UNIQUE (business_number),
  constraint business_registry_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text])))
);

-- In-app notifications for district captains
create table public.captain_notifications (
  id uuid not null default gen_random_uuid(),
  district text not null,
  type text default 'new_business'::text,
  title text,
  message text,
  business_id uuid,
  read boolean default false,
  created_at timestamp with time zone default now(),
  constraint captain_notifications_pkey PRIMARY KEY (id)
);

-- Growth Tracker — milestone stories
create table public.tracker_milestones (
  id uuid not null default gen_random_uuid(),
  date date,
  category text,
  district text,
  story text not null,
  impact text,
  use_in_pitch text default 'Yes'::text,
  created_at timestamp with time zone default now(),
  constraint tracker_milestones_pkey PRIMARY KEY (id),
  constraint tracker_milestones_use_in_pitch_check CHECK ((use_in_pitch = ANY (ARRAY['Yes'::text, 'No'::text, 'Maybe'::text])))
);

-- Growth Tracker — monthly numbers (month is 0–11)
create table public.tracker_monthly (
  id uuid not null default gen_random_uuid(),
  year integer not null,
  month integer not null,
  active_districts integer,
  members_total integer,
  members_new integer,
  incidents integer,
  incidents_archived integer,
  police_reports integer,
  alerts_sent integer,
  captain_logins integer,
  apps_received integer,
  apps_approved integer,
  apps_rejected integer,
  notes text,
  updated_at timestamp with time zone default now(),
  constraint tracker_monthly_pkey PRIMARY KEY (id),
  constraint tracker_monthly_month_check CHECK (((month >= 0) AND (month <= 11))),
  constraint tracker_monthly_year_month_key UNIQUE (year, month)
);

-- Growth Tracker — quarterly summaries
create table public.tracker_quarterly (
  id uuid not null default gen_random_uuid(),
  year integer not null,
  quarter text not null,
  summary text,
  worked text,
  attention text,
  updated_at timestamp with time zone default now(),
  constraint tracker_quarterly_pkey PRIMARY KEY (id),
  constraint tracker_quarterly_quarter_check CHECK ((quarter = ANY (ARRAY['Q1'::text, 'Q2'::text, 'Q3'::text, 'Q4'::text]))),
  constraint tracker_quarterly_year_quarter_key UNIQUE (year, quarter)
);

-- Foreign keys
alter table public.incident_media add constraint incident_media_incident_id_fkey FOREIGN KEY (incident_id) REFERENCES public.incidents(id) ON DELETE CASCADE;
alter table public.incident_notes add constraint incident_notes_incident_id_fkey FOREIGN KEY (incident_id) REFERENCES public.incidents(id) ON DELETE CASCADE;
alter table public.admin_roles add constraint admin_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.captain_notifications add constraint captain_notifications_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.business_registry(id) ON DELETE CASCADE;

-- ── 2. Indexes ──────────────────────────────────────────────────────
CREATE INDEX incidents_occurred_at_idx ON public.incidents USING btree (occurred_at DESC);
CREATE INDEX incidents_status_idx ON public.incidents USING btree (status);
CREATE INDEX media_incident_id_idx ON public.incident_media USING btree (incident_id);
CREATE INDEX notes_incident_id_idx ON public.incident_notes USING btree (incident_id);
CREATE INDEX district_alerts_archived_idx ON public.district_alerts USING btree (archived_at);
CREATE INDEX district_alerts_created_at_idx ON public.district_alerts USING btree (created_at DESC);
CREATE INDEX district_alerts_district_idx ON public.district_alerts USING btree (district);
CREATE INDEX member_apps_status_idx ON public.member_applications USING btree (status);
CREATE INDEX business_registry_business_number_idx ON public.business_registry USING btree (business_number);
CREATE INDEX idx_business_registry_district ON public.business_registry USING btree (district);
CREATE INDEX idx_business_registry_status ON public.business_registry USING btree (status);
CREATE INDEX idx_business_registry_submitted ON public.business_registry USING btree (submitted_at DESC);
CREATE INDEX idx_captain_notifications_district ON public.captain_notifications USING btree (district, read);
CREATE INDEX idx_tracker_milestones_created ON public.tracker_milestones USING btree (created_at DESC);
CREATE INDEX idx_tracker_monthly_year ON public.tracker_monthly USING btree (year);
CREATE INDEX idx_tracker_quarterly_year ON public.tracker_quarterly USING btree (year);

-- ── 3. Business numbers + updated_at ────────────────────────────────
CREATE OR REPLACE FUNCTION public.district_prefix(district_id text)
 RETURNS integer
 LANGUAGE sql
 IMMUTABLE
AS $function$
  select case district_id
    when 'hamakua'      then 1
    when 'north-hilo'   then 2
    when 'south-hilo'   then 3
    when 'lower-puna'   then 4
    when 'upper-puna'   then 5
    when 'kau'          then 6
    when 'south-kona'   then 7
    when 'north-kona'   then 8
    when 'north-kohala' then 9
    else 0
  end
$function$;

CREATE OR REPLACE FUNCTION public.next_business_number(district_id text)
 RETURNS text
 LANGUAGE plpgsql
AS $function$
declare
  prefix     int;
  next_seq   int;
  candidate  text;
begin
  prefix := public.district_prefix(district_id);

  if prefix = 0 then
    raise exception 'Unknown district: %', district_id;
  end if;

  -- Count existing numbers for this district prefix to derive next sequence
  select coalesce(max(
    cast(substring(business_number from 2 for 4) as int)
  ), 0) + 1
  into next_seq
  from public.business_registry
  where business_number is not null
    and left(business_number, 1) = prefix::text;

  -- Format: 1 digit prefix + 4 digit zero-padded sequence
  candidate := prefix::text ||lpad(next_seq::text, 4, '0');

  -- Safety: if somehow a collision exists, keep incrementing
  while exists (
    select 1 from public.business_registry where business_number = candidate
  ) loop
    next_seq := next_seq + 1;
    candidate := prefix::text ||lpad(next_seq::text, 4, '0');
  end loop;

  return candidate;
end;
$function$;

CREATE OR REPLACE FUNCTION public.set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$;

create trigger business_registry_updated_at before update on public.business_registry
  for each row execute function public.set_updated_at();
create trigger tracker_monthly_updated_at before update on public.tracker_monthly
  for each row execute function public.set_updated_at();
create trigger tracker_quarterly_updated_at before update on public.tracker_quarterly
  for each row execute function public.set_updated_at();

-- ── 4. Public captain cards view ────────────────────────────────────
-- Reads member_applications as its owner, exposing only these columns.
create or replace view public.public_captains as
SELECT district,
    full_name,
    email,
    photo_url,
    captain_name
   FROM member_applications
  WHERE status = 'approved'::text AND captain_name IS NOT NULL AND captain_name <> ''::text;
alter view public.public_captains set (security_invoker = false);
grant select on public.public_captains to anon, authenticated;

-- ── 5. Storage ──────────────────────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('incident-media', 'incident-media', true)
on conflict (id) do nothing;

-- ── 6. Security (row-level security) ────────────────────────────────
-- Staff = an account listed in admin_roles (superadmin, admin, captain).
-- The public can view active incidents and alerts, submit reports, apply and register a business.

alter table public.incidents enable row level security;
alter table public.incident_media enable row level security;
alter table public.incident_notes enable row level security;
alter table public.district_alerts enable row level security;
alter table public.member_applications enable row level security;
alter table public.member_emails enable row level security;
alter table public.admin_roles enable row level security;
alter table public.business_registry enable row level security;
alter table public.captain_notifications enable row level security;
alter table public.tracker_milestones enable row level security;
alter table public.tracker_monthly enable row level security;
alter table public.tracker_quarterly enable row level security;

-- Helper functions-- SECURITY DEFINER lets these read admin_roles without tripping over
-- admin_roles' own rules.

create or replace function public.hibcw_is_staff()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.admin_roles where user_id = auth.uid());
$$;

create or replace function public.hibcw_is_superadmin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.admin_roles
                 where user_id = auth.uid() and role = 'superadmin');
$$;

-- Yes/no member check for the public report form (replaces reading the
-- whole member_emails table).
create or replace function public.hibcw_is_member_email(p_email text)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.member_emails
                 where lower(email) = lower(trim(p_email)));
$$;

-- Superadmin-only: create or update an account's role, and link it to
-- the login if that person already has one.
create or replace function public.hibcw_upsert_role(p_email text, p_role text, p_district text)
returns void
language plpgsql security definer set search_path = public, auth
as $$
declare
  v_email text := lower(trim(p_email));
begin
  if not public.hibcw_is_superadmin() then
    raise exception 'Only a superadmin can manage accounts';
  end if;
  if p_role not in ('superadmin', 'admin', 'captain') then
    raise exception 'Invalid role: %', p_role;
  end if;

  insert into public.admin_roles (email, role, district, user_id)
  values (v_email, p_role,
          case when p_role = 'captain' then p_district end,
          (select id from auth.users where lower(email) = v_email limit 1))
  on conflict (email) do update
    set role     = excluded.role,
        district = excluded.district,
        user_id  = coalesce(public.admin_roles.user_id, excluded.user_id);
end;
$$;

revoke execute on function public.hibcw_upsert_role(text, text, text) from public, anon;
grant  execute on function public.hibcw_is_staff()                 to anon, authenticated;
grant  execute on function public.hibcw_is_superadmin()            to anon, authenticated;
grant  execute on function public.hibcw_is_member_email(text)      to anon, authenticated;
grant  execute on function public.hibcw_upsert_role(text, text, text) to authenticated;

-- When an invited person's login is created, link it to their role row.
create or replace function public.hibcw_link_new_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  update public.admin_roles
     set user_id = new.id
   where user_id is null and lower(email) = lower(new.email);
  return new;
end;
$$;

drop trigger if exists hibcw_link_new_user on auth.users;
create trigger hibcw_link_new_user
  after insert on auth.users
  for each row execute function public.hibcw_link_new_user();

-- Non-superadmins may only change last_sign_in_at on their own row.
create or replace function public.hibcw_guard_admin_roles()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is null or public.hibcw_is_superadmin() then
    return new;   -- service role / SQL editor, or a superadmin
  end if;
  if new.role      is distinct from old.role
  or new.district  is distinct from old.district
  or new.email     is distinct from old.email
  or new.user_id   is distinct from old.user_id
  or new.full_name is distinct from old.full_name
  or new.id        is distinct from old.id then
    raise exception 'Only a superadmin can change account details';
  end if;
  return new;
end;
$$;

drop trigger if exists hibcw_guard_admin_roles on public.admin_roles;
create trigger hibcw_guard_admin_roles
  before update on public.admin_roles
  for each row execute function public.hibcw_guard_admin_roles();

-- Rules
-- incidents: public reads active + submits; staff read everything and manage
create policy hibcw_public_read_active on public.incidents
  for select to anon, authenticated using (status = 'active');
create policy hibcw_staff_read_all on public.incidents
  for select to authenticated using (public.hibcw_is_staff());
create policy hibcw_public_report on public.incidents
  for insert to anon, authenticated with check (status = 'active');
create policy hibcw_staff_update on public.incidents
  for update to authenticated using (public.hibcw_is_staff()) with check (public.hibcw_is_staff());
create policy hibcw_staff_delete on public.incidents
  for delete to authenticated using (public.hibcw_is_staff());

-- incident_media: public reads + attaches photos; staff delete
create policy hibcw_public_read on public.incident_media
  for select to anon, authenticated using (true);
create policy hibcw_public_attach on public.incident_media
  for insert to anon, authenticated with check (true);
create policy hibcw_staff_delete on public.incident_media
  for delete to authenticated using (public.hibcw_is_staff());

-- incident_notes: staff only
create policy hibcw_staff_all on public.incident_notes
  for all to authenticated using (public.hibcw_is_staff()) with check (public.hibcw_is_staff());

-- district_alerts: public reads active; staff read everything and manage
create policy hibcw_public_read_active on public.district_alerts
  for select to anon, authenticated using (archived_at is null);
create policy hibcw_staff_all on public.district_alerts
  for all to authenticated using (public.hibcw_is_staff()) with check (public.hibcw_is_staff());

-- member_applications: public submits (pending only); staff manage
create policy hibcw_public_apply on public.member_applications
  for insert to anon, authenticated with check (status = 'pending');
create policy hibcw_staff_all on public.member_applications
  for all to authenticated using (public.hibcw_is_staff()) with check (public.hibcw_is_staff());

-- member_emails: staff only (public uses hibcw_is_member_email)
create policy hibcw_staff_all on public.member_emails
  for all to authenticated using (public.hibcw_is_staff()) with check (public.hibcw_is_staff());

-- business_registry: public submits (pending only); staff manage
create policy hibcw_public_register on public.business_registry
  for insert to anon, authenticated with check (status = 'pending');
create policy hibcw_staff_all on public.business_registry
  for all to authenticated using (public.hibcw_is_staff()) with check (public.hibcw_is_staff());

-- captain_notifications + growth tracker: staff only
create policy hibcw_staff_all on public.captain_notifications
  for all to authenticated using (public.hibcw_is_staff()) with check (public.hibcw_is_staff());
create policy hibcw_staff_all on public.tracker_milestones
  for all to authenticated using (public.hibcw_is_staff()) with check (public.hibcw_is_staff());
create policy hibcw_staff_all on public.tracker_monthly
  for all to authenticated using (public.hibcw_is_staff()) with check (public.hibcw_is_staff());
create policy hibcw_staff_all on public.tracker_quarterly
  for all to authenticated using (public.hibcw_is_staff()) with check (public.hibcw_is_staff());

-- admin_roles: you can read your own row; staff can read all;
-- only superadmins add/remove/change; anyone on staff can stamp their own sign-in time
create policy hibcw_read_own on public.admin_roles
  for select to authenticated using (user_id = auth.uid());
create policy hibcw_staff_read on public.admin_roles
  for select to authenticated using (public.hibcw_is_staff());
create policy hibcw_superadmin_insert on public.admin_roles
  for insert to authenticated with check (public.hibcw_is_superadmin());
create policy hibcw_superadmin_delete on public.admin_roles
  for delete to authenticated using (public.hibcw_is_superadmin());
create policy hibcw_update on public.admin_roles
  for update to authenticated
  using (public.hibcw_is_superadmin() or user_id = auth.uid())
  with check (public.hibcw_is_superadmin() or user_id = auth.uid());

-- storage (incident-media bucket): public views + uploads; staff change/delete
create policy hibcw_media_read on storage.objects
  for select to anon, authenticated using (bucket_id = 'incident-media');
create policy hibcw_media_upload on storage.objects
  for insert to anon, authenticated with check (bucket_id = 'incident-media');
create policy hibcw_media_update on storage.objects
  for update to authenticated
  using (bucket_id = 'incident-media' and public.hibcw_is_staff())
  with check (bucket_id = 'incident-media' and public.hibcw_is_staff());
create policy hibcw_media_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'incident-media' and public.hibcw_is_staff());


-- ── 7. Member badge (set by the database, not the browser) ──────────
create or replace function public.hibcw_set_member_badge()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if not public.hibcw_is_staff() then
    new.reporter_email     := nullif(lower(trim(new.reporter_email)), '');
    new.is_verified_member := new.reporter_email is not null
                              and public.hibcw_is_member_email(new.reporter_email);
  end if;
  return new;
end;
$$;

drop trigger if exists hibcw_set_member_badge on public.incidents;
create trigger hibcw_set_member_badge
  before insert on public.incidents
  for each row execute function public.hibcw_set_member_badge();
