-- ============================================================
-- KIAA Benefits OS — Migration 008
-- Adds a random 4-digit lookup code to each company.
-- Employees enter this at /plans to view their plans.
-- ============================================================

alter table public.companies
  add column if not exists company_code text unique;

-- Assign random 4-digit codes (1000–9999) to existing companies.
-- Loop to handle rare collisions (regenerate if duplicate).
do $$
declare
  rec record;
  new_code text;
  attempts int;
begin
  for rec in select id from public.companies where company_code is null loop
    attempts := 0;
    loop
      new_code := (floor(random() * 9000) + 1000)::int::text;
      begin
        update public.companies set company_code = new_code where id = rec.id;
        exit; -- success
      exception when unique_violation then
        attempts := attempts + 1;
        if attempts > 100 then
          raise exception 'Could not assign unique code after 100 attempts';
        end if;
      end;
    end loop;
  end loop;
end;
$$;

-- Index for fast lookup
create index if not exists companies_code_idx
  on public.companies (company_code);
