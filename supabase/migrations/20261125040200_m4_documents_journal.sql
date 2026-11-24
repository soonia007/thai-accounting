-- M4 (part 3): documents, payments, journal, document sequences, audit log.
-- Posting logic lives in 20261125040300_m4_posting_engine.sql.

create type public.document_type as enum (
  'quotation',      -- ใบเสนอราคา (no posting)
  'invoice',        -- ใบแจ้งหนี้/ใบกำกับภาษี ขายเชื่อ
  'cash_sale',      -- ขายเงินสด (ใบกำกับภาษี/ใบเสร็จ)
  'credit_note',    -- ใบลดหนี้
  'debit_note',     -- ใบเพิ่มหนี้
  'purchase_order', -- ใบสั่งซื้อ (no posting)
  'bill',           -- บันทึกค่าใช้จ่าย/ซื้อเชื่อ
  'cash_purchase'   -- ซื้อเงินสด
);
create type public.document_status as enum ('draft', 'posted', 'voided');
create type public.vat_mode as enum ('exclusive', 'inclusive', 'none');
create type public.document_source as enum ('manual', 'ocr');
create type public.payment_direction as enum ('received', 'paid');

-- ---------------------------------------------------------------------------
-- documents
-- ---------------------------------------------------------------------------
create table public.documents (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  type public.document_type not null,
  number text,                                   -- assigned when posted
  status public.document_status not null default 'draft',
  doc_date date not null default (now() at time zone 'Asia/Bangkok')::date,
  due_date date,
  contact_id uuid,
  vat_mode public.vat_mode not null default 'exclusive',
  vat_rate numeric(5, 2) not null default 7.00 check (vat_rate >= 0 and vat_rate < 100),
  -- cash_sale / cash_purchase: the cash or bank ledger account the money goes through
  payment_account_id uuid,
  -- conversions (quotation → invoice) and notes (credit/debit note → invoice)
  ref_document_id uuid,
  reference text,
  notes text,
  source public.document_source not null default 'manual',
  -- totals: written by the engine (save/post), never trusted from clients
  subtotal numeric(18, 2) not null default 0,
  vat_total numeric(18, 2) not null default 0,
  vat_deferred_total numeric(18, 2) not null default 0,
  total numeric(18, 2) not null default 0,
  wht_total numeric(18, 2) not null default 0,
  net_total numeric(18, 2) not null default 0,
  posted_at timestamptz,
  posted_by uuid references auth.users (id) on delete set null,
  voided_at timestamptz,
  voided_by uuid references auth.users (id) on delete set null,
  void_reason text,
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, id),
  foreign key (company_id, contact_id) references public.contacts (company_id, id) on delete restrict,
  foreign key (company_id, payment_account_id) references public.accounts (company_id, id) on delete restrict,
  foreign key (company_id, ref_document_id) references public.documents (company_id, id) on delete restrict,
  check (status = 'draft' or number is not null)
);

create unique index documents_number_uniq on public.documents (company_id, type, number)
  where number is not null;
create index documents_company_date_idx on public.documents (company_id, doc_date desc);
create index documents_contact_idx on public.documents (contact_id);
create index documents_ref_idx on public.documents (ref_document_id);

create trigger documents_updated_at before update on public.documents
  for each row execute function private.set_updated_at();

create table public.document_lines (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  document_id uuid not null,
  line_no int not null,
  product_id uuid,
  description text not null default '',
  item_kind public.product_kind not null default 'service',
  qty numeric(18, 4) not null default 1 check (qty >= 0),
  unit_price numeric(18, 4) not null default 0 check (unit_price >= 0),
  discount numeric(18, 2) not null default 0 check (discount >= 0),
  vat_type public.product_vat_type not null default 'standard',
  wht_rate numeric(5, 2) not null default 0 check (wht_rate >= 0 and wht_rate < 100),
  -- revenue/expense account override; null → product default → account mapping
  account_id uuid,
  -- computed by the engine
  base_amount numeric(18, 2) not null default 0,
  vat_amount numeric(18, 2) not null default 0,
  wht_amount numeric(18, 2) not null default 0,
  unique (document_id, line_no),
  foreign key (company_id, document_id) references public.documents (company_id, id) on delete cascade,
  foreign key (company_id, product_id) references public.products (company_id, id) on delete restrict,
  foreign key (company_id, account_id) references public.accounts (company_id, id) on delete restrict
);

create index document_lines_document_idx on public.document_lines (document_id);

