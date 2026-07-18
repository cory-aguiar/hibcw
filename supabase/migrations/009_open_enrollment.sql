-- ============================================================
-- KIAA Benefits OS — Migration 009
-- Open Enrollment: rate bands, plan elections, contributions
-- Run each block separately in Supabase SQL Editor
-- ============================================================

-- Block 1: Add band and OE status to companies
alter table public.companies
  add column if not exists band      integer check (band between 1 and 8),
  add column if not exists oe_status text default 'pending'
    check (oe_status in ('pending','submitted','confirmed'));

-- Block 2: Rate bands table
-- Stores total HMSA premiums for every plan × band × tier combination
create table if not exists public.rate_bands (
  id           uuid default uuid_generate_v4() primary key,
  plan_year    text not null,           -- e.g. '2025-2026'
  plan_id      text not null,           -- matches plans.js id
  band         integer not null check (band between 1 and 8),
  premium_single     numeric(10,2) not null default 0,
  premium_two_party  numeric(10,2) not null default 0,
  premium_family     numeric(10,2) not null default 0,
  created_by   uuid references auth.users,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now(),
  unique (plan_year, plan_id, band)
);
alter table public.rate_bands enable row level security;

create policy "rate_bands_read" on public.rate_bands
  for select using (auth.role() = 'authenticated');
create policy "rate_bands_write" on public.rate_bands
  for all using (
    exists (select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('super_admin','staff'))
  );

-- Block 3: Company elections table
-- One row per company × plan year × plan
create table if not exists public.company_elections (
  id              uuid default uuid_generate_v4() primary key,
  company_id      uuid references public.companies on delete cascade,
  plan_year       text not null,
  plan_id         text not null,
  elected         boolean not null default false,
  -- Employee contribution (what the employee pays)
  ee_single       numeric(10,2) default 0,
  ee_two_party    numeric(10,2) default 0,
  ee_family       numeric(10,2) default 0,
  -- Employer contribution (total - employee, computed on read)
  submitted_at    timestamptz,
  submitted_by    uuid references auth.users,
  confirmed_at    timestamptz,
  confirmed_by    uuid references auth.users,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now(),
  unique (company_id, plan_year, plan_id)
);
alter table public.company_elections enable row level security;

create policy "elections_admin_staff" on public.company_elections
  for all using (
    exists (select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('super_admin','staff'))
  );
create policy "elections_client_read" on public.company_elections
  for select using (
    exists (select 1 from public.profiles p
      where p.id = auth.uid() and p.company_id = company_id)
  );
create policy "elections_client_write" on public.company_elections
  for update using (
    exists (select 1 from public.profiles p
      where p.id = auth.uid() and p.company_id = company_id)
  );

-- Trigger to keep updated_at current
create trigger rate_bands_updated_at before update on public.rate_bands
  for each row execute procedure public.set_updated_at();
create trigger elections_updated_at before update on public.company_elections
  for each row execute procedure public.set_updated_at();

-- ── Add PHCA contribution fields to company_elections ────────
-- Run this block if migration 009 was already run
alter table public.company_elections
  add column if not exists contrib_method text default 'fixed'
    check (contrib_method in ('fixed','phca')),
  add column if not exists gross_wage numeric(10,2);

-- ── Allow band=0 for flat-rate plans (KIAA Riders Package) ──
alter table public.rate_bands
  drop constraint if exists rate_bands_band_check;
alter table public.rate_bands
  add constraint rate_bands_band_check check (band between 0 and 8);

-- ── COMPCARE company election flag ───────────────────────────
alter table public.companies
  add column if not exists compcare_elected boolean default false;

-- Store COMPCARE rate as band=0, plan_id='compcare'
-- (same pattern as kiaa_riders flat rate)

-- ── Company documents table ──────────────────────────────────
-- Stores SPDs, SBCs, and Benefit Summaries per company
create table if not exists public.company_documents (
  id           uuid default uuid_generate_v4() primary key,
  company_id   uuid references public.companies on delete cascade,
  doc_type     text not null,
  -- doc_type values:
  --   'spd'         — Summary Plan Description (company-wide)
  --   'sbc'         — Summary of Benefits & Coverage (per plan)
  --   'benefit_summary' — Riders/COMPCARE summary (per plan)
  plan_id      text,           -- null for SPD, plan id for SBC/summary
  plan_year    text not null default '2025-2026',
  file_name    text not null,
  file_url     text not null,  -- public Supabase storage URL
  uploaded_by  uuid references auth.users,
  uploaded_at  timestamptz default now(),
  updated_at   timestamptz default now(),
  unique (company_id, doc_type, plan_id, plan_year)
);
alter table public.company_documents enable row level security;

create policy "docs_admin_staff" on public.company_documents
  for all using (public.get_my_role() in ('super_admin','staff'));

create policy "docs_client_read" on public.company_documents
  for select using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.company_id = company_id
    )
  );

create trigger company_documents_updated_at
  before update on public.company_documents
  for each row execute procedure public.set_updated_at();

-- ── Global plan documents (SBCs shared across all companies) ─
create table if not exists public.plan_documents (
  id          uuid default uuid_generate_v4() primary key,
  plan_id     text not null,
  doc_type    text not null default 'sbc',
  plan_year   text not null default '2025-2026',
  file_name   text not null,
  file_url    text not null,
  uploaded_by uuid references auth.users,
  uploaded_at timestamptz default now(),
  updated_at  timestamptz default now(),
  unique (plan_id, doc_type, plan_year)
);
alter table public.plan_documents enable row level security;
create policy "plan_docs_read" on public.plan_documents
  for select using (auth.role() = 'authenticated');
create policy "plan_docs_write" on public.plan_documents
  for all using (public.get_my_role() in ('super_admin','staff'));

-- ── Employee-facing company fields ───────────────────────────
alter table public.companies
  add column if not exists benefits_contact_name  text,
  add column if not exists benefits_contact_email text,
  add column if not exists benefits_contact_phone text,
  add column if not exists oe_deadline            date,
  add column if not exists oe_instructions        text;

-- ── Company logo for employee-facing pages ───────────────────
alter table public.companies
  add column if not exists logo_url text;
