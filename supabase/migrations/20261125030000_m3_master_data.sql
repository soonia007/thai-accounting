-- M3: master data — contacts, products/services, bank accounts.
-- Errors: errcode P0001 + UPPER_SNAKE message, translated in the UI (dbErrors.*).

create type public.contact_type as enum ('customer', 'vendor', 'both');
-- juristic → ภ.ง.ด.53, individual → ภ.ง.ด.3 (used by Phase 2 / M11)
create type public.entity_type as enum ('juristic', 'individual');
create type public.product_kind as enum ('product', 'service');
-- standard = company VAT rate, zero = 0% (e.g. export), exempt = ยกเว้น VAT
create type public.product_vat_type as enum ('standard', 'zero', 'exempt');
create type public.bank_account_kind as enum ('savings', 'current', 'fixed', 'other');

-- ---------------------------------------------------------------------------
-- Auto codes: C0001, P0001 … when the user leaves `code` empty
-- ---------------------------------------------------------------------------
create or replace function private.next_code(p_table regclass, p_company_id uuid, p_prefix text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_max int;
begin
  execute format(
    'select coalesce(max(substring(code from %L)::int), 0) from %s
     where company_id = $1 and code ~ %L',
    '^' || p_prefix || '([0-9]+)$', p_table, '^' || p_prefix || '[0-9]+$')
  into v_max
  using p_company_id;
  return p_prefix || lpad((v_max + 1)::text, 4, '0');
end;
$$;

-- ---------------------------------------------------------------------------
-- contacts
-- ---------------------------------------------------------------------------
create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  code text not null,
  contact_type public.contact_type not null default 'customer',
  entity_type public.entity_type not null default 'juristic',
  name text not null check (length(trim(name)) > 0),
  tax_id text check (tax_id is null or public.is_valid_thai_tax_id(tax_id)),
  branch_code text not null default '00000' check (branch_code ~ '^[0-9]{5}$'),
  branch_name text,
  address text,
  contact_person text,
  phone text,
  email text,
  credit_term_days int not null default 0 check (credit_term_days between 0 and 365),
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, code),
  unique (company_id, id)
);

-- Same tax ID + branch = same party (used for OCR vendor matching in M19)
create unique index contacts_tax_branch_uniq on public.contacts (company_id, tax_id, branch_code)
  where tax_id is not null;
create index contacts_company_name_idx on public.contacts (company_id, name);

create or replace function private.contacts_before_write()
returns trigger
language plpgsql
as $$
begin
  new.code := nullif(trim(new.code), '');
  new.name := trim(new.name);
  new.tax_id := nullif(regexp_replace(coalesce(new.tax_id, ''), '[\s-]', '', 'g'), '');
  new.email := nullif(trim(new.email), '');
  if new.code is null then
    new.code := private.next_code('public.contacts', new.company_id, 'C');
  end if;
  if tg_op = 'UPDATE' and new.company_id <> old.company_id then
    raise exception 'COMPANY_IMMUTABLE' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger contacts_before_write before insert or update on public.contacts
  for each row execute function private.contacts_before_write();
create trigger contacts_updated_at before update on public.contacts
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- products / services
-- ---------------------------------------------------------------------------
create table public.products (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  code text not null,
  kind public.product_kind not null default 'service',
  name text not null check (length(trim(name)) > 0),
  description text,
  unit text,
  -- Prices are before VAT; the document's vat_mode decides how VAT is applied (M5/M6).
  sale_price numeric(18, 2) check (sale_price is null or sale_price >= 0),
  purchase_price numeric(18, 2) check (purchase_price is null or purchase_price >= 0),
  vat_type public.product_vat_type not null default 'standard',
  -- Defaults for document lines; null → account mapping SALES_REVENUE / DEFAULT_EXPENSE
  income_account_id uuid,
  expense_account_id uuid,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, code),
  unique (company_id, id),
  foreign key (company_id, income_account_id) references public.accounts (company_id, id) on delete restrict,
  foreign key (company_id, expense_account_id) references public.accounts (company_id, id) on delete restrict
);

create index products_company_name_idx on public.products (company_id, name);

create or replace function private.products_before_write()
returns trigger
language plpgsql
as $$
declare
  v_acc public.accounts;
begin
  new.code := nullif(trim(new.code), '');
  new.name := trim(new.name);
  if new.code is null then
    new.code := private.next_code('public.products', new.company_id, 'P');
  end if;
  if tg_op = 'UPDATE' and new.company_id <> old.company_id then
    raise exception 'COMPANY_IMMUTABLE' using errcode = 'P0001';
  end if;

  if new.income_account_id is not null
     and (tg_op = 'INSERT' or new.income_account_id is distinct from old.income_account_id) then
    select * into v_acc from public.accounts where id = new.income_account_id;
    if v_acc.type <> 'revenue' then
      raise exception 'PRODUCT_INCOME_ACCOUNT_TYPE' using errcode = 'P0001';
    end if;
    if v_acc.is_group or not v_acc.is_active then
      raise exception 'PRODUCT_ACCOUNT_NOT_POSTABLE' using errcode = 'P0001';
    end if;
  end if;

  if new.expense_account_id is not null
     and (tg_op = 'INSERT' or new.expense_account_id is distinct from old.expense_account_id) then
    select * into v_acc from public.accounts where id = new.expense_account_id;
    -- expense (e.g. 5110 ซื้อสินค้า) or asset (e.g. inventory, equipment)
    if v_acc.type not in ('expense', 'asset') then
      raise exception 'PRODUCT_EXPENSE_ACCOUNT_TYPE' using errcode = 'P0001';
    end if;
    if v_acc.is_group or not v_acc.is_active then
      raise exception 'PRODUCT_ACCOUNT_NOT_POSTABLE' using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;

