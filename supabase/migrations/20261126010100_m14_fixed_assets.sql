-- M14 fixed assets — additive only (decisions D17 in docs/DECISIONS.md):
--   * register: category (asset / accumulated depreciation / expense accounts + default life),
--     cost, salvage value, useful life in months, start date
--   * acquired via a posted bill / cash purchase line (no extra posting), as opening balance
--     (Dr asset / Cr retained earnings, Dr retained earnings / Cr accumulated depreciation),
--     or "already in the books" (no posting)
--   * straight-line, monthly; the first month in proportion to the days in use (D17)
--   * one button per month posts depreciation for every active asset (catch-up safe: posts the
--     difference between what is due to the month end and what was posted so far)
--   * disposal: depreciation to the disposal date, remove cost and accumulated depreciation,
--     proceeds through a real cash sale (tax invoice number, VAT report), gain / loss

create or replace function public.account_role_type(p_role public.account_role)
returns public.account_type
language sql
immutable
as $$
  select case p_role
    when 'CASH' then 'asset'
    when 'BANK' then 'asset'
    when 'AR' then 'asset'
    when 'INPUT_VAT' then 'asset'
    when 'INPUT_VAT_DEFERRED' then 'asset'
    when 'WHT_RECEIVABLE' then 'asset'
    when 'INVENTORY' then 'asset'
    when 'AP' then 'liability'
    when 'OUTPUT_VAT' then 'liability'
    when 'OUTPUT_VAT_DEFERRED' then 'liability'
    when 'WHT_PAYABLE' then 'liability'
    when 'RETAINED_EARNINGS' then 'equity'
    when 'SALES_REVENUE' then 'revenue'
    when 'SALES_RETURNS' then 'revenue'
    when 'ASSET_DISPOSAL_GAIN' then 'revenue'
    when 'DEFAULT_EXPENSE' then 'expense'
    when 'WHT_BORNE_EXPENSE' then 'expense'
    when 'COGS' then 'expense'
    when 'INVENTORY_ADJUSTMENT' then 'expense'
    when 'DEPRECIATION_EXPENSE' then 'expense'
    when 'ASSET_DISPOSAL_LOSS' then 'expense'
  end::public.account_type;
$$;

update public.account_templates set mapping_role = 'DEPRECIATION_EXPENSE'
where code = '5270' and mapping_role is null;
insert into public.account_templates
  (business_type, code, name_th, name_en, type, parent_code, is_group, mapping_role, sort_order)
select b.bt, v.code, v.name_th, v.name_en, v.type::public.account_type, v.parent_code, false,
       v.role::public.account_role, v.sort_order
from (values
  ('4920', 'กำไรจากการจำหน่ายสินทรัพย์', 'Gain on disposal of assets', 'revenue', '4000', 'ASSET_DISPOSAL_GAIN', 492),
  ('5280', 'ขาดทุนจากการจำหน่ายสินทรัพย์', 'Loss on disposal of assets', 'expense', '5200', 'ASSET_DISPOSAL_LOSS', 532)
) as v (code, name_th, name_en, type, parent_code, role, sort_order)
cross join (select unnest(enum_range(null::public.business_type)) as bt) b
on conflict do nothing;

do $$
declare
  r record;
  v_parent uuid;
  v_account uuid;
begin
  for r in
    select c.id as company_id, t.code, t.name_th, t.name_en, t.type, t.parent_code, t.mapping_role
    from public.companies c
    join public.account_templates t on t.business_type = c.business_type
    where t.mapping_role in ('DEPRECIATION_EXPENSE', 'ASSET_DISPOSAL_GAIN', 'ASSET_DISPOSAL_LOSS')
      and not exists (select 1 from public.account_mappings m
                      where m.company_id = c.id and m.role = t.mapping_role)
  loop
    select id into v_parent from public.accounts
    where company_id = r.company_id and code = r.parent_code and is_group and type = r.type;
    select id into v_account from public.accounts where company_id = r.company_id and code = r.code;
    if v_account is null then
      insert into public.accounts (company_id, code, name_th, name_en, type, parent_id, is_group, is_system)
      values (r.company_id, r.code, r.name_th, r.name_en, r.type, v_parent, false, true)
      returning id into v_account;
    end if;
    if exists (select 1 from public.accounts a
               where a.id = v_account and a.type = r.type and not a.is_group and a.is_active) then
      insert into public.account_mappings (company_id, role, account_id)
      values (r.company_id, r.mapping_role, v_account);
    end if;
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- tables
-- ---------------------------------------------------------------------------
create table public.asset_categories (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  asset_account_id uuid not null,
  accum_account_id uuid not null,
  default_life_months int not null check (default_life_months between 1 and 1200),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (company_id, id),
  unique (company_id, name),
  foreign key (company_id, asset_account_id) references public.accounts (company_id, id),
  foreign key (company_id, accum_account_id) references public.accounts (company_id, id),
  check (asset_account_id <> accum_account_id)
);

