-- ═══════════════════════════════════════════════════════════════
-- 011_kaiser_integration.sql
-- Kaiser Permanente carrier support
-- Run each block separately in Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════

-- ── BLOCK 1: Company Kaiser fields ───────────────────────────

ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS kaiser_eligible boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS kaiser_schedule text;

-- ── BLOCK 2: Kaiser rates table ──────────────────────────────
-- Company-specific composite rates — not shared across companies.
-- Tiers stored as columns (matching rate_bands pattern).

CREATE TABLE IF NOT EXISTS public.kaiser_rates (
  id              uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  company_id      uuid REFERENCES public.companies NOT NULL,
  plan_year       text NOT NULL DEFAULT '2025-2026',
  schedule        text NOT NULL,
  kaiser_plan_no  text NOT NULL,
  package_type    text NOT NULL CHECK (package_type IN ('med_rx', 'full')),
  premium_single     numeric(10,2) NOT NULL DEFAULT 0,
  premium_two_party  numeric(10,2) NOT NULL DEFAULT 0,
  premium_family     numeric(10,2) NOT NULL DEFAULT 0,
  medical_single     numeric(10,2) NOT NULL DEFAULT 0,
  medical_two_party  numeric(10,2) NOT NULL DEFAULT 0,
  medical_family     numeric(10,2) NOT NULL DEFAULT 0,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now(),
  UNIQUE (company_id, plan_year, kaiser_plan_no, package_type)
);

ALTER TABLE public.kaiser_rates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kaiser_rates_admin_all" ON public.kaiser_rates
  FOR ALL USING (public.get_my_role() IN ('super_admin', 'staff'));

CREATE POLICY "kaiser_rates_hr_read" ON public.kaiser_rates
  FOR SELECT USING (
    public.get_my_role() = 'hr_client' AND
    company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid() LIMIT 1)
  );

CREATE POLICY "kaiser_rates_public_read" ON public.kaiser_rates
  FOR SELECT USING (true);

-- ── BLOCK 3: Kaiser elections on company_elections ───────────

ALTER TABLE public.company_elections
  ADD COLUMN IF NOT EXISTS carrier text DEFAULT 'hmsa'
    CHECK (carrier IN ('hmsa', 'kaiser')),
  ADD COLUMN IF NOT EXISTS kaiser_plan_no text,
  ADD COLUMN IF NOT EXISTS kaiser_package_type text
    CHECK (kaiser_package_type IN ('med_rx', 'full', NULL));

-- ── BLOCK 5: Band 9 constraint ───────────────────────────────
-- Band 9 = Riders only (no medical coverage)
ALTER TABLE public.rate_bands
  DROP CONSTRAINT IF EXISTS rate_bands_band_check;
ALTER TABLE public.rate_bands
  ADD CONSTRAINT rate_bands_band_check CHECK (band BETWEEN 0 AND 9);

ALTER TABLE public.companies
  DROP CONSTRAINT IF EXISTS companies_band_check;

-- ── BLOCK 6: Add premium breakdown columns to rate_bands ─────
-- Stores individual benefit component premiums for display in OE
-- Med Only plans: medical_* = premium_*, vision/dental/life = 0
-- Full Package plans: medical_* = HMSA column, riders broken out

ALTER TABLE public.rate_bands
  ADD COLUMN IF NOT EXISTS medical_single     numeric(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS medical_two_party  numeric(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS medical_family     numeric(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS vision_single      numeric(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS vision_two_party   numeric(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS vision_family      numeric(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS dental_single      numeric(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS dental_two_party   numeric(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS dental_family      numeric(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS life_single        numeric(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS life_two_party     numeric(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS life_family        numeric(10,2) NOT NULL DEFAULT 0;

-- For existing Med Only rows, set medical = premium (already correct total)
UPDATE public.rate_bands
  SET medical_single    = premium_single,
      medical_two_party = premium_two_party,
      medical_family    = premium_family
  WHERE vision_single = 0 AND dental_single = 0;