create trigger products_before_write before insert or update on public.products
  for each row execute function private.products_before_write();
create trigger products_updated_at before update on public.products
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- bank accounts (each linked to one ledger account in the chart of accounts)
-- ---------------------------------------------------------------------------
create table public.bank_accounts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  account_id uuid not null,
  bank_code text not null,
  account_number text not null check (length(trim(account_number)) > 0),
  account_name text not null check (length(trim(account_name)) > 0),
  branch text,
  kind public.bank_account_kind not null default 'savings',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, account_id),
  unique (company_id, bank_code, account_number),
  unique (company_id, id),
  foreign key (company_id, account_id) references public.accounts (company_id, id) on delete restrict
);

create or replace function private.bank_accounts_before_write()
returns trigger
language plpgsql
as $$
declare
  v_acc public.accounts;
begin
  new.account_number := trim(new.account_number);
  if tg_op = 'UPDATE' and new.company_id <> old.company_id then
    raise exception 'COMPANY_IMMUTABLE' using errcode = 'P0001';
  end if;
  if tg_op = 'INSERT' or new.account_id is distinct from old.account_id then
    select * into v_acc from public.accounts where id = new.account_id;
    if v_acc.type <> 'asset' then
      raise exception 'BANK_ACCOUNT_LEDGER_TYPE' using errcode = 'P0001';
    end if;
    if v_acc.is_group or not v_acc.is_active then
      raise exception 'BANK_ACCOUNT_LEDGER_NOT_POSTABLE' using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;

create trigger bank_accounts_before_write before insert or update on public.bank_accounts
  for each row execute function private.bank_accounts_before_write();
create trigger bank_accounts_updated_at before update on public.bank_accounts
  for each row execute function private.set_updated_at();

-- Create a bank account together with a new ledger account under the group that holds the
-- BANK-mapped account (e.g. 1100 สินทรัพย์หมุนเวียน). Atomic.
create or replace function public.create_bank_account_with_ledger(
  p_company_id uuid,
  p_ledger_code text,
  p_ledger_name text,
  p_bank_code text,
  p_account_number text,
  p_account_name text,
  p_branch text default null,
  p_kind public.bank_account_kind default 'savings'
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_parent uuid;
  v_account_id uuid;
  v_id uuid;
begin
  -- RLS on accounts/bank_accounts decides who may do this (SECURITY INVOKER).
  select a.parent_id into v_parent
  from public.account_mappings m
  join public.accounts a on a.id = m.account_id
  where m.company_id = p_company_id and m.role = 'BANK';

  insert into public.accounts (company_id, code, name_th, type, parent_id)
  values (p_company_id, p_ledger_code, p_ledger_name, 'asset', v_parent)
  returning id into v_account_id;

  insert into public.bank_accounts (company_id, account_id, bank_code, account_number, account_name, branch, kind)
  values (p_company_id, v_account_id, p_bank_code, p_account_number, p_account_name, nullif(trim(p_branch), ''), p_kind)
  returning id into v_id;

  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.contacts enable row level security;
alter table public.products enable row level security;
alter table public.bank_accounts enable row level security;

revoke all on public.contacts, public.products, public.bank_accounts from anon;

-- contacts & products: members read; owner/admin/accountant/staff write (daily work); viewer read-only
create policy contacts_select on public.contacts for select to authenticated
  using (private.is_member(company_id));
create policy contacts_insert on public.contacts for insert to authenticated
  with check (private.has_role(company_id, '{owner,admin,accountant,staff}'));
create policy contacts_update on public.contacts for update to authenticated
  using (private.has_role(company_id, '{owner,admin,accountant,staff}'))
  with check (private.has_role(company_id, '{owner,admin,accountant,staff}'));
create policy contacts_delete on public.contacts for delete to authenticated
  using (private.has_role(company_id, '{owner,admin,accountant}'));

create policy products_select on public.products for select to authenticated
  using (private.is_member(company_id));
create policy products_insert on public.products for insert to authenticated
  with check (private.has_role(company_id, '{owner,admin,accountant,staff}'));
create policy products_update on public.products for update to authenticated
  using (private.has_role(company_id, '{owner,admin,accountant,staff}'))
  with check (private.has_role(company_id, '{owner,admin,accountant,staff}'));
create policy products_delete on public.products for delete to authenticated
  using (private.has_role(company_id, '{owner,admin,accountant}'));

-- bank accounts: money accounts → owner/admin/accountant only
create policy bank_accounts_select on public.bank_accounts for select to authenticated
  using (private.is_member(company_id));
create policy bank_accounts_insert on public.bank_accounts for insert to authenticated
  with check (private.has_role(company_id, '{owner,admin,accountant}'));
create policy bank_accounts_update on public.bank_accounts for update to authenticated
  using (private.has_role(company_id, '{owner,admin,accountant}'))
  with check (private.has_role(company_id, '{owner,admin,accountant}'));
create policy bank_accounts_delete on public.bank_accounts for delete to authenticated
  using (private.has_role(company_id, '{owner,admin,accountant}'));

revoke execute on function public.create_bank_account_with_ledger from anon, public;
grant execute on function public.create_bank_account_with_ledger to authenticated;
revoke execute on function private.next_code from public, anon;
grant execute on function private.next_code to authenticated;
