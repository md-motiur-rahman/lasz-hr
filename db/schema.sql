-- Supabase schema for LASZ HR
-- This is the complete schema, including Stripe subscription fields.

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
  
  -- Subscription & Stripe fields (UPDATED)
  subscription_status subscription_status_type,
  trial_start_at timestamptz,
  trial_end_at timestamptz,
  stripe_customer_id text,        -- Added per review
  stripe_subscription_id text,  -- Added per review

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Ensure one company per admin; required for onConflict: 'owner_user_id' upsert in app code
-- Ensure Stripe columns exist for existing installations
alter table public.companies add column if not exists stripe_customer_id text;
alter table public.companies add column if not exists stripe_subscription_id text;
create unique index if not exists companies_owner_user_id_key on public.companies (owner_user_id);
-- Ensure stripe ids remain unique when present
create unique index if not exists companies_stripe_customer_id_key on public.companies (stripe_customer_id) where stripe_customer_id is not null;
create unique index if not exists companies_stripe_subscription_id_key on public.companies (stripe_subscription_id) where stripe_subscription_id is not null;

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
  break_minutes int not null default 0,
  location text,
  role text,
  notes text,
  published boolean not null default true,
  assigned_user_id uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Ensure default published=true on existing installations
alter table public.shifts alter column published set default true;
-- Ensure break_minutes exists with default 0 on existing installations
alter table public.shifts add column if not exists break_minutes int not null default 0;
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

-- 9) Leave management enums
-- Leave types
do $$
begin
  if not exists (select 1 from pg_type where typname = 'leave_type_type') then
    create type leave_type_type as enum (
      'annual',
      'sick',
      'maternity',
      'paternity',
      'parental',
      'bereavement',
      'unpaid',
      'study',
      'compassionate',
      'other'
    );
  end if;
end $$;

-- Leave request status
do $$
begin
  if not exists (select 1 from pg_type where typname = 'leave_status_type') then
    create type leave_status_type as enum ('pending','approved','declined','cancelled');
  end if;
end $$;

-- 10) Link employees to authenticated users (optional but enables self-service)
alter table public.employees add column if not exists user_id uuid references auth.users(id) on delete set null;
create unique index if not exists employees_user_id_key on public.employees(user_id) where user_id is not null;

-- 11) Helper: is admin of a given company id
create or replace function public.is_admin_of_company_id(cid uuid)
returns boolean language sql stable as $$
  select exists(
    select 1 from public.companies c
    where c.id = cid and c.owner_user_id = auth.uid()
  );
$$;

-- 12) Leave entitlements: per-employee, per-type allocations by period
create table if not exists public.leave_entitlements (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  leave_type leave_type_type not null,
  period_start date not null,
  period_end date not null,
  total_allocated int not null,
  carried_over int not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint leave_entitlements_period_chk check (period_end >= period_start)
);

create index if not exists leave_entitlements_company_idx on public.leave_entitlements(company_id);
create index if not exists leave_entitlements_emp_type_idx on public.leave_entitlements(employee_id, leave_type);

alter table public.leave_entitlements enable row level security;

-- RLS: admin-only management
drop policy if exists leave_entitlements_select_admin on public.leave_entitlements;
create policy leave_entitlements_select_admin
on public.leave_entitlements
for select using (public.is_admin_of_company_id(company_id));

drop policy if exists leave_entitlements_insert_admin on public.leave_entitlements;
create policy leave_entitlements_insert_admin
on public.leave_entitlements
for insert with check (public.is_admin_of_company_id(company_id));

drop policy if exists leave_entitlements_update_admin on public.leave_entitlements;
create policy leave_entitlements_update_admin
on public.leave_entitlements
for update using (public.is_admin_of_company_id(company_id))
with check (public.is_admin_of_company_id(company_id));

drop policy if exists leave_entitlements_delete_admin on public.leave_entitlements;
create policy leave_entitlements_delete_admin
on public.leave_entitlements
for delete using (public.is_admin_of_company_id(company_id));

-- Allow employees to read their own entitlements for balances UI
drop policy if exists leave_entitlements_select_self on public.leave_entitlements;
create policy leave_entitlements_select_self
on public.leave_entitlements
for select
using (
  exists (
    select 1 from public.employees e
    where e.id = employee_id and e.user_id = auth.uid()
  )
);

-- Keep updated_at in sync
drop trigger if exists tr_leave_entitlements_set_updated_at on public.leave_entitlements;
create trigger tr_leave_entitlements_set_updated_at
before update on public.leave_entitlements
for each row execute function public.set_updated_at();

-- 13) Leave requests: created by employees, approved/declined by admin
create table if not exists public.leave_requests (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  applicant_user_id uuid not null default auth.uid(),
  leave_type leave_type_type not null,
  start_date date not null,
  end_date date not null,
  duration_days int generated always as (GREATEST(1, (end_date - start_date + 1))) stored,
  reason text,
  status leave_status_type not null default 'pending',
  decided_by_user_id uuid references auth.users(id),
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint leave_requests_period_chk check (end_date >= start_date)
);

