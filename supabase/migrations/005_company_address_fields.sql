-- ============================================================
-- KIAA Benefits OS — Migration 005
-- Splits address into structured fields on companies table
-- Run each block separately in Supabase SQL Editor
-- ============================================================

-- Block 1: Add new address columns
alter table public.companies
  add column if not exists address_line1 text,
  add column if not exists address_line2 text,
  add column if not exists city          text,
  add column if not exists state         text,
  add column if not exists zip           text;

-- Block 2: Backfill address_line1 from existing address field
update public.companies
  set address_line1 = address
  where address is not null and address_line1 is null;
