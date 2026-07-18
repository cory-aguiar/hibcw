-- ═══════════════════════════════════════════════════════════════
-- 017_profile_access_control.sql
-- Adds an access_revoked flag (mirrors the Supabase auth-level ban
-- so the UI can show status without a extra admin API call) and
-- an admin UPDATE policy on profiles, which was missing — only
-- "update own row" existed before this (see 004_nuclear_rls_fix.sql).
-- Run each block separately in Supabase SQL Editor.
-- ═══════════════════════════════════════════════════════════════

-- ── BLOCK 1: access_revoked flag ─────────────────────────────
alter table public.profiles
  add column if not exists access_revoked boolean not null default false;

-- ── BLOCK 2: allow staff/super_admin to update any profile ───
-- (Needed for things like editing an HR client's name/phone on their
-- behalf, or the access_revoked flag if ever set client-side.)
drop policy if exists "profiles_update_admin" on public.profiles;

create policy "profiles_update_admin" on public.profiles
  for update using (public.get_my_role() in ('super_admin', 'staff'));
