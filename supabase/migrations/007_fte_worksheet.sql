-- ============================================================
-- KIAA Benefits OS — Migration 007
-- Stores the FTE worksheet inputs so the calculation
-- is transparent and auditable.
-- Run in Supabase SQL Editor.
-- ============================================================

alter table public.companies
  add column if not exists ft_employees   integer,
  add column if not exists pt_employees   integer,
  add column if not exists pt_avg_hrs     numeric(5,2),
  add column if not exists seasonal_employees integer,
  add column if not exists seasonal_avg_hrs   numeric(5,2);
