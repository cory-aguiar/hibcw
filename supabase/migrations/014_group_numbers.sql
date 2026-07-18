-- ═══════════════════════════════════════════════════════════════
-- 014_group_numbers.sql
-- HMSA and Kaiser group numbers per company
-- Run in Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS hmsa_group_no  text,
  ADD COLUMN IF NOT EXISTS kaiser_group_no text;

-- ── Group type ───────────────────────────────────────────────
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS group_type text DEFAULT 'merit_rated';

UPDATE public.companies
  SET group_type = 'merit_rated'
  WHERE group_type IS NULL;