-- ---------------------------------------------------------------------------
-- payments (receipts and payments, allocated to one or more documents)
-- ---------------------------------------------------------------------------
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  direction public.payment_direction not null,
  number text,
  status public.document_status not null default 'draft',
  pay_date date not null default (now() at time zone 'Asia/Bangkok')::date,
  contact_id uuid not null,
  payment_account_id uuid not null,                -- cash/bank ledger account
  amount numeric(18, 2) not null default 0 check (amount >= 0),       -- money moved
  wht_amount numeric(18, 2) not null default 0 check (wht_amount >= 0),
  reference text,
  notes text,
  posted_at timestamptz,
  posted_by uuid references auth.users (id) on delete set null,
  voided_at timestamptz,
  voided_by uuid references auth.users (id) on delete set null,
  void_reason text,
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, id),
  foreign key (company_id, contact_id) references public.contacts (company_id, id) on delete restrict,
  foreign key (company_id, payment_account_id) references public.accounts (company_id, id) on delete restrict,
  check (status = 'draft' or number is not null)
);

create unique index payments_number_uniq on public.payments (company_id, direction, number)
  where number is not null;

create trigger payments_updated_at before update on public.payments
  for each row execute function private.set_updated_at();

create table public.payment_allocations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  payment_id uuid not null,
  document_id uuid not null,
  amount numeric(18, 2) not null check (amount > 0),   -- reduction of AR/AP (incl. VAT)
  wht_amount numeric(18, 2) not null default 0 check (wht_amount >= 0),
  vat_transferred numeric(18, 2) not null default 0,   -- deferred VAT realised (engine)
  unique (payment_id, document_id),
  foreign key (company_id, payment_id) references public.payments (company_id, id) on delete cascade,
  foreign key (company_id, document_id) references public.documents (company_id, id) on delete restrict
);

create index payment_allocations_document_idx on public.payment_allocations (document_id);

-- ---------------------------------------------------------------------------
-- journal
-- ---------------------------------------------------------------------------
create table public.journal_entries (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  entry_date date not null,
  document_id uuid,
  payment_id uuid,
  description text,
  reverses_entry_id uuid references public.journal_entries (id) on delete restrict,
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  unique (company_id, id),
  foreign key (company_id, document_id) references public.documents (company_id, id) on delete restrict,
  foreign key (company_id, payment_id) references public.payments (company_id, id) on delete restrict
);

create index journal_entries_company_date_idx on public.journal_entries (company_id, entry_date);
create index journal_entries_document_idx on public.journal_entries (document_id);
create index journal_entries_payment_idx on public.journal_entries (payment_id);

create table public.journal_lines (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  entry_id uuid not null,
  line_no int not null,
  account_id uuid not null,
  debit numeric(18, 2) not null default 0 check (debit >= 0),
  credit numeric(18, 2) not null default 0 check (credit >= 0),
  description text,
  contact_id uuid,
  check ((debit > 0 and credit = 0) or (credit > 0 and debit = 0)),
  unique (entry_id, line_no),
  foreign key (company_id, entry_id) references public.journal_entries (company_id, id) on delete restrict,
  foreign key (company_id, account_id) references public.accounts (company_id, id) on delete restrict,
  foreign key (company_id, contact_id) references public.contacts (company_id, id) on delete restrict
);

create index journal_lines_account_idx on public.journal_lines (account_id);
create index journal_lines_entry_idx on public.journal_lines (entry_id);

-- Double entry enforced in the DB (spec §2): checked at commit, once all lines exist.
create or replace function private.check_entry_balanced()
returns trigger
language plpgsql
as $$
declare
  v_entry uuid := coalesce(new.entry_id, old.entry_id);
  v_dr numeric;
  v_cr numeric;
  v_n int;
begin
  select coalesce(sum(debit), 0), coalesce(sum(credit), 0), count(*)
    into v_dr, v_cr, v_n
  from public.journal_lines where entry_id = v_entry;
  if v_n < 2 or v_dr <> v_cr then
    raise exception 'JOURNAL_NOT_BALANCED' using errcode = 'P0001',
      detail = format('entry %s: debit %s, credit %s, lines %s', v_entry, v_dr, v_cr, v_n);
  end if;
  return null;
end;
$$;

create constraint trigger journal_lines_balanced
  after insert or update or delete on public.journal_lines
  deferrable initially deferred
  for each row execute function private.check_entry_balanced();

-- Lines may only hit active, non-group accounts.
create or replace function private.check_journal_line_account()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_acc public.accounts;
begin
  select * into v_acc from public.accounts where id = new.account_id;
  if v_acc.is_group then
    raise exception 'JOURNAL_GROUP_ACCOUNT' using errcode = 'P0001', detail = v_acc.code;
  end if;
  if not v_acc.is_active then
    raise exception 'JOURNAL_INACTIVE_ACCOUNT' using errcode = 'P0001', detail = v_acc.code;
  end if;
  return new;
