-- ═══════════════════════════════════════════════════════════════
-- 015_aca_rates.sql
-- ACA Small Group rate tables and company quarter tracking
-- ═══════════════════════════════════════════════════════════════

-- ── ACA rates table ──────────────────────────────────────────
-- Stores per-age premiums for each ACA plan and quarter
CREATE TABLE IF NOT EXISTS public.aca_rates (
  id          uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  plan_year   text NOT NULL,               -- e.g. '2026'
  quarter     text NOT NULL,               -- e.g. '2026-1', '2026-2', '2026-3', '2026-4'
  plan_id     text NOT NULL,               -- 'aca_cm_a', 'aca_hph_plus', 'aca_ppp'
  age         integer NOT NULL CHECK (age >= 0 AND age <= 99),
  premium     numeric(10,2) NOT NULL,
  created_by  uuid REFERENCES auth.users,
  created_at  timestamptz DEFAULT now(),
  UNIQUE (quarter, plan_id, age)
);

ALTER TABLE public.aca_rates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "aca_rates_read" ON public.aca_rates
  FOR SELECT USING (true);

CREATE POLICY "aca_rates_write" ON public.aca_rates
  FOR ALL USING (public.get_my_role() IN ('super_admin', 'staff'));

-- ── ACA quarter on companies ─────────────────────────────────
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS aca_quarter text;  -- e.g. '2026-1'

-- ── Index for fast lookups ───────────────────────────────────
CREATE INDEX IF NOT EXISTS aca_rates_lookup
  ON public.aca_rates (quarter, plan_id, age);