create table public.fixed_assets (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  code text not null,
  name text not null check (length(trim(name)) > 0),
  category_id uuid not null,
  acquired_on date not null,                       -- depreciation starts this day
  cost numeric(18, 2) not null check (cost > 0),
  salvage numeric(18, 2) not null default 0 check (salvage >= 0),
  life_months int not null check (life_months between 1 and 1200),
  source text not null check (source in ('document', 'opening', 'recorded')),
  source_document_id uuid,
  source_line_id uuid references public.document_lines (id) on delete restrict,
  opening_accum numeric(18, 2) not null default 0 check (opening_accum >= 0),
  status text not null default 'active' check (status in ('active', 'disposed')),
  disposed_on date,
  disposal_proceeds numeric(18, 2),
  disposal_accum numeric(18, 2),                 -- accumulated depreciation removed on disposal
  disposal_document_id uuid,
  notes text,
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  unique (company_id, code),
  unique (company_id, id),
  unique (source_line_id),
  foreign key (company_id, category_id) references public.asset_categories (company_id, id),
  foreign key (company_id, source_document_id) references public.documents (company_id, id),
  foreign key (company_id, disposal_document_id) references public.documents (company_id, id),
  check (salvage < cost),
  check (opening_accum <= cost - salvage)
);

create table public.depreciation_runs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  month date not null check (extract(day from month) = 1),
  total numeric(18, 2) not null,
  status public.document_status not null default 'posted',
  posted_at timestamptz not null default now(),
  posted_by uuid references auth.users (id) on delete set null default auth.uid(),
  unique (company_id, id)
);
create unique index depreciation_runs_month on public.depreciation_runs (company_id, month) where status = 'posted';

create table public.depreciation_lines (
  run_id uuid not null references public.depreciation_runs (id) on delete cascade,
  asset_id uuid not null references public.fixed_assets (id) on delete cascade,
  amount numeric(18, 2) not null,
  primary key (run_id, asset_id)
);

alter table public.journal_entries
  add column depreciation_run_id uuid,
  add column fixed_asset_id uuid;
alter table public.journal_entries
  add constraint journal_entries_depreciation_run_fk foreign key (company_id, depreciation_run_id)
    references public.depreciation_runs (company_id, id),
  add constraint journal_entries_fixed_asset_fk foreign key (company_id, fixed_asset_id)
    references public.fixed_assets (company_id, id);

alter table public.asset_categories enable row level security;
alter table public.fixed_assets enable row level security;
alter table public.depreciation_runs enable row level security;
alter table public.depreciation_lines enable row level security;
revoke all on public.asset_categories, public.fixed_assets, public.depreciation_runs,
  public.depreciation_lines from anon;
revoke insert, update, delete on public.fixed_assets, public.depreciation_runs, public.depreciation_lines
  from authenticated;
revoke all on public.depreciation_lines from authenticated;
grant select on public.depreciation_lines to authenticated;
create policy depreciation_lines_select on public.depreciation_lines for select to authenticated
  using (exists (select 1 from public.depreciation_runs r where r.id = run_id and private.is_member(r.company_id)));
create policy asset_categories_select on public.asset_categories for select to authenticated
  using (private.is_member(company_id));
create policy asset_categories_write on public.asset_categories for all to authenticated
  using (private.has_role(company_id, '{owner,admin,accountant}'))
  with check (private.has_role(company_id, '{owner,admin,accountant}'));
create policy fixed_assets_select on public.fixed_assets for select to authenticated
  using (private.is_member(company_id));