create index if not exists leave_requests_company_idx on public.leave_requests(company_id);
create index if not exists leave_requests_employee_idx on public.leave_requests(employee_id);
create index if not exists leave_requests_status_idx on public.leave_requests(status);
create index if not exists leave_requests_dates_idx on public.leave_requests(start_date, end_date);
-- Composite index for common overlap queries (employee, company, dates)
create index if not exists leave_requests_overlap_idx on public.leave_requests(employee_id, company_id, start_date, end_date);

alter table public.leave_requests enable row level security;

-- Helper predicate: admin of leave row
create or replace function public.is_admin_of_leave_request(lr public.leave_requests)
returns boolean language sql stable as $$
  select exists(
    select 1 from public.companies c
    where c.id = lr.company_id and c.owner_user_id = auth.uid()
  );
$$;

-- Admin policies (full CRUD)
drop policy if exists leave_requests_select_admin on public.leave_requests;
create policy leave_requests_select_admin on public.leave_requests for select using (public.is_admin_of_leave_request(leave_requests));

drop policy if exists leave_requests_insert_admin on public.leave_requests;
create policy leave_requests_insert_admin on public.leave_requests for insert with check (public.is_admin_of_company_id(company_id));

drop policy if exists leave_requests_update_admin on public.leave_requests;
create policy leave_requests_update_admin on public.leave_requests for update using (public.is_admin_of_leave_request(leave_requests)) with check (public.is_admin_of_leave_request(leave_requests));

drop policy if exists leave_requests_delete_admin on public.leave_requests;
create policy leave_requests_delete_admin on public.leave_requests for delete using (public.is_admin_of_leave_request(leave_requests));

-- Employee policies
-- Can submit a request for own employee record in their company
-- applicant_user_id defaults to auth.uid() to prevent spoofing
-- employee row must belong to the applicant via employees.user_id

drop policy if exists leave_requests_insert_employee on public.leave_requests;
create policy leave_requests_insert_employee
on public.leave_requests
for insert
with check (
  applicant_user_id = auth.uid()
  and exists (
    select 1 from public.employees e
    where e.id = employee_id
      and e.user_id = auth.uid()
      and e.company_id = company_id
  )
);

-- Can view own requests
-- Either because they created it or because their employee row is linked

drop policy if exists leave_requests_select_self on public.leave_requests;
create policy leave_requests_select_self
on public.leave_requests
for select
using (
  applicant_user_id = auth.uid()
  or exists (
    select 1 from public.employees e
    where e.id = employee_id and e.user_id = auth.uid()
  )
);

-- Allow cancelling own pending requests (status -> cancelled only)
drop policy if exists leave_requests_cancel_own_pending on public.leave_requests;
create policy leave_requests_cancel_own_pending
on public.leave_requests
for update
using (applicant_user_id = auth.uid() and status = 'pending')
with check (applicant_user_id = auth.uid() and status = 'cancelled');

-- Keep updated_at in sync
drop trigger if exists tr_leave_requests_set_updated_at on public.leave_requests;
create trigger tr_leave_requests_set_updated_at
before update on public.leave_requests
for each row execute function public.set_updated_at();

-- Prevent overlapping leave for same employee (pending/approved)
create or replace function public.prevent_overlapping_leave()
returns trigger
language plpgsql
as $$
begin
  -- Only enforce when the new row is pending or approved
  if new.status in ('pending','approved') then
    if exists (
      select 1
      from public.leave_requests lr
      where lr.company_id = new.company_id
        and lr.employee_id = new.employee_id
        and lr.status in ('pending','approved')
        and daterange(lr.start_date, lr.end_date, '[]') && daterange(new.start_date, new.end_date, '[]')
        and (tg_op = 'INSERT' or lr.id <> new.id)
    ) then
      raise exception 'Overlapping leave exists for this employee within the selected dates.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists prevent_overlapping_leave_trg on public.leave_requests;
create trigger prevent_overlapping_leave_trg
before insert or update on public.leave_requests
for each row execute function public.prevent_overlapping_leave();

-- 14) Computed balances per entitlement period
create or replace view public.leave_balances_v as
select
  le.company_id,
  le.employee_id,
  le.leave_type,
  le.period_start,
  le.period_end,
  le.total_allocated + le.carried_over as total_entitled_days,
  coalesce(sum(
    case
      when lr.status = 'approved'
       and lr.leave_type = 'annual' -- Note: You may want to make this dynamic or remove it
       and lr.start_date <= le.period_end
       and lr.end_date   >= le.period_start
      then lr.duration_days
      else 0
    end
  ), 0) as taken_days,
  greatest(
    (le.total_allocated + le.carried_over) - coalesce(sum(
      case
        when lr.status = 'approved'
         and lr.leave_type = 'annual' -- Note: You may want to make this dynamic or remove it
         and lr.start_date <= le.period_end
         and lr.end_date   >= le.period_start
        then lr.duration_days
        else 0
      end
    ), 0),
    0
  ) as balance_days
from public.leave_entitlements le
left join public.leave_requests lr
  on lr.company_id = le.company_id
 and lr.employee_id = le.employee_id
 and lr.leave_type = le.leave_type
GROUP BY le.company_id, le.employee_id, le.leave_type, le.period_start, le.period_end, le.total_allocated, le.carried_over;
