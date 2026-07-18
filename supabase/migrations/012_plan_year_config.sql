-- ═══════════════════════════════════════════════════════════════
-- 012_plan_year_config.sql
-- App-level config table for plan year management
-- Run each block separately in Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════

-- ── BLOCK 1: App config table ────────────────────────────────
CREATE TABLE IF NOT EXISTS public.app_config (
  key         text PRIMARY KEY,
  value       text NOT NULL,
  label       text,
  updated_at  timestamptz DEFAULT now(),
  updated_by  uuid REFERENCES auth.users
);

ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can read config
CREATE POLICY "app_config_read" ON public.app_config
  FOR SELECT USING (auth.role() = 'authenticated');

-- Public read for employee /plans page (no auth)
CREATE POLICY "app_config_public_read" ON public.app_config
  FOR SELECT USING (true);

-- Only super_admin and staff can update
CREATE POLICY "app_config_write" ON public.app_config
  FOR ALL USING (public.get_my_role() IN ('super_admin', 'staff'));

-- ── BLOCK 2: Seed initial values ────────────────────────────
INSERT INTO public.app_config (key, value, label) VALUES
  ('active_plan_year',  '2025-2026', 'Current plan year (shown to employees)'),
  ('oe_plan_year',      '2025-2026', 'Open enrollment plan year (admin & HR portal OE)'),
  ('active_plan_start', '10/01/2025', 'Current plan year start date'),
  ('active_plan_end',   '09/30/2026', 'Current plan year end date'),
  ('oe_plan_start',     '10/01/2025', 'OE plan year start date'),
  ('oe_plan_end',       '09/30/2026', 'OE plan year end date')
ON CONFLICT (key) DO NOTHING;