end;
$$;

create trigger journal_lines_account before insert on public.journal_lines
  for each row execute function private.check_journal_line_account();

-- Journal is append-only: corrections are reversing entries.
create or replace function private.forbid_change()
returns trigger
language plpgsql
as $$
begin
  raise exception 'IMMUTABLE_RECORD' using errcode = 'P0001';
end;
$$;

create trigger journal_entries_immutable before update or delete on public.journal_entries
  for each row execute function private.forbid_change();
create trigger journal_lines_immutable before update or delete on public.journal_lines
  for each row execute function private.forbid_change();

-- An account that has journal lines can no longer become a group (M2 follow-up).
create or replace function private.accounts_guard_posted()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.is_group and not old.is_group
     and exists (select 1 from public.journal_lines where account_id = new.id) then
    raise exception 'ACCOUNT_HAS_ENTRIES' using errcode = 'P0001';
  end if;
  if new.type <> old.type
     and exists (select 1 from public.journal_lines where account_id = new.id) then
    raise exception 'ACCOUNT_HAS_ENTRIES' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger accounts_guard_posted before update on public.accounts
  for each row execute function private.accounts_guard_posted();

-- ---------------------------------------------------------------------------
-- Posted documents/payments are frozen (only the engine changes status → voided)
-- ---------------------------------------------------------------------------
create or replace function private.guard_posted_document()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    if old.status <> 'draft' then
      raise exception 'DOCUMENT_NOT_DRAFT' using errcode = 'P0001';
    end if;
    return old;
  end if;
  if old.status <> 'draft' and current_setting('app.engine', true) is distinct from 'on' then
    raise exception 'DOCUMENT_NOT_DRAFT' using errcode = 'P0001';
  end if;
  if new.company_id <> old.company_id then
    raise exception 'COMPANY_IMMUTABLE' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger documents_guard before update or delete on public.documents
  for each row execute function private.guard_posted_document();
create trigger payments_guard before update or delete on public.payments
  for each row execute function private.guard_posted_document();

-- Lines/allocations follow their parent's status
create or replace function private.guard_child_of_posted()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status public.document_status;
begin
  if tg_table_name = 'document_lines' then
    select status into v_status from public.documents
    where id = coalesce(new.document_id, old.document_id);
  else
    select status into v_status from public.payments
    where id = coalesce(new.payment_id, old.payment_id);
  end if;
  if v_status is not null and v_status <> 'draft'
     and current_setting('app.engine', true) is distinct from 'on' then
    raise exception 'DOCUMENT_NOT_DRAFT' using errcode = 'P0001';
  end if;
  return coalesce(new, old);
end;
$$;

create trigger document_lines_guard before insert or update or delete on public.document_lines
  for each row execute function private.guard_child_of_posted();
create trigger payment_allocations_guard before insert or update or delete on public.payment_allocations
  for each row execute function private.guard_child_of_posted();

-- ---------------------------------------------------------------------------
-- Document number sequences (gapless: row lock in the posting transaction)
-- ---------------------------------------------------------------------------
create table public.doc_sequences (
  company_id uuid not null references public.companies (id) on delete cascade,
  series text not null,      -- document_type or 'payment_received' / 'payment_paid'
  period_key text not null,  -- '2026' (yearly) or '2026-11' (monthly)
  last_number int not null default 0,
  primary key (company_id, series, period_key)
);

-- ---------------------------------------------------------------------------
-- Audit log (spec §2): who, when, before/after for every insert/update/delete/post/void
-- ---------------------------------------------------------------------------
create table public.audit_logs (
  id bigint generated always as identity primary key,
  company_id uuid,
  table_name text not null,
  record_id uuid,
  action text not null,     -- insert / update / delete / post / void
  actor uuid default auth.uid(),
  at timestamptz not null default now(),
  old_data jsonb,
  new_data jsonb
);

create index audit_logs_company_at_idx on public.audit_logs (company_id, at desc);
create index audit_logs_record_idx on public.audit_logs (record_id);

create or replace function private.audit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_new jsonb := case when tg_op <> 'DELETE' then to_jsonb(new) end;
  v_old jsonb := case when tg_op <> 'INSERT' then to_jsonb(old) end;
  v_action text := lower(tg_op);
  v_company uuid;
  v_id uuid;
