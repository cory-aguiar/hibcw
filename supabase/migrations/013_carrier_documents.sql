-- ═══════════════════════════════════════════════════════════════
-- 013_carrier_documents.sql
-- Carrier-level documents for digital enrollment packets
-- Run each block separately in Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════

-- ── BLOCK 1: carrier_documents table ─────────────────────────
-- Stores documents that apply to all companies on a given carrier.
-- KIAA uploads once; automatically included in enrollment packets
-- for any company that offers that carrier's plans.

CREATE TABLE IF NOT EXISTS public.carrier_documents (
  id          uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  carrier     text NOT NULL CHECK (carrier IN ('hmsa', 'kaiser')),
  doc_type    text NOT NULL CHECK (doc_type IN (
                'provider_directory',
                'drug_formulary',
                'benefit_summary',
                'group_life_enrollment',
                'member_form',
                'flyer',
                'other'
              )),
  plan_year   text,                    -- null = evergreen (e.g. Group Life form)
  label       text NOT NULL,           -- display name e.g. "HMSA Provider Directory"
  description text,                    -- optional subtitle
  file_name   text NOT NULL,
  file_url    text NOT NULL,
  sort_order  integer DEFAULT 0,       -- controls display order within carrier
  uploaded_by uuid REFERENCES auth.users,
  uploaded_at timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

ALTER TABLE public.carrier_documents ENABLE ROW LEVEL SECURITY;

-- Admins can do everything
CREATE POLICY "carrier_docs_admin_all" ON public.carrier_documents
  FOR ALL USING (public.get_my_role() IN ('super_admin', 'staff'));

-- HR clients and employees (public) can read
CREATE POLICY "carrier_docs_public_read" ON public.carrier_documents
  FOR SELECT USING (true);

-- ── BLOCK 2: Storage path convention ─────────────────────────
-- No schema change needed — uses existing 'documents' bucket
-- Path: carrier/{carrier}/{plan_year}/{filename}
--       e.g. carrier/hmsa/2025-2026/provider-directory.pdf
--            carrier/hmsa/evergreen/group-life-enrollment-form.pdf
--            carrier/kaiser/2025-2026/kaiser-drug-formulary.pdf

-- ── Add member_form doc type ─────────────────────────────────
ALTER TABLE public.carrier_documents
  DROP CONSTRAINT IF EXISTS carrier_documents_doc_type_check;

ALTER TABLE public.carrier_documents
  ADD CONSTRAINT carrier_documents_doc_type_check
  CHECK (doc_type IN (
    'provider_directory',
    'drug_formulary',
    'benefit_summary',
    'group_life_enrollment',
    'member_form',
    'flyer',
    'other'
  ));

-- ── Add form doc type ────────────────────────────────────────
ALTER TABLE public.carrier_documents
  DROP CONSTRAINT IF EXISTS carrier_documents_doc_type_check;

ALTER TABLE public.carrier_documents
  ADD CONSTRAINT carrier_documents_doc_type_check
  CHECK (doc_type IN (
    'provider_directory',
    'drug_formulary',
    'benefit_summary',
    'group_life_enrollment',
    'member_form',
    'form',
    'flyer',
    'other'
  ));