create policy depreciation_runs_select on public.depreciation_runs for select to authenticated
  using (private.is_member(company_id));
create trigger fixed_assets_audit after insert or update or delete on public.fixed_assets
  for each row execute function private.audit();
create trigger depreciation_runs_audit after insert or update or delete on public.depreciation_runs
  for each row execute function private.audit();

-- ---------------------------------------------------------------------------
-- depreciation arithmetic (D17)
-- ---------------------------------------------------------------------------
-- Position of a day on a month scale: month index + day / days in that month.
create or replace function private.month_pos(p_date date)
returns numeric
language sql
immutable
as $$
  select (extract(year from p_date) * 12 + extract(month from p_date) - 1)::numeric
         + extract(day from p_date)::numeric
           / extract(day from (date_trunc('month', p_date) + interval '1 month - 1 day'))::numeric;
$$;

-- Depreciation due from the start date up to and including p_date (cumulative, rounded once).
create or replace function private.asset_accum_to(p_asset_id uuid, p_date date)
returns numeric
language sql
stable
security definer
set search_path = ''
as $$
  select case when p_date < a.acquired_on then 0
              else least(a.cost - a.salvage,
                         round((a.cost - a.salvage) / a.life_months
                               * (private.month_pos(p_date) - private.month_pos(a.acquired_on - 1)), 2))
         end
  from public.fixed_assets a where a.id = p_asset_id;
$$;

-- What has been booked so far: opening accumulated + posted monthly runs (+ disposal top-up).
create or replace function private.asset_booked(p_asset_id uuid)
returns numeric
language sql
stable
security definer
set search_path = ''
as $$
  select a.opening_accum + coalesce((
    select sum(l.amount) from public.depreciation_lines l
    join public.depreciation_runs r on r.id = l.run_id
    where l.asset_id = a.id and r.status = 'posted'), 0)
  from public.fixed_assets a where a.id = p_asset_id;
$$;

-- ---------------------------------------------------------------------------
-- categories / register
-- ---------------------------------------------------------------------------
-- Default categories from the company's chart (office equipment, computers, vehicles, and
-- machinery / kitchen equipment when the chart has them). Safe to call again.
create or replace function private.seed_asset_categories(p_company_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
begin
  if exists (select 1 from public.asset_categories where company_id = p_company_id) then
    return;
  end if;
  for r in
    select v.name, a.id as asset_id, d.id as accum_id, v.life
    from (values ('อุปกรณ์สำนักงาน', '1210', '1211', 60, 1), ('คอมพิวเตอร์และอุปกรณ์', '1210', '1211', 36, 2),
                 ('ยานพาหนะ', '1220', '1221', 60, 3), (null, '1230', '1231', 120, 4))
         as v (name, asset_code, accum_code, life, ord)
    join public.accounts a on a.company_id = p_company_id and a.code = v.asset_code and not a.is_group
    join public.accounts d on d.company_id = p_company_id and d.code = v.accum_code and not d.is_group
    order by v.ord
  loop
    insert into public.asset_categories (company_id, name, asset_account_id, accum_account_id, default_life_months)
    values (p_company_id,
      coalesce(r.name, (select name_th from public.accounts where id = r.asset_id)),
      r.asset_id, r.accum_id, r.life)
    on conflict do nothing;
  end loop;
end;
$$;

create or replace function public.init_asset_categories(p_company_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.has_role(p_company_id, '{owner,admin,accountant}') then
    raise exception 'permission denied' using errcode = '42501';
  end if;
  perform private.seed_asset_categories(p_company_id);
end;
$$;

-- existing companies get their default categories now
do $$
declare c uuid;
begin
  for c in select id from public.companies loop
    perform private.seed_asset_categories(c);
  end loop;
end;
$$;

-- Bill / cash-purchase lines posted to an asset-category account and not registered yet.
create or replace function public.unregistered_asset_lines(p_company_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_member(p_company_id) then
    raise exception 'permission denied' using errcode = '42501';
  end if;
  perform private.seed_asset_categories(p_company_id);  -- new companies: defaults on first use
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'line_id', l.id, 'document_id', d.id, 'number', d.number, 'doc_date', d.doc_date,
             'contact', c.name, 'description', l.description,
             'cost', l.base_amount + case when l.vat_claimable then 0 else l.vat_amount end,
             'category_id', (select k.id from public.asset_categories k
                             where k.company_id = p_company_id and k.asset_account_id = l.account_id
                             order by k.created_at limit 1))
           order by d.doc_date desc, d.number)
    from public.document_lines l
    join public.documents d on d.id = l.document_id
    left join public.contacts c on c.id = d.contact_id
    where d.company_id = p_company_id and d.status = 'posted' and d.type in ('bill', 'cash_purchase')
      and l.account_id in (select asset_account_id from public.asset_categories where company_id = p_company_id)
      and not exists (select 1 from public.fixed_assets f where f.source_line_id = l.id)
  ), '[]'::jsonb);