begin
  if tg_op = 'UPDATE' then
    if v_new = v_old then return null; end if;
    if (v_old ->> 'status') = 'draft' and (v_new ->> 'status') = 'posted' then v_action := 'post';
    elsif (v_old ->> 'status') = 'posted' and (v_new ->> 'status') = 'voided' then v_action := 'void';
    end if;
  end if;
  v_company := coalesce(v_new ->> 'company_id', v_old ->> 'company_id', v_new ->> 'id', v_old ->> 'id')::uuid;
  v_id := nullif(coalesce(v_new ->> 'id', v_old ->> 'id'), '')::uuid;
  insert into public.audit_logs (company_id, table_name, record_id, action, old_data, new_data)
  values (v_company, tg_table_name, v_id, v_action, v_old, v_new);
  return null;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array['companies', 'accounts', 'account_mappings', 'contacts', 'products',
                           'bank_accounts', 'documents', 'document_lines', 'payments',
                           'payment_allocations', 'journal_entries']
  loop
    execute format('create trigger %I after insert or update or delete on public.%I
                    for each row execute function private.audit()', t || '_audit', t);
  end loop;
end;
$$;

-- account_mappings has no id column; record_id stays null there (company + role are in the data).

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.documents enable row level security;
alter table public.document_lines enable row level security;
alter table public.payments enable row level security;
alter table public.payment_allocations enable row level security;
alter table public.journal_entries enable row level security;
alter table public.journal_lines enable row level security;
alter table public.doc_sequences enable row level security;
alter table public.audit_logs enable row level security;

revoke all on public.documents, public.document_lines, public.payments, public.payment_allocations,
  public.journal_entries, public.journal_lines, public.doc_sequences, public.audit_logs from anon;

-- Drafts: owner/admin/accountant/staff. Posting/voiding only through RPCs (SECURITY DEFINER).
do $$
declare t text;
begin
  foreach t in array array['documents', 'document_lines', 'payments', 'payment_allocations']
  loop
    execute format($f$
      create policy %1$s_select on public.%1$s for select to authenticated
        using (private.is_member(company_id));
      create policy %1$s_insert on public.%1$s for insert to authenticated
        with check (private.has_role(company_id, '{owner,admin,accountant,staff}'));
      create policy %1$s_update on public.%1$s for update to authenticated
        using (private.has_role(company_id, '{owner,admin,accountant,staff}'))
        with check (private.has_role(company_id, '{owner,admin,accountant,staff}'));
      create policy %1$s_delete on public.%1$s for delete to authenticated
        using (private.has_role(company_id, '{owner,admin,accountant,staff}'));
    $f$, t);
  end loop;
end;
$$;

-- Clients may not set engine-owned columns on drafts
revoke insert, update on public.documents from authenticated;
grant insert (company_id, type, doc_date, due_date, contact_id, vat_mode, vat_rate, payment_account_id,
              ref_document_id, reference, notes, source)
  on public.documents to authenticated;
grant update (doc_date, due_date, contact_id, vat_mode, vat_rate, payment_account_id,
              ref_document_id, reference, notes)
  on public.documents to authenticated;

revoke insert, update on public.document_lines from authenticated;
grant insert (company_id, document_id, line_no, product_id, description, item_kind, qty, unit_price,
              discount, vat_type, wht_rate, account_id)
  on public.document_lines to authenticated;
grant update (line_no, product_id, description, item_kind, qty, unit_price, discount, vat_type,
              wht_rate, account_id)
  on public.document_lines to authenticated;

revoke insert, update on public.payments from authenticated;
grant insert (company_id, direction, pay_date, contact_id, payment_account_id, amount, wht_amount,
              reference, notes)
  on public.payments to authenticated;
grant update (pay_date, contact_id, payment_account_id, amount, wht_amount, reference, notes)
  on public.payments to authenticated;

revoke insert, update on public.payment_allocations from authenticated;
grant insert (company_id, payment_id, document_id, amount, wht_amount)
  on public.payment_allocations to authenticated;
grant update (amount, wht_amount) on public.payment_allocations to authenticated;

-- Journal: read-only for members (written by the engine)
create policy journal_entries_select on public.journal_entries for select to authenticated
  using (private.is_member(company_id));
create policy journal_lines_select on public.journal_lines for select to authenticated
  using (private.is_member(company_id));
revoke insert, update, delete on public.journal_entries, public.journal_lines from authenticated;

-- Sequences: engine only
revoke all on public.doc_sequences from authenticated;

-- Audit log: owner/admin/accountant may read; nobody writes directly
create policy audit_logs_select on public.audit_logs for select to authenticated
  using (private.has_role(company_id, '{owner,admin,accountant}'));
revoke insert, update, delete on public.audit_logs from authenticated;
