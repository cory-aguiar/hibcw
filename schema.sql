-- ============================================================
-- Hawaii Island Business Crime Watch
-- Database Schema — v2 (clean rebuild)
-- Run this once in Supabase SQL Editor
-- ============================================================

create extension if not exists "uuid-ossp";

-- ── INCIDENTS TABLE ──────────────────────────────────────────
create table public.incidents (
  id            uuid primary key default uuid_generate_v4(),
  created_at    timestamptz not null default now(),
  type          text not null,
  type_color    text not null default 'teal',  -- 'red' | 'gold' | 'teal'
  occurred_at   timestamptz not null,
  address       text not null,
  description   text not null,
  reporter_name text,
  police_report text,
  -- Suspect description
  suspect_height   text,
  suspect_build    text,
  suspect_age      text,
  suspect_gender   text,
  suspect_race     text,
  suspect_clothing text,
  suspect_other    text,
  -- Vehicle description
  vehicle_make     text,
  vehicle_model    text,
  vehicle_color    text,
  vehicle_year     text,
  vehicle_plate    text,
  vehicle_notes    text,
  lat           double precision,
  lng           double precision,
  status        text not null default 'active'  -- 'active' | 'archived'
);

-- ── MEDIA TABLE ───────────────────────────────────────────────
create table public.incident_media (
  id          uuid primary key default uuid_generate_v4(),
  created_at  timestamptz not null default now(),
  incident_id uuid not null references public.incidents(id) on delete cascade,
  file_path   text not null,
  file_name   text not null,
  file_type   text not null,   -- 'image' | 'video'
  mime_type   text not null,
  file_size   bigint not null default 0,
  public_url  text
);

-- ── INDEXES ───────────────────────────────────────────────────
create index incidents_occurred_at_idx on public.incidents (occurred_at desc);
create index incidents_status_idx      on public.incidents (status);
create index media_incident_id_idx     on public.incident_media (incident_id);

-- ── ROW LEVEL SECURITY ────────────────────────────────────────
alter table public.incidents      enable row level security;
alter table public.incident_media enable row level security;

-- Public: read active incidents, insert new ones
create policy "read active"   on public.incidents for select using (status = 'active');
create policy "insert"        on public.incidents for insert with check (true);
create policy "read media"    on public.incident_media for select using (true);
create policy "insert media"  on public.incident_media for insert with check (true);

-- Admin: update + delete (needed for admin panel)
create policy "admin update"  on public.incidents for update using (true);
create policy "admin delete"  on public.incidents for delete using (true);
create policy "admin delete media" on public.incident_media for delete using (true);

-- ── MEMBER APPLICATIONS TABLE ────────────────────────────────
create table public.member_applications (
  id               uuid primary key default uuid_generate_v4(),
  created_at       timestamptz not null default now(),
  email            text not null,
  full_name        text,
  phone            text,
  business_name    text,
  business_address text,
  business_city    text,
  business_state   text,
  business_zip     text,
  district         text,
  captain_name     text,
  photo_url        text,
  notes            text,
  status           text not null default 'pending'  -- 'pending' | 'approved' | 'rejected'
);

create index member_applications_email_idx    on public.member_applications (email);
create index member_applications_status_idx   on public.member_applications (status);
create index member_applications_district_idx on public.member_applications (district);

alter table public.member_applications enable row level security;

-- Public: submit applications
create policy "insert application"  on public.member_applications for insert with check (true);
-- Authenticated (admin/captain): read, update, delete
create policy "admin read members"   on public.member_applications for select using (auth.role() = 'authenticated');
create policy "admin update members" on public.member_applications for update using (auth.role() = 'authenticated');
create policy "admin delete members" on public.member_applications for delete using (auth.role() = 'authenticated');

-- ── STORAGE BUCKET ────────────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('incident-media', 'incident-media', true)
on conflict (id) do nothing;

create policy "upload media"
  on storage.objects for insert with check (bucket_id = 'incident-media');

create policy "read media storage"
  on storage.objects for select using (bucket_id = 'incident-media');

create policy "delete media storage"
  on storage.objects for delete using (bucket_id = 'incident-media');

-- ── INCIDENT NOTES TABLE ─────────────────────────────────────
-- (if not already created)
create table if not exists public.incident_notes (
  id          uuid primary key default uuid_generate_v4(),
  created_at  timestamptz not null default now(),
  incident_id uuid not null references public.incidents(id) on delete cascade,
  note        text not null,
  author      text
);
create index if not exists incident_notes_incident_id_idx on public.incident_notes (incident_id);
alter table public.incident_notes enable row level security;
create policy "admin read notes"   on public.incident_notes for select using (auth.role() = 'authenticated');
create policy "admin insert notes" on public.incident_notes for insert with check (auth.role() = 'authenticated');
create policy "admin delete notes" on public.incident_notes for delete using (auth.role() = 'authenticated');

-- ── ADMIN ROLES TABLE ────────────────────────────────────────
-- (if not already created)
create table if not exists public.admin_roles (
  id              uuid primary key default uuid_generate_v4(),
  created_at      timestamptz not null default now(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  role            text not null default 'captain',  -- 'superadmin' | 'admin' | 'captain'
  email           text,
  full_name       text,
  district        text,
  last_sign_in_at timestamptz
);
create index if not exists admin_roles_user_id_idx on public.admin_roles (user_id);
alter table public.admin_roles enable row level security;
create policy "admin read roles"   on public.admin_roles for select using (auth.role() = 'authenticated');
create policy "admin insert roles" on public.admin_roles for insert with check (auth.role() = 'authenticated');
create policy "admin update roles" on public.admin_roles for update using (auth.role() = 'authenticated');
create policy "admin delete roles" on public.admin_roles for delete using (auth.role() = 'authenticated');

-- ── MEMBER EMAILS TABLE ──────────────────────────────────────
-- (if not already created)
create table if not exists public.member_emails (
  id         uuid primary key default uuid_generate_v4(),
  created_at timestamptz not null default now(),
  email      text not null unique
);
alter table public.member_emails enable row level security;
create policy "admin read member_emails"   on public.member_emails for select using (auth.role() = 'authenticated');
create policy "admin insert member_emails" on public.member_emails for insert with check (auth.role() = 'authenticated');
create policy "admin delete member_emails" on public.member_emails for delete using (auth.role() = 'authenticated');
create policy "public check email"         on public.member_emails for select using (true);

-- ── DISTRICT ALERTS TABLE ────────────────────────────────────
create table public.district_alerts (
  id             uuid primary key default uuid_generate_v4(),
  created_at     timestamptz not null default now(),
  district       text not null,
  message        text not null,
  sent_by_email  text,
  sent_by_name   text
);
create index district_alerts_district_idx   on public.district_alerts (district);
create index district_alerts_created_at_idx on public.district_alerts (created_at desc);
alter table public.district_alerts enable row level security;
create policy "admin read alerts"   on public.district_alerts for select using (auth.role() = 'authenticated');
create policy "admin insert alerts" on public.district_alerts for insert with check (auth.role() = 'authenticated');
create policy "admin delete alerts" on public.district_alerts for delete using (auth.role() = 'authenticated');