end;
$$;

-- payload: { company_id, name, category_id, acquired_on, cost, salvage, life_months, notes,
--            source: document|opening|recorded, source_line_id?, opening_accum? (opening),
--            opening_date? (opening: the books start date, default acquired_on) }
create or replace function public.register_fixed_asset(p_payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_company uuid := (p_payload ->> 'company_id')::uuid;
  v_source text := coalesce(p_payload ->> 'source', 'recorded');
  v_cat public.asset_categories;
  v_line record;
  v_line_id uuid;
  v_cost numeric(18, 2) := (p_payload ->> 'cost')::numeric;
  v_open numeric(18, 2) := coalesce((p_payload ->> 'opening_accum')::numeric, 0);
  v_id uuid;
  v_entry uuid;
  v_date date := (p_payload ->> 'acquired_on')::date;
  v_doc uuid;
begin
  if not private.has_role(v_company, '{owner,admin,accountant}') then
    raise exception 'permission denied' using errcode = '42501';
  end if;
  select * into v_cat from public.asset_categories where id = (p_payload ->> 'category_id')::uuid and company_id = v_company;
  if v_cat.id is null then
    raise exception 'ASSET_CATEGORY_REQUIRED' using errcode = 'P0001';
  end if;
  if v_source = 'document' then
    select l.*, d.doc_date, d.id as doc_id into v_line from public.document_lines l
    join public.documents d on d.id = l.document_id
    where l.id = (p_payload ->> 'source_line_id')::uuid and d.company_id = v_company and d.status = 'posted'
      and d.type in ('bill', 'cash_purchase');
    if v_line.id is null then
      raise exception 'ASSET_SOURCE_INVALID' using errcode = 'P0001';
    end if;
    v_doc := v_line.doc_id;
    v_line_id := v_line.id;
    v_cost := coalesce(v_cost, v_line.base_amount + case when v_line.vat_claimable then 0 else v_line.vat_amount end);
    v_date := coalesce(v_date, v_line.doc_date);
  end if;
  if v_source <> 'opening' then
    v_open := 0;
  end if;

  insert into public.fixed_assets (company_id, code, name, category_id, acquired_on, cost, salvage, life_months,
    source, source_document_id, source_line_id, opening_accum, notes)
  values (v_company, private.next_number(v_company, 'fa', coalesce(v_date, (now() at time zone 'Asia/Bangkok')::date)),
    trim(p_payload ->> 'name'), v_cat.id, v_date, v_cost,
    coalesce((p_payload ->> 'salvage')::numeric, 0),
    coalesce((p_payload ->> 'life_months')::int, v_cat.default_life_months),
    v_source, v_doc, v_line_id, v_open,
    nullif(trim(p_payload ->> 'notes'), ''))
  returning id into v_id;

  -- opening balance: bring the asset (and its accumulated depreciation) into the books
  if v_source = 'opening' then
    perform set_config('app.engine', 'on', true);
    insert into public.journal_entries (company_id, entry_date, description, fixed_asset_id)
    values (v_company, coalesce((p_payload ->> 'opening_date')::date, v_date),
            (select code || ' ' || name from public.fixed_assets where id = v_id), v_id)
    returning id into v_entry;
    insert into public.journal_lines (company_id, entry_id, line_no, account_id, debit, credit)
    select v_company, v_entry, row_number() over (), x.acc, x.dr, x.cr
    from (values
      (1, v_cat.asset_account_id, v_cost, 0::numeric),
      (2, private.role_account(v_company, 'RETAINED_EARNINGS'), 0::numeric, v_cost - v_open),
      (3, v_cat.accum_account_id, 0::numeric, v_open)) as x (ord, acc, dr, cr)
    where x.dr + x.cr > 0;
    perform set_config('app.engine', 'off', true);
  end if;
  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- monthly depreciation
-- ---------------------------------------------------------------------------
-- Preview (and the basis of posting) for a month: per active asset, due to month end − booked.
create or replace function public.depreciation_preview(p_company_id uuid, p_month date)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_end date := (p_month + interval '1 month - 1 day')::date;
begin
  if not private.is_member(p_company_id) then
    raise exception 'permission denied' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(x order by x ->> 'code')
    from (
      select jsonb_build_object('asset_id', a.id, 'code', a.code, 'name', a.name,
               'amount', private.asset_accum_to(a.id, v_end) - private.asset_booked(a.id)) as x
      from public.fixed_assets a
      where a.company_id = p_company_id and a.status = 'active' and a.acquired_on <= v_end
    ) s
    where (x ->> 'amount')::numeric > 0
  ), '[]'::jsonb);
