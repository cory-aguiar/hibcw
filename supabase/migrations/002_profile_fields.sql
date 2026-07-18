-- ============================================================
-- KIAA Benefits OS — Migration 002
-- Run this in Supabase SQL Editor AFTER 001_schema.sql
-- ============================================================

-- Add new columns
alter table public.profiles
  add column if not exists first_name   text,
  add column if not exists last_name    text,
  add column if not exists phone        text,
  add column if not exists company_name text;

-- Backfill first/last from existing full_name
update public.profiles
set
  first_name = split_part(full_name, ' ', 1),
  last_name  = nullif(trim(substring(full_name from position(' ' in full_name))), '')
where full_name is not null and first_name is null;

-- Drop conflicting update policies and replace with one clean policy
drop policy if exists "profiles_update_own"  on public.profiles;
drop policy if exists "profiles_admin_all"   on public.profiles;

-- Anyone can update their own row (all columns)
create policy "profiles_update_own" on public.profiles
  for update
  using     (auth.uid() = id)
  with check (auth.uid() = id);

-- Super admin can do everything
create policy "profiles_admin_all" on public.profiles
  for all
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'super_admin'
    )
  );
