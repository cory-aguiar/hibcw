-- ============================================================
-- KIAA Benefits OS — Supabase Schema
-- Run this entire file in Supabase SQL Editor
-- ============================================================

create extension if not exists "uuid-ossp";

-- ── PROFILES ────────────────────────────────────────────────
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text unique not null,
  full_name text,
  role text not null default 'hr_client'
    check (role in ('super_admin','staff','hr_client')),
  company_id uuid,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table public.profiles enable row level security;

create policy "profiles_select" on public.profiles for select using (
  auth.uid() = id or
  exists (select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('super_admin','staff'))
);
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id);
create policy "profiles_admin_all" on public.profiles for all using (
  exists (select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'super_admin')
);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name');
  return new;
end;
$$;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ── COMPANIES ───────────────────────────────────────────────
create table public.companies (
  id           uuid default uuid_generate_v4() primary key,
  name         text not null,
  employee_count integer not null default 1,
  contact_name  text,
  contact_email text,
  contact_phone text,
  address       text,
  notes         text,
  renewal_date  date,
  plan_year_start date default '2025-10-01',
  plan_year_end   date default '2026-09-30',
  plans         text[] default '{}',
  status        text default 'active'
    check (status in ('active','inactive','prospect')),
  created_by    uuid references auth.users,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);
alter table public.companies enable row level security;

create policy "companies_admin_staff" on public.companies for all using (
  exists (select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('super_admin','staff'))
);
create policy "companies_client_select" on public.companies for select using (
  exists (select 1 from public.profiles p
    where p.id = auth.uid() and p.company_id = id)
);

-- ── TASKS ───────────────────────────────────────────────────
create table public.tasks (
  id          uuid default uuid_generate_v4() primary key,
  company_id  uuid references public.companies on delete cascade,
  title       text not null,
  description text,
  due_date    date,
  category    text default 'general'
    check (category in ('renewal','cobra','fmla','enrollment','compliance','general')),
  status      text default 'pending'
    check (status in ('pending','in_progress','complete','dismissed')),
  assigned_to uuid references auth.users,
  created_by  uuid references auth.users,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);
alter table public.tasks enable row level security;

create policy "tasks_admin_staff" on public.tasks for all using (
  exists (select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('super_admin','staff'))
);
create policy "tasks_client_select" on public.tasks for select using (
  exists (
    select 1 from public.profiles p
    join public.companies c on c.id = p.company_id
    where p.id = auth.uid() and c.id = company_id
  )
);

-- ── FORMS LIBRARY ───────────────────────────────────────────
create table public.forms (
  id          uuid default uuid_generate_v4() primary key,
  name        text not null,
  category    text not null
    check (category in ('enrollment','cobra','fmla','hipaa','hmsa','other')),
  url         text,
  description text,
  is_active   boolean default true,
  created_by  uuid references auth.users,
  created_at  timestamptz default now()
);
alter table public.forms enable row level security;

create policy "forms_all_read" on public.forms
  for select using (auth.role() = 'authenticated');
create policy "forms_admin_staff_write" on public.forms for all using (
  exists (select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('super_admin','staff'))
);

-- Seed default forms
insert into public.forms (name, category, url, description) values
  ('HMSA Open Enrollment Guide','enrollment','https://www.hmsa.com','Annual open enrollment instructions'),
  ('HMSA Member Enrollment Form','enrollment','https://www.hmsa.com','New member enrollment / change form'),
  ('HMSA Provider Search','hmsa','https://hmsa.com/search/providers','Find in-network providers'),
  ('HMSA Member Portal','hmsa','https://member.hmsa.com','Member login and benefits management'),
  ('COBRA Election Notice Template','cobra','','Federal COBRA election notice — customize per company'),
  ('COBRA Continuation Coverage Rights','cobra','https://www.dol.gov/general/topic/health-plans/cobra','DOL COBRA information'),
  ('FMLA Request Form (WH-380-E)','fmla','https://www.dol.gov/sites/dolgov/files/WHD/legacy/files/wh380E.pdf','Employee medical certification'),
  ('FMLA Designation Notice (WH-382)','fmla','https://www.dol.gov/sites/dolgov/files/WHD/legacy/files/wh382.pdf','Designate leave as FMLA-qualifying'),
  ('FMLA Employer Response (WH-381)','fmla','https://www.dol.gov/sites/dolgov/files/WHD/legacy/files/wh381.pdf','Notice of eligibility and rights'),
  ('HIPAA Notice of Privacy Practices','hipaa','https://hmsa.com','HMSA HIPAA NPP — provide to new enrollees'),
  ('HIPAA Authorization Form','hipaa','','Authorization to release protected health information'),
  ('Hawaii TDI Information','fmla','https://labor.hawaii.gov/dcd/tdi/','Hawaii Temporary Disability Insurance details');

-- ── UPDATED_AT TRIGGER ──────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;
create trigger companies_updated_at before update on public.companies
  for each row execute procedure public.set_updated_at();
create trigger tasks_updated_at before update on public.tasks
  for each row execute procedure public.set_updated_at();
create trigger profiles_updated_at before update on public.profiles
  for each row execute procedure public.set_updated_at();
