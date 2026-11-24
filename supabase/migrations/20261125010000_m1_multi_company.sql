-- M1: Auth + multi-company
--   profiles, companies, company_members, company_invitations,
--   account_templates, accounts, account_mappings
--   RLS on every table + RPCs for actions that need atomicity or extra checks.

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------
create type public.member_role as enum ('owner', 'admin', 'staff', 'accountant', 'viewer');
create type public.business_type as enum ('service', 'trading', 'manufacturing', 'restaurant');
create type public.account_type as enum ('asset', 'liability', 'equity', 'revenue', 'expense');
create type public.date_era as enum ('BE', 'CE');

-- Roles used by the posting engine (M4) to find accounts. Never hardcode account codes.
create type public.account_role as enum (
  'CASH',
  'BANK',
  'AR',
  'AP',
  'OUTPUT_VAT',
  'INPUT_VAT',
  'WHT_RECEIVABLE',
  'WHT_PAYABLE',
  'SALES_REVENUE',
  'SALES_RETURNS',
  'DEFAULT_EXPENSE',
  'INVENTORY',
  'RETAINED_EARNINGS'
);

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

-- Thai 13-digit tax ID / national ID checksum.
create or replace function public.is_valid_thai_tax_id(p_tax_id text)
returns boolean
language plpgsql
immutable
as $$
declare
  s int := 0;
  i int;
begin
  if p_tax_id is null or p_tax_id !~ '^[0-9]{13}$' then
    return false;
  end if;
  for i in 1..12 loop
    s := s + substr(p_tax_id, i, 1)::int * (14 - i);
  end loop;
  return (11 - s % 11) % 10 = substr(p_tax_id, 13, 1)::int;
end;
$$;

-- ---------------------------------------------------------------------------
-- profiles (mirror of auth.users so members can see each other's email/name)
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_updated_at before update on public.profiles
  for each row execute function private.set_updated_at();

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, coalesce(new.email, ''), new.raw_user_meta_data ->> 'full_name')
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function private.handle_new_user();

-- ---------------------------------------------------------------------------
-- companies
-- ---------------------------------------------------------------------------
create table public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  name_en text,
  address text,
  tax_id text check (tax_id is null or public.is_valid_thai_tax_id(tax_id)),
  -- '00000' = head office (สำนักงานใหญ่); otherwise 5-digit branch number
  branch_code text not null default '00000' check (branch_code ~ '^[0-9]{5}$'),
  branch_name text,
  phone text,
  email text,
  business_type public.business_type not null,
  vat_registered boolean not null default false,
  vat_rate numeric(5, 2) not null default 7.00 check (vat_rate >= 0 and vat_rate < 100),
  logo_path text,
  -- Per document type numbering settings, e.g. {"INV": {"prefix": "INV", "reset": "yearly"}}. Used in M4.
  doc_number_settings jsonb not null default '{}'::jsonb,
  fiscal_year_start_month smallint not null default 1 check (fiscal_year_start_month between 1 and 12),
  date_era public.date_era not null default 'BE',
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger companies_updated_at before update on public.companies
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- company_members
-- ---------------------------------------------------------------------------
create table public.company_members (
  company_id uuid not null references public.companies (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.member_role not null,
  created_at timestamptz not null default now(),
  primary key (company_id, user_id)
);

create index company_members_user_idx on public.company_members (user_id);

-- Membership checks. SECURITY DEFINER so RLS policies on company_members
-- can use them without recursing into their own policy.
create or replace function private.is_member(p_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.company_members m
    where m.company_id = p_company_id and m.user_id = (select auth.uid())
  );
$$;

create or replace function private.has_role(p_company_id uuid, p_roles public.member_role[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.company_members m
    where m.company_id = p_company_id
      and m.user_id = (select auth.uid())
      and m.role = any (p_roles)
  );
$$;

grant usage on schema private to authenticated;
grant execute on function private.is_member(uuid) to authenticated;
grant execute on function private.has_role(uuid, public.member_role[]) to authenticated;

-- ---------------------------------------------------------------------------
-- company_invitations
-- ---------------------------------------------------------------------------
create table public.company_invitations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  email text not null check (email ~ '^[^@\s]+@[^@\s]+$'),
  role public.member_role not null check (role <> 'owner'),
  invited_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '14 days',
  accepted_at timestamptz
);

-- One open invitation per email per company
create unique index company_invitations_open_uniq
  on public.company_invitations (company_id, lower(email))
  where accepted_at is null;

-- ---------------------------------------------------------------------------
-- Chart of accounts
-- ---------------------------------------------------------------------------
create table public.account_templates (
  id bigint generated always as identity primary key,
  business_type public.business_type not null,
  code text not null,
  name_th text not null,
  name_en text not null,
  type public.account_type not null,
  parent_code text,
  is_group boolean not null default false,
  mapping_role public.account_role,
  sort_order int not null default 0,
  unique (business_type, code),
  unique (business_type, mapping_role)
);

create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  code text not null check (length(trim(code)) > 0),
  name_th text not null,
  name_en text,
  type public.account_type not null,
  parent_id uuid,
  -- Group (header) accounts organise the tree; journal lines must not post to them (enforced in M4).
  is_group boolean not null default false,
  is_active boolean not null default true,
  -- System accounts come from the template and cannot be deleted (M2).
  is_system boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, code),
  unique (company_id, id), -- target for composite FKs that pin rows to the same company
  -- parent must belong to the same company
  foreign key (company_id, parent_id) references public.accounts (company_id, id) on delete restrict
);

