-- ============================================================
-- KIAA Benefits OS — Migration 006
-- Adds separate FTE and total headcount fields to companies.
-- The existing employee_count column is kept for backward
-- compatibility and backfilled from the new fields.
-- Run each block separately in Supabase SQL Editor.
-- ============================================================

-- Block 1: Add new columns
alter table public.companies
  add column if not exists fte_count       numeric(8,2),
  add column if not exists headcount       integer,
  add column if not exists plan_participants integer;

-- Block 2: Backfill — treat existing employee_count as headcount
update public.companies
  set headcount = employee_count,
      fte_count = employee_count
  where headcount is null and employee_count is not null;
