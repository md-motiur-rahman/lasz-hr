-- Supabase schema for LASZ HR
-- Run this in the Supabase SQL editor for your project.

-- 1) Extension for UUIDs
create extension if not exists pgcrypto;

-- 2) Enum types
-- Subscription status
do $$
begin
  if not exists (select 1 from pg_type where typname = 'subscription_status_type') then
    create type subscription_status_type as enum ('trialing','active','past_due','canceled');
  end if;
end $$;

-- User roles
do $$
begin
  if not exists (select 1 from pg_type where typname = 'user_role_type') then
    create type user_role_type as enum ('business_admin','employee');
  end if;
end $$;

-- Employee ID document types
do $$
begin
  if not exists (select 1 from pg_type where typname = 'employee_id_document_type') then
    create type employee_id_document_type as enum ('passport','brp','arc','eu_id','other');
  end if;
end $$;

-- 3) profiles table (best-effort insert in app; fully managed by the user afterwards)
create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  company_name text,
  role user_role_type not null default 'business_admin',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Optional: unique (case-insensitive) email
create unique index if not exists profiles_email_lower_key on public.profiles (lower(email));

-- RLS for profiles
alter table public.profiles enable row level security;

drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own
on public.profiles
for select
using (auth.uid() = user_id);

drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own
on public.profiles
for insert
with check (auth.uid() = user_id);

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own
on public.profiles
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- 4) companies table used by /company/profile and subscription scaffolding
create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  company_name text not null,
  address text,
  phone text,
  company_email text,
  paye_ref text,
  accounts_office_ref text,
  subscription_status subscription_status_type,
  trial_start_at timestamptz,
  trial_end_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Ensure one company per admin; required for onConflict: 'owner_user_id' upsert in app code
create unique index if not exists companies_owner_user_id_key on public.companies (owner_user_id);

-- RLS for companies
alter table public.companies enable row level security;

drop policy if exists companies_select_own on public.companies;
create policy companies_select_own
on public.companies
for select
using (auth.uid() = owner_user_id);

drop policy if exists companies_insert_own on public.companies;
create policy companies_insert_own
on public.companies
for insert
with check (auth.uid() = owner_user_id);

drop policy if exists companies_update_own on public.companies;
create policy companies_update_own
on public.companies
for update
using (auth.uid() = owner_user_id)
with check (auth.uid() = owner_user_id);

-- Optional: allow deleting own company
-- drop policy if exists companies_delete_own on public.companies;
-- create policy companies_delete_own on public.companies for delete using (auth.uid() = owner_user_id);

-- 5) employees table (employee database)
create table if not exists public.employees (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,

  full_name text not null,
  phone text,
  email text,
  address text,
  ni_number text,
  id_number text,
  id_type employee_id_document_type not null default 'passport',
  date_of_birth date,
  joined_at date,
  department text,

  -- UK bank details
  bank_account_name text,
  bank_name text,
  sort_code text,
  account_number text,
  iban text,
  building_society_roll_number text,

  nationality text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists employees_company_idx on public.employees(company_id);
create unique index if not exists employees_company_email_key on public.employees(company_id, lower(email)) where email is not null;

alter table if exists public.employees add column if not exists joined_at date;

alter table public.employees enable row level security;

-- Helper predicate: admin owns company of this employee row
create or replace function public.is_admin_of_employee(emp public.employees) returns boolean language sql stable as $$
  select exists(
    select 1 from public.companies c
    where c.id = emp.company_id and c.owner_user_id = auth.uid()
  );
$$;

-- RLS policies for employees (admin-only for now)
drop policy if exists employees_select_admin on public.employees;
create policy employees_select_admin
on public.employees
for select
using (public.is_admin_of_employee(employees));

drop policy if exists employees_insert_admin on public.employees;
create policy employees_insert_admin
on public.employees
for insert
with check (public.is_admin_of_employee(employees));

drop policy if exists employees_update_admin on public.employees;
create policy employees_update_admin
on public.employees
for update
using (public.is_admin_of_employee(employees))
with check (public.is_admin_of_employee(employees));

-- 6) Keep updated_at in sync
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists tr_profiles_set_updated_at on public.profiles;
create trigger tr_profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists tr_companies_set_updated_at on public.companies;
create trigger tr_companies_set_updated_at
before update on public.companies
for each row execute function public.set_updated_at();

drop trigger if exists tr_employees_set_updated_at on public.employees;
create trigger tr_employees_set_updated_at
before update on public.employees
for each row execute function public.set_updated_at();

-- 7) Auto-create profile on auth.users insert (reliable even before callback)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  begin
    insert into public.profiles (user_id, email, full_name, company_name, role, created_at, updated_at)
    values (
      new.id,
      new.email,
      coalesce(new.raw_user_meta_data->>'full_name', null),
      coalesce(new.raw_user_meta_data->>'company_name', null),
      coalesce(new.raw_user_meta_data->>'role', 'business_admin'),
      now(),
      now()
    )
    on conflict (user_id) do update set
      email = excluded.email,
      full_name = excluded.full_name,
      company_name = excluded.company_name,
      role = excluded.role,
      updated_at = now();
  exception when others then
    -- Avoid failing user creation if profile insert has any issue
    perform 1;
  end;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- 8) shifts (rota) table
create table if not exists public.shifts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  department text,
  start_time timestamptz not null,
  end_time timestamptz not null,
  location text,
  role text,
  notes text,
  published boolean not null default false,
  assigned_user_id uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists shifts_company_idx on public.shifts(company_id);
create index if not exists shifts_time_idx on public.shifts(start_time);
create index if not exists shifts_employee_idx on public.shifts(employee_id);

alter table public.shifts enable row level security;

create or replace function public.is_admin_of_shift(s public.shifts) returns boolean language sql stable as $$
  select exists(
    select 1 from public.companies c
    where c.id = s.company_id and c.owner_user_id = auth.uid()
  );
$$;

-- Admin policies
drop policy if exists shifts_select_admin on public.shifts;
create policy shifts_select_admin on public.shifts for select using (public.is_admin_of_shift(shifts));
drop policy if exists shifts_insert_admin on public.shifts;
create policy shifts_insert_admin on public.shifts for insert with check (public.is_admin_of_shift(shifts));
drop policy if exists shifts_update_admin on public.shifts;
create policy shifts_update_admin on public.shifts for update using (public.is_admin_of_shift(shifts)) with check (public.is_admin_of_shift(shifts));

-- Allow admins to delete shifts too
drop policy if exists shifts_delete_admin on public.shifts;
create policy shifts_delete_admin on public.shifts for delete using (public.is_admin_of_shift(shifts));

-- Employee can read own assigned shifts (when assigned_user_id is set)
drop policy if exists shifts_select_assigned_user on public.shifts;
create policy shifts_select_assigned_user on public.shifts for select using (assigned_user_id = auth.uid());

-- updated_at trigger
drop trigger if exists tr_shifts_set_updated_at on public.shifts;
create trigger tr_shifts_set_updated_at
before update on public.shifts
for each row execute function public.set_updated_at();