create index accounts_company_idx on public.accounts (company_id);
create index accounts_parent_idx on public.accounts (parent_id);

create trigger accounts_updated_at before update on public.accounts
  for each row execute function private.set_updated_at();

create table public.account_mappings (
  company_id uuid not null references public.companies (id) on delete cascade,
  role public.account_role not null,
  account_id uuid not null,
  updated_at timestamptz not null default now(),
  primary key (company_id, role),
  -- the mapped account must belong to the same company
  foreign key (company_id, account_id) references public.accounts (company_id, id) on delete restrict
);

create trigger account_mappings_updated_at before update on public.account_mappings
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row-Level Security
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.companies enable row level security;
alter table public.company_members enable row level security;
alter table public.company_invitations enable row level security;
alter table public.account_templates enable row level security;
alter table public.accounts enable row level security;
alter table public.account_mappings enable row level security;

-- Nothing is readable anonymously.
revoke all on public.profiles, public.companies, public.company_members, public.company_invitations,
  public.account_templates, public.accounts, public.account_mappings from anon;

-- profiles: yourself + people who share a company with you
create policy profiles_select on public.profiles for select to authenticated
  using (
    id = (select auth.uid())
    or exists (
      select 1 from public.company_members theirs
      where theirs.user_id = profiles.id and private.is_member(theirs.company_id)
    )
  );
create policy profiles_update on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- companies: members read; owner/admin update; create via create_company(); owner deletes
create policy companies_select on public.companies for select to authenticated
  using (private.is_member(id));
create policy companies_update on public.companies for update to authenticated
  using (private.has_role(id, '{owner,admin}')) with check (private.has_role(id, '{owner,admin}'));
create policy companies_delete on public.companies for delete to authenticated
  using (private.has_role(id, '{owner}'));

-- company_members: members see co-members; changes only through RPCs below
create policy company_members_select on public.company_members for select to authenticated
  using (private.is_member(company_id));

-- company_invitations: owner/admin manage; invitee can see invitations sent to their email
create policy company_invitations_select on public.company_invitations for select to authenticated
  using (
    private.has_role(company_id, '{owner,admin}')
    or lower(email) = lower((select auth.jwt()) ->> 'email')
  );
create policy company_invitations_insert on public.company_invitations for insert to authenticated
  with check (private.has_role(company_id, '{owner,admin}'));
create policy company_invitations_delete on public.company_invitations for delete to authenticated
  using (private.has_role(company_id, '{owner,admin}'));

-- account_templates: read-only reference data
create policy account_templates_select on public.account_templates for select to authenticated
  using (true);

-- accounts / mappings: members read; owner/admin/accountant write
create policy accounts_select on public.accounts for select to authenticated
  using (private.is_member(company_id));
create policy accounts_insert on public.accounts for insert to authenticated
  with check (private.has_role(company_id, '{owner,admin,accountant}'));
create policy accounts_update on public.accounts for update to authenticated
  using (private.has_role(company_id, '{owner,admin,accountant}'))
  with check (private.has_role(company_id, '{owner,admin,accountant}'));
create policy accounts_delete on public.accounts for delete to authenticated
  using (private.has_role(company_id, '{owner,admin,accountant}') and not is_system);

create policy account_mappings_select on public.account_mappings for select to authenticated
  using (private.is_member(company_id));
create policy account_mappings_insert on public.account_mappings for insert to authenticated
  with check (private.has_role(company_id, '{owner,admin,accountant}'));
create policy account_mappings_update on public.account_mappings for update to authenticated
  using (private.has_role(company_id, '{owner,admin,accountant}'))
  with check (private.has_role(company_id, '{owner,admin,accountant}'));

-- ---------------------------------------------------------------------------
-- RPCs
-- ---------------------------------------------------------------------------

-- Copy a business-type template into a company's chart of accounts + mappings.
create or replace function private.load_account_template(p_company_id uuid, p_business_type public.business_type)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.accounts (company_id, code, name_th, name_en, type, is_group, is_system)
  select p_company_id, t.code, t.name_th, t.name_en, t.type, t.is_group, true
  from public.account_templates t
  where t.business_type = p_business_type;

  update public.accounts a
  set parent_id = p.id
  from public.account_templates t
  join public.accounts p on p.company_id = p_company_id and p.code = t.parent_code
  where t.business_type = p_business_type
    and a.company_id = p_company_id
    and a.code = t.code;

  insert into public.account_mappings (company_id, role, account_id)
  select p_company_id, t.mapping_role, a.id
  from public.account_templates t
  join public.accounts a on a.company_id = p_company_id and a.code = t.code
  where t.business_type = p_business_type and t.mapping_role is not null;
