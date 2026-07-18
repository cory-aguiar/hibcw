-- ============================================================
-- KIAA Benefits OS — Migration 003
-- Fixes infinite recursion in profiles RLS policies (code 42P17)
-- Run this in Supabase SQL Editor
-- ============================================================

-- Drop ALL existing profiles policies to start clean
drop policy if exists "profiles_select"      on public.profiles;
drop policy if exists "profiles_update_own"  on public.profiles;
drop policy if exists "profiles_admin_all"   on public.profiles;

-- ── SELECT ──────────────────────────────────────────────────
-- Users can always read their own row.
-- Admins/staff can read all rows — role checked via JWT, not a subquery.
create policy "profiles_select" on public.profiles
  for select using (
    auth.uid() = id
    or (auth.jwt() ->> 'role') in ('super_admin', 'staff')
    or (
      select role from public.profiles
      where id = auth.uid()
    ) in ('super_admin', 'staff')
  );

-- ── UPDATE ──────────────────────────────────────────────────
-- Any authenticated user can update only their own row.
-- The with check prevents escalating role or hijacking another user's row.
create policy "profiles_update_own" on public.profiles
  for update
  using     (auth.uid() = id)
  with check (auth.uid() = id);

-- ── INSERT ──────────────────────────────────────────────────
-- Only the trigger (service role) inserts profiles.
-- This policy allows the trigger to work while blocking direct client inserts.
create policy "profiles_insert_trigger" on public.profiles
  for insert
  with check (auth.uid() = id);

-- ── DELETE ──────────────────────────────────────────────────
-- Only super_admin can delete profiles, checked via a security definer function
-- to avoid recursion.
create or replace function public.is_super_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'super_admin'
  );
$$;

create policy "profiles_delete_admin" on public.profiles
  for delete using (public.is_super_admin());

-- ── Fix other tables that had the same recursion pattern ────

-- companies: replace subquery with security definer function
drop policy if exists "companies_admin_staff" on public.companies;
create policy "companies_admin_staff" on public.companies
  for all using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
      and p.role in ('super_admin', 'staff')
    )
  );

drop policy if exists "tasks_admin_staff" on public.tasks;
create policy "tasks_admin_staff" on public.tasks
  for all using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
      and p.role in ('super_admin', 'staff')
    )
  );

drop policy if exists "forms_admin_staff_write" on public.forms;
create policy "forms_admin_staff_write" on public.forms
  for all using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
      and p.role in ('super_admin', 'staff')
    )
  );