end;
$$;

create or replace function public.run_depreciation(p_company_id uuid, p_month date)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rows jsonb;
  v_run uuid;
  v_entry uuid;
  v_end date := (p_month + interval '1 month - 1 day')::date;
  v_total numeric(18, 2);
begin
  if not private.has_role(p_company_id, '{owner,admin,accountant}') then
    raise exception 'permission denied' using errcode = '42501';
  end if;
  if p_month is null or extract(day from p_month) <> 1 then
    raise exception 'REPORT_PERIOD_INVALID' using errcode = 'P0001';
  end if;
  if p_month > date_trunc('month', (now() at time zone 'Asia/Bangkok'))::date then
    raise exception 'DEPRECIATION_FUTURE_MONTH' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.depreciation_runs where company_id = p_company_id and status = 'posted' and month >= p_month) then
    raise exception 'DEPRECIATION_MONTH_DONE' using errcode = 'P0001';
  end if;
  -- serialise runs of one company
  perform 1 from public.companies where id = p_company_id for update;
  v_rows := public.depreciation_preview(p_company_id, p_month);
  select coalesce(sum((r ->> 'amount')::numeric), 0) into v_total from jsonb_array_elements(v_rows) r;
  if v_total = 0 then
    raise exception 'DEPRECIATION_NOTHING' using errcode = 'P0001';
  end if;

  insert into public.depreciation_runs (company_id, month, total) values (p_company_id, p_month, v_total)
  returning id into v_run;
  insert into public.depreciation_lines (run_id, asset_id, amount)
  select v_run, (r ->> 'asset_id')::uuid, (r ->> 'amount')::numeric from jsonb_array_elements(v_rows) r;

  perform set_config('app.engine', 'on', true);
  insert into public.journal_entries (company_id, entry_date, description, depreciation_run_id)
  values (p_company_id, v_end, 'DEP ' || to_char(p_month, 'YYYY-MM'), v_run) returning id into v_entry;
  insert into public.journal_lines (company_id, entry_id, line_no, account_id, debit, credit)
  select p_company_id, v_entry, row_number() over (), acc, dr, cr from (
    select private.role_account(p_company_id, 'DEPRECIATION_EXPENSE') as acc, sum(l.amount) as dr, 0::numeric as cr, 0 as ord
    from public.depreciation_lines l where l.run_id = v_run
    union all
    select k.accum_account_id, 0, sum(l.amount), 1
    from public.depreciation_lines l join public.fixed_assets a on a.id = l.asset_id
    join public.asset_categories k on k.id = a.category_id
    where l.run_id = v_run group by k.accum_account_id
  ) x order by ord;
  perform set_config('app.engine', 'off', true);
  return v_run;
end;
$$;

