-- ═══════════════════════════════════════════════════════════════
-- 016_kaiser_sbc_globalize.sql
-- Promotes any existing per-company Kaiser SBCs into the global
-- plan_documents table, since Kaiser plan numbers (220, 320, etc.)
-- are identical across every company/schedule — there is no such
-- thing as a distinct "full package" Kaiser SBC. Run once.
-- ═══════════════════════════════════════════════════════════════

-- ── Step 1: Preview what will be migrated (read-only, safe to run) ──
-- Old doc_type/plan_id patterns from before this fix looked like:
--   doc_type = 'kaiser_sbc', plan_id = 'kaiser_<plan_no>_<full|med_rx>'
-- This picks the single most-recently-uploaded row per plan_no
-- (in case a company had both a full and med_rx row uploaded
-- separately, which under the old bug could happen).

select distinct on (split_part(plan_id, '_', 2))
  split_part(plan_id, '_', 2) as kaiser_plan_no,
  company_id,
  file_name,
  file_url,
  uploaded_at
from public.company_documents
where doc_type = 'kaiser_sbc'
order by split_part(plan_id, '_', 2), uploaded_at desc;

-- ── Step 2: Perform the migration ────────────────────────────
-- Inserts one global plan_documents row per unique Kaiser plan_no,
-- using the most recently uploaded file for that plan number.
-- Safe to re-run (upsert on plan_id/doc_type/plan_year).

insert into public.plan_documents (plan_id, doc_type, plan_year, file_name, file_url, uploaded_by)
select distinct on (split_part(cd.plan_id, '_', 2))
  'kaiser_' || split_part(cd.plan_id, '_', 2) as plan_id,
  'kaiser_sbc'                                as doc_type,
  cd.plan_year,
  cd.file_name,
  cd.file_url,
  cd.uploaded_by
from public.company_documents cd
where cd.doc_type = 'kaiser_sbc'
order by split_part(cd.plan_id, '_', 2), cd.plan_year, cd.uploaded_at desc
on conflict (plan_id, doc_type, plan_year) do nothing;

-- ── Step 3: Clean up old per-company rows (OPTIONAL — run manually) ──
-- Leaving these in place is harmless (the app no longer reads this old
-- key format), but if you want to tidy up company_documents:
--
-- delete from public.company_documents where doc_type = 'kaiser_sbc';