end;
$$;

-- Onboarding: create a company, make the caller its owner, load the chart of accounts. Atomic.
create or replace function public.create_company(
  p_name text,
  p_business_type public.business_type,
  p_tax_id text default null,
  p_branch_code text default '00000',
  p_branch_name text default null,
  p_address text default null,
  p_vat_registered boolean default false,
  p_vat_rate numeric default 7.00
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_company_id uuid;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  insert into public.companies (
    name, business_type, tax_id, branch_code, branch_name, address, vat_registered, vat_rate, created_by
  )
  values (
    trim(p_name), p_business_type, nullif(trim(p_tax_id), ''), coalesce(p_branch_code, '00000'),
    nullif(trim(p_branch_name), ''), nullif(trim(p_address), ''), p_vat_registered,
    coalesce(p_vat_rate, 7.00), v_uid
  )
  returning id into v_company_id;

  insert into public.company_members (company_id, user_id, role) values (v_company_id, v_uid, 'owner');

  perform private.load_account_template(v_company_id, p_business_type);

  return v_company_id;
end;
$$;

-- Open invitations for the caller's email, with the company name (invitees cannot read
-- companies before joining).
create or replace function public.my_invitations()
returns table (id uuid, company_id uuid, company_name text, role public.member_role, expires_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select i.id, i.company_id, c.name, i.role, i.expires_at
  from public.company_invitations i
  join public.companies c on c.id = i.company_id
  where lower(i.email) = lower((select auth.jwt()) ->> 'email')
    and i.accepted_at is null
    and i.expires_at > now()
  order by i.created_at;
$$;

-- Accept an invitation addressed to the caller's email.
create or replace function public.accept_invitation(p_invitation_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_email text := lower((select auth.jwt()) ->> 'email');
  v_inv public.company_invitations;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  select * into v_inv from public.company_invitations where id = p_invitation_id for update;

  if v_inv.id is null or lower(v_inv.email) <> v_email then
    raise exception 'invitation not found' using errcode = 'P0002';
  end if;
  if v_inv.accepted_at is not null then
    raise exception 'invitation already accepted' using errcode = 'P0001';
  end if;
  if v_inv.expires_at < now() then
    raise exception 'invitation expired' using errcode = 'P0001';
  end if;

  insert into public.company_members (company_id, user_id, role)
  values (v_inv.company_id, v_uid, v_inv.role)
  on conflict (company_id, user_id) do nothing;

  update public.company_invitations set accepted_at = now() where id = v_inv.id;

  return v_inv.company_id;
end;
$$;

-- Guards shared by role change / removal: callers must be owner/admin, only owners touch owners,
-- and a company must always keep at least one owner.
create or replace function private.assert_can_manage_member(
  p_company_id uuid,
  p_user_id uuid,
  p_new_role public.member_role
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_target_role public.member_role;
begin
  if not private.has_role(p_company_id, '{owner,admin}') then
    raise exception 'permission denied' using errcode = '42501';
  end if;

  select role into v_target_role from public.company_members
  where company_id = p_company_id and user_id = p_user_id
  for update;

  if v_target_role is null then
    raise exception 'member not found' using errcode = 'P0002';
  end if;

  if (v_target_role = 'owner' or p_new_role = 'owner')
     and not private.has_role(p_company_id, '{owner}') then
    raise exception 'only owners can manage owners' using errcode = '42501';
  end if;

  if v_target_role = 'owner'
     and (p_new_role is null or p_new_role <> 'owner')
     and (select count(*) from public.company_members
          where company_id = p_company_id and role = 'owner') = 1 then
    raise exception 'company must keep at least one owner' using errcode = 'P0001';
  end if;
end;
$$;

create or replace function public.update_member_role(
  p_company_id uuid,
  p_user_id uuid,
  p_role public.member_role
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.assert_can_manage_member(p_company_id, p_user_id, p_role);
  update public.company_members set role = p_role
  where company_id = p_company_id and user_id = p_user_id;
end;
$$;

-- Remove a member (or leave a company when p_user_id = yourself).
create or replace function public.remove_member(p_company_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_user_id = auth.uid() and private.is_member(p_company_id)
     and not private.has_role(p_company_id, '{owner,admin}') then
    -- non-admins may leave; last-owner rule cannot apply to them
    null;
  else
    perform private.assert_can_manage_member(p_company_id, p_user_id, null);
  end if;
  delete from public.company_members where company_id = p_company_id and user_id = p_user_id;
end;
$$;

revoke execute on function public.create_company, public.my_invitations, public.accept_invitation, public.update_member_role,
  public.remove_member from anon, public;
grant execute on function public.create_company, public.my_invitations, public.accept_invitation, public.update_member_role,
  public.remove_member to authenticated;
revoke execute on function private.load_account_template, private.assert_can_manage_member,
  private.handle_new_user from public, anon, authenticated;
