-- ═══════════════════════════════════════════════════════════════
-- 018_backfill_plan_elections.sql
-- One-time backfill. Companies whose plans were only ever set via
-- the "Plans enrolled" checklist in Companies (not through the Open
-- Enrollment wizard) have company.plans populated but no matching
-- company_elections rows — so nothing shows on the Open Enrollment
-- tab. This seeds those missing rows from company.plans.
--
-- Safe to run more than once: ON CONFLICT DO NOTHING means it only
-- ever fills gaps — it will never overwrite an existing election row
-- (so any company that already has real OE data, including
-- contribution amounts, is left untouched).
-- ═══════════════════════════════════════════════════════════════

insert into public.company_elections (company_id, plan_year, plan_id, elected)
select
  c.id,
  (select value from public.app_config where key = 'oe_plan_year'),
  unnest(c.plans),
  true
from public.companies c
where coalesce(c.group_type, 'merit_rated') != 'aca_small_group'
  and c.plans is not null
  and array_length(c.plans, 1) > 0
on conflict (company_id, plan_year, plan_id) do nothing;
