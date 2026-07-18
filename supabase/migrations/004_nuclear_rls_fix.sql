-- ============================================================
-- KIAA Benefits OS — Migration 004: RLS recursion fix
-- Run each block separately in Supabase SQL Editor
-- ============================================================

-- Block 1: Drop all old policies
drop policy if exists "profiles_select"          on public.profiles;
drop policy if exists "profiles_update_own"       on public.profiles;
drop policy if exists "profiles_admin_all"        on public.profiles;
drop policy if exists "profiles_insert_trigger"   on public.profiles;
drop policy if exists "profiles_insert_own"       on public.profiles;
drop policy if exists "profiles_delete_admin"     on public.profiles;

-- Block 2: Helper function (run separately)
create or replace function public.get_my_role()
returns text language sql security definer stable set search_path = public
as $$ select role from public.profiles where id = auth.uid() limit 1; $$;

-- Block 3: SELECT policy
create policy "profiles_select" on public.profiles
  for select using (
    auth.uid() = id or public.get_my_role() in ('super_admin', 'staff')
  );

-- Block 4: UPDATE policy
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- Block 5: INSERT policy
create policy "profiles_insert_own" on public.profiles
  for insert with check (auth.uid() = id);

-- Block 6: DELETE policy
create policy "profiles_delete_admin" on public.profiles
  for delete using (public.get_my_role() = 'super_admin');
