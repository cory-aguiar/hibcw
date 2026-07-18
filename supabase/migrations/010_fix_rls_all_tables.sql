-- ============================================================
-- KIAA Benefits OS — Migration 010
-- Fixes RLS on companies, tasks, forms, rate_bands, and
-- company_elections to use get_my_role() security definer
-- function instead of subqueries, preventing recursion and
-- permission errors on updates.
-- Run each block separately in Supabase SQL Editor.
-- ============================================================

-- Block 1: Fix companies policies
drop policy if exists "companies_admin_staff"    on public.companies;
drop policy if exists "companies_client_select"  on public.companies;

create policy "companies_admin_staff" on public.companies
  for all using (public.get_my_role() in ('super_admin','staff'));

create policy "companies_client_select" on public.companies
  for select using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.company_id = id
    )
  );

-- Block 2: Fix tasks policies
drop policy if exists "tasks_admin_staff" on public.tasks;

create policy "tasks_admin_staff" on public.tasks
  for all using (public.get_my_role() in ('super_admin','staff'));

-- Block 3: Fix forms policies
drop policy if exists "forms_admin_staff_write" on public.forms;
drop policy if exists "forms_all_read"          on public.forms;
drop policy if exists "forms_all_authenticated" on public.forms;

create policy "forms_all_read" on public.forms
  for select using (auth.role() = 'authenticated');

create policy "forms_admin_staff_write" on public.forms
  for all using (public.get_my_role() in ('super_admin','staff'));

-- Block 4: Fix rate_bands policies
drop policy if exists "rate_bands_read"  on public.rate_bands;
drop policy if exists "rate_bands_write" on public.rate_bands;

create policy "rate_bands_read" on public.rate_bands
  for select using (auth.role() = 'authenticated');

create policy "rate_bands_write" on public.rate_bands
  for all using (public.get_my_role() in ('super_admin','staff'));

-- Block 5: Fix company_elections policies
drop policy if exists "elections_admin_staff"   on public.company_elections;
drop policy if exists "elections_client_read"   on public.company_elections;
drop policy if exists "elections_client_write"  on public.company_elections;

create policy "elections_admin_staff" on public.company_elections
  for all using (public.get_my_role() in ('super_admin','staff'));

create policy "elections_client_read" on public.company_elections
  for select using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.company_id = company_id
    )
  );

create policy "elections_client_submit" on public.company_elections
  for update using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.company_id = company_id
    )
  );