-- Undo the latest monthly run (e.g. an asset was registered late).
create or replace function public.void_depreciation_run(p_run_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_r public.depreciation_runs;
  v_e public.journal_entries;
  v_new uuid;
begin
  select * into v_r from public.depreciation_runs where id = p_run_id for update;
  if v_r.id is null or not private.has_role(v_r.company_id, '{owner,admin,accountant}') then
    raise exception 'permission denied' using errcode = '42501';
  end if;
  if v_r.status <> 'posted' then
    raise exception 'DOCUMENT_NOT_POSTED' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.depreciation_runs where company_id = v_r.company_id and status = 'posted' and month > v_r.month) then
    raise exception 'DEPRECIATION_NOT_LATEST' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.depreciation_lines l join public.fixed_assets a on a.id = l.asset_id
             where l.run_id = v_r.id and a.status = 'disposed') then
    raise exception 'DEPRECIATION_ASSET_DISPOSED' using errcode = 'P0001';
  end if;
  perform set_config('app.engine', 'on', true);
  for v_e in select * from public.journal_entries where depreciation_run_id = v_r.id and reverses_entry_id is null loop
    insert into public.journal_entries (company_id, entry_date, description, depreciation_run_id, reverses_entry_id)
    values (v_r.company_id, v_e.entry_date, 'VOID ' || v_e.description, v_r.id, v_e.id) returning id into v_new;
    insert into public.journal_lines (company_id, entry_id, line_no, account_id, debit, credit)
    select company_id, v_new, line_no, account_id, credit, debit from public.journal_lines where entry_id = v_e.id;
  end loop;
  update public.depreciation_runs set status = 'voided' where id = v_r.id;
  perform set_config('app.engine', 'off', true);
end;
$$;

-- ---------------------------------------------------------------------------
-- disposal
-- ---------------------------------------------------------------------------
-- Gain / loss preview (no posting).
create or replace function public.disposal_preview(p_asset_id uuid, p_date date, p_proceeds numeric)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_a public.fixed_assets;
  v_accum numeric(18, 2);
begin
  select * into v_a from public.fixed_assets where id = p_asset_id;
  if v_a.id is null or not private.is_member(v_a.company_id) then
    raise exception 'permission denied' using errcode = '42501';
  end if;
  v_accum := greatest(private.asset_accum_to(v_a.id, p_date), private.asset_booked(v_a.id));
  return jsonb_build_object(
    'cost', v_a.cost,
    'booked', private.asset_booked(v_a.id),
    'top_up', v_accum - private.asset_booked(v_a.id),
    'accum', v_accum,
    'nbv', v_a.cost - v_accum,
    'proceeds', coalesce(p_proceeds, 0),
    'gain', coalesce(p_proceeds, 0) - (v_a.cost - v_accum));
end;
$$;

-- payload: { asset_id, disposed_on, proceeds (before VAT; 0 = write-off), contact_id?,
--            payment_account_id (when proceeds > 0) }
create or replace function public.dispose_fixed_asset(p_payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_a public.fixed_assets;
  v_cat public.asset_categories;
  v_date date := (p_payload ->> 'disposed_on')::date;
  v_proceeds numeric(18, 2) := coalesce((p_payload ->> 'proceeds')::numeric, 0);
  v_p jsonb;
  v_doc uuid;
  v_entry uuid;
  v_gain_acc uuid;
begin
  select * into v_a from public.fixed_assets where id = (p_payload ->> 'asset_id')::uuid for update;
  if v_a.id is null or not private.has_role(v_a.company_id, '{owner,admin,accountant}') then
    raise exception 'permission denied' using errcode = '42501';
  end if;
  if v_a.status <> 'active' then
    raise exception 'ASSET_ALREADY_DISPOSED' using errcode = 'P0001';
  end if;
  if v_date is null or v_date < v_a.acquired_on then
    raise exception 'ASSET_DISPOSAL_DATE' using errcode = 'P0001';
  end if;
  if v_proceeds < 0 then
    raise exception 'ASSET_DISPOSAL_PROCEEDS' using errcode = 'P0001';
  end if;
  select * into v_cat from public.asset_categories where id = v_a.category_id;
  v_p := public.disposal_preview(v_a.id, v_date, v_proceeds);
  v_gain_acc := private.role_account(v_a.company_id, 'ASSET_DISPOSAL_GAIN');

  -- the sale itself: a cash sale credited to the gain account (tax invoice, VAT, receipt)
  if v_proceeds > 0 then
    v_doc := public.save_document(jsonb_build_object(
      'company_id', v_a.company_id, 'type', 'cash_sale', 'doc_date', v_date,
      'contact_id', p_payload ->> 'contact_id', 'payment_account_id', p_payload ->> 'payment_account_id',
      'vat_mode', 'exclusive',
      'lines', jsonb_build_array(jsonb_build_object('description', v_a.name, 'item_kind', 'product',
        'qty', 1, 'unit_price', v_proceeds, 'account_id', v_gain_acc))));
    perform public.post_document(v_doc);
  end if;

  -- remove the asset: top up depreciation to the disposal date, clear cost and accumulated
  -- depreciation; the book value is charged first against the proceeds (gain account), the
  -- rest is a loss
  perform set_config('app.engine', 'on', true);
  insert into public.journal_entries (company_id, entry_date, description, fixed_asset_id)
  values (v_a.company_id, v_date, 'DISPOSE ' || v_a.code || ' ' || v_a.name, v_a.id) returning id into v_entry;
  insert into public.journal_lines (company_id, entry_id, line_no, account_id, debit, credit)
  select v_a.company_id, v_entry, row_number() over (order by x.ord), x.acc, x.dr, x.cr
  from (values
    (1, private.role_account(v_a.company_id, 'DEPRECIATION_EXPENSE'), (v_p ->> 'top_up')::numeric, 0::numeric),
    (2, v_cat.accum_account_id, 0::numeric, (v_p ->> 'top_up')::numeric),
    (3, v_cat.accum_account_id, (v_p ->> 'accum')::numeric, 0::numeric),
    (4, v_gain_acc, least((v_p ->> 'nbv')::numeric, v_proceeds), 0::numeric),
    (5, private.role_account(v_a.company_id, 'ASSET_DISPOSAL_LOSS'), greatest((v_p ->> 'nbv')::numeric - v_proceeds, 0), 0::numeric),
    (6, v_cat.asset_account_id, 0::numeric, v_a.cost)
  ) as x (ord, acc, dr, cr)
  where x.dr + x.cr > 0;
  update public.fixed_assets set status = 'disposed', disposed_on = v_date, disposal_proceeds = v_proceeds,
    disposal_accum = (v_p ->> 'accum')::numeric, disposal_document_id = v_doc where id = v_a.id;
  perform set_config('app.engine', 'off', true);
  return v_entry;
end;
$$;

-- ---------------------------------------------------------------------------
-- register report
-- ---------------------------------------------------------------------------
create or replace function public.fixed_asset_register(p_company_id uuid, p_as_of date)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.is_member(p_company_id) then
    raise exception 'permission denied' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', a.id, 'code', a.code, 'name', a.name, 'category', k.name, 'category_id', k.id,
             'acquired_on', a.acquired_on, 'cost', a.cost, 'salvage', a.salvage, 'life_months', a.life_months,
             'monthly', round((a.cost - a.salvage) / a.life_months, 2),
             'booked', private.asset_booked(a.id),
             'accum', case when a.status = 'disposed' then a.disposal_accum
                           else private.asset_booked(a.id) end,
             'status', a.status, 'disposed_on', a.disposed_on, 'disposal_proceeds', a.disposal_proceeds,
             'source', a.source, 'source_document_id', a.source_document_id,
             'disposal_document_id', a.disposal_document_id)
           order by a.code)
    from public.fixed_assets a join public.asset_categories k on k.id = a.category_id
    where a.company_id = p_company_id and a.acquired_on <= p_as_of
  ), '[]'::jsonb);
end;
$$;

revoke execute on function public.init_asset_categories, public.unregistered_asset_lines,
  public.register_fixed_asset, public.depreciation_preview, public.run_depreciation,
  public.void_depreciation_run, public.disposal_preview, public.dispose_fixed_asset,
  public.fixed_asset_register from public, anon;
grant execute on function public.init_asset_categories, public.unregistered_asset_lines,
  public.register_fixed_asset, public.depreciation_preview, public.run_depreciation,
  public.void_depreciation_run, public.disposal_preview, public.dispose_fixed_asset,
  public.fixed_asset_register to authenticated;
revoke execute on function private.asset_accum_to, private.asset_booked, private.month_pos,
  private.seed_asset_categories from public, anon;
