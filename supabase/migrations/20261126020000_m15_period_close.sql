-- M15 period close — additive only (decisions D18 in docs/DECISIONS.md):
--   * months are closed in order; companies.locked_through = last day of the latest closed month
--   * nothing can be posted, voided or reversed on or before that date: enforced on every
--     journal entry insert (documents, payments, JVs, stock, depreciation, bank adjustments …)
--   * only the owner can reopen (back to a chosen month), with a reason; every close / reopen
--     is kept in period_closes and in the audit log
--   * fiscal year (start month per company, default January); year-end closing moves the
--     year's net profit into retained earnings with a closing entry that the P&L and the
--     dashboard do not show (D18); the balance sheet picks it up automatically

-- companies.fiscal_year_start_month already exists (M1, default 1 = January)
alter table public.companies add column locked_through date;

create table public.period_closes (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  month date not null check (extract(day from month) = 1),
  closed_at timestamptz not null default now(),
  closed_by uuid references auth.users (id) on delete set null default auth.uid(),
  reopened_at timestamptz,
  reopened_by uuid references auth.users (id) on delete set null,
  reopen_reason text
);
create unique index period_closes_open on public.period_closes (company_id, month) where reopened_at is null;

create table public.fiscal_year_closes (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  year_start date not null,
  year_end date not null,
  net_profit numeric(18, 2) not null,
  closed_at timestamptz not null default now(),
  closed_by uuid references auth.users (id) on delete set null default auth.uid(),
  reopened_at timestamptz,
  reopened_by uuid references auth.users (id) on delete set null,
  reopen_reason text,
  unique (company_id, id)
);
create unique index fiscal_year_closes_open on public.fiscal_year_closes (company_id, year_end) where reopened_at is null;

alter table public.journal_entries add column fiscal_close_id uuid;
alter table public.journal_entries add constraint journal_entries_fiscal_close_fk
  foreign key (company_id, fiscal_close_id) references public.fiscal_year_closes (company_id, id);

alter table public.period_closes enable row level security;
alter table public.fiscal_year_closes enable row level security;
revoke all on public.period_closes, public.fiscal_year_closes from anon;
revoke insert, update, delete on public.period_closes, public.fiscal_year_closes from authenticated;
create policy period_closes_select on public.period_closes for select to authenticated
  using (private.is_member(company_id));
create policy fiscal_year_closes_select on public.fiscal_year_closes for select to authenticated
  using (private.is_member(company_id));
create trigger period_closes_audit after insert or update or delete on public.period_closes
  for each row execute function private.audit();
create trigger fiscal_year_closes_audit after insert or update or delete on public.fiscal_year_closes
  for each row execute function private.audit();

-- ---------------------------------------------------------------------------
-- the lock: no journal entry on or before locked_through
-- ---------------------------------------------------------------------------
create or replace function private.guard_locked_period()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_locked date;
begin
  if current_setting('app.period_override', true) = 'on' then
    return new;
  end if;
  select locked_through into v_locked from public.companies where id = new.company_id;
  if v_locked is not null and new.entry_date <= v_locked then
    raise exception 'PERIOD_LOCKED' using errcode = 'P0001',
      detail = to_char(v_locked, 'YYYY-MM-DD');
  end if;
  return new;
end;
$$;
create trigger journal_entries_period_lock before insert on public.journal_entries
  for each row execute function private.guard_locked_period();

-- ---------------------------------------------------------------------------
-- fiscal years
-- ---------------------------------------------------------------------------
create or replace function private.fiscal_year_of(p_company_id uuid, p_date date, out year_start date, out year_end date)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_start int;
  v_y int;
begin
  select fiscal_year_start_month into v_start from public.companies where id = p_company_id;
  v_y := extract(year from p_date)::int - case when extract(month from p_date)::int < v_start then 1 else 0 end;
  year_start := make_date(v_y, v_start, 1);
  year_end := (year_start + interval '1 year - 1 day')::date;
end;
$$;

create or replace function public.set_fiscal_year_start(p_company_id uuid, p_month int)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.has_role(p_company_id, '{owner,admin}') then
    raise exception 'permission denied' using errcode = '42501';
  end if;
  if exists (select 1 from public.fiscal_year_closes where company_id = p_company_id and reopened_at is null) then
    raise exception 'FISCAL_YEAR_START_LOCKED' using errcode = 'P0001';
  end if;
  update public.companies set fiscal_year_start_month = p_month where id = p_company_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- closing months
-- ---------------------------------------------------------------------------
-- What still needs attention before closing p_month (warnings, closing is still allowed).
create or replace function public.period_close_checklist(p_company_id uuid, p_month date)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_end date := (p_month + interval '1 month - 1 day')::date;
  v_drafts int;
  v_pay int;
  v_jv int;
  v_bank int;
  v_dep numeric;
  v_dep_run boolean;
  v_tb numeric;
  v_vat boolean;
  v_vat_reg boolean;
begin
  if not private.is_member(p_company_id) then
    raise exception 'permission denied' using errcode = '42501';
  end if;
  select count(*) into v_drafts from public.documents
  where company_id = p_company_id and status = 'draft' and doc_date <= v_end
    and type not in ('quotation', 'purchase_order');
  select count(*) into v_pay from public.payments where company_id = p_company_id and status = 'draft' and pay_date <= v_end;
  select count(*) into v_jv from public.manual_journals where company_id = p_company_id and status = 'draft' and entry_date <= v_end;
  select count(*) into v_bank from public.bank_statement_lines
  where company_id = p_company_id and matched_at is null and txn_date <= v_end;
  select coalesce(sum((r ->> 'amount')::numeric), 0) into v_dep from jsonb_array_elements(public.depreciation_preview(p_company_id, p_month)) r;
  select exists (select 1 from public.depreciation_runs where company_id = p_company_id and status = 'posted' and month = p_month) into v_dep_run;
  select coalesce(sum(l.debit - l.credit), 0) into v_tb from public.journal_lines l
  join public.journal_entries e on e.id = l.entry_id where l.company_id = p_company_id and e.entry_date <= v_end;
  select vat_registered into v_vat_reg from public.companies where id = p_company_id;
  select exists (select 1 from public.vat_returns where company_id = p_company_id and month = p_month) into v_vat;

  return jsonb_build_array(
    jsonb_build_object('key', 'drafts', 'ok', v_drafts + v_pay + v_jv = 0, 'count', v_drafts + v_pay + v_jv),
    jsonb_build_object('key', 'bank', 'ok', v_bank = 0, 'count', v_bank),
    jsonb_build_object('key', 'depreciation', 'ok', v_dep = 0, 'amount', v_dep, 'done', v_dep_run),
    jsonb_build_object('key', 'vat', 'ok', not v_vat_reg or v_vat, 'applies', v_vat_reg),
    jsonb_build_object('key', 'balanced', 'ok', v_tb = 0));
end;
$$;

create or replace function public.close_period(p_company_id uuid, p_month date)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_locked date;
begin
  if not private.has_role(p_company_id, '{owner,admin,accountant}') then
    raise exception 'permission denied' using errcode = '42501';
  end if;
  if p_month is null or extract(day from p_month) <> 1 then
    raise exception 'REPORT_PERIOD_INVALID' using errcode = 'P0001';
  end if;
  select locked_through into v_locked from public.companies where id = p_company_id for update;
  if (p_month + interval '1 month - 1 day')::date > (now() at time zone 'Asia/Bangkok')::date then
    raise exception 'PERIOD_NOT_ENDED' using errcode = 'P0001';
  end if;
  -- in order: the month right after the latest closed one (the first close can be any month)
  if v_locked is not null and p_month <> (v_locked + 1) then
    raise exception 'PERIOD_CLOSE_ORDER' using errcode = 'P0001',
      detail = to_char(v_locked + 1, 'YYYY-MM-DD');
  end if;
  insert into public.period_closes (company_id, month) values (p_company_id, p_month);
  update public.companies set locked_through = (p_month + interval '1 month - 1 day')::date where id = p_company_id;
end;
$$;

-- Owner only: reopen from p_month onwards (that month and every later closed month).
create or replace function public.reopen_period(p_company_id uuid, p_month date, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_locked date;
begin
  if not private.has_role(p_company_id, '{owner}') then
    raise exception 'PERIOD_REOPEN_OWNER_ONLY' using errcode = 'P0001';
  end if;
  if nullif(trim(p_reason), '') is null then
    raise exception 'VOID_REASON_REQUIRED' using errcode = 'P0001';
  end if;
  select locked_through into v_locked from public.companies where id = p_company_id for update;
  if v_locked is null or p_month > v_locked then
    raise exception 'PERIOD_NOT_CLOSED' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.fiscal_year_closes
             where company_id = p_company_id and reopened_at is null and year_end >= p_month) then
    raise exception 'PERIOD_IN_CLOSED_YEAR' using errcode = 'P0001';
  end if;
  update public.period_closes set reopened_at = now(), reopened_by = auth.uid(), reopen_reason = trim(p_reason)
  where company_id = p_company_id and month >= p_month and reopened_at is null;
  update public.companies set locked_through = case
      when exists (select 1 from public.period_closes where company_id = p_company_id and reopened_at is null)
      then (p_month - 1) else null end
  where id = p_company_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- year-end
-- ---------------------------------------------------------------------------
create or replace function public.fiscal_year_preview(p_company_id uuid, p_year_end date)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_fy record;
  v_profit numeric(18, 2);
begin
  if not private.is_member(p_company_id) then
    raise exception 'permission denied' using errcode = '42501';
  end if;
  select * into v_fy from private.fiscal_year_of(p_company_id, p_year_end);
  select coalesce(sum(l.credit - l.debit), 0) into v_profit
  from public.journal_lines l join public.journal_entries e on e.id = l.entry_id
  join public.accounts a on a.id = l.account_id
  where l.company_id = p_company_id and a.type in ('revenue', 'expense')
    and e.entry_date between v_fy.year_start and v_fy.year_end and e.fiscal_close_id is null;
  return jsonb_build_object('year_start', v_fy.year_start, 'year_end', v_fy.year_end, 'net_profit', v_profit,
    'months_closed', (select locked_through from public.companies where id = p_company_id) >= v_fy.year_end,
    'closed', exists (select 1 from public.fiscal_year_closes
                      where company_id = p_company_id and year_end = v_fy.year_end and reopened_at is null));
end;
$$;

-- Close the fiscal year ending p_year_end: every month must be closed first. Revenue and
-- expense balances of the year are moved to retained earnings at the year-end date.
create or replace function public.close_fiscal_year(p_company_id uuid, p_year_end date)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_fy record;
  v_id uuid;
  v_entry uuid;
  v_profit numeric(18, 2);
begin
  if not private.has_role(p_company_id, '{owner,admin,accountant}') then
    raise exception 'permission denied' using errcode = '42501';
  end if;
  select * into v_fy from private.fiscal_year_of(p_company_id, p_year_end);
  if v_fy.year_end <> p_year_end then
    raise exception 'FISCAL_YEAR_INVALID' using errcode = 'P0001';
  end if;
  if coalesce((select locked_through from public.companies where id = p_company_id for update), '0001-01-01') < v_fy.year_end then
    raise exception 'FISCAL_YEAR_MONTHS_OPEN' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.fiscal_year_closes where company_id = p_company_id and year_end = v_fy.year_end and reopened_at is null) then
    raise exception 'FISCAL_YEAR_CLOSED' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.fiscal_year_closes where company_id = p_company_id and reopened_at is null)
     and not exists (select 1 from public.fiscal_year_closes
                     where company_id = p_company_id and reopened_at is null and year_end = (v_fy.year_start - 1)) then
    raise exception 'FISCAL_YEAR_ORDER' using errcode = 'P0001';
  end if;
  v_profit := (public.fiscal_year_preview(p_company_id, p_year_end) ->> 'net_profit')::numeric;
  insert into public.fiscal_year_closes (company_id, year_start, year_end, net_profit)
  values (p_company_id, v_fy.year_start, v_fy.year_end, v_profit) returning id into v_id;

  perform set_config('app.engine', 'on', true);
  perform set_config('app.period_override', 'on', true);
  insert into public.journal_entries (company_id, entry_date, description, fiscal_close_id)
  values (p_company_id, v_fy.year_end, 'CLOSE FY ' || to_char(v_fy.year_end, 'YYYY'), v_id) returning id into v_entry;
  insert into public.journal_lines (company_id, entry_id, line_no, account_id, debit, credit)
  select p_company_id, v_entry, row_number() over (order by x.ord, x.code), x.acc, x.dr, x.cr from (
    select 0 as ord, a.code, a.id as acc,
           greatest(sum(l.credit - l.debit), 0) as dr, greatest(sum(l.debit - l.credit), 0) as cr
    from public.journal_lines l join public.journal_entries e on e.id = l.entry_id
    join public.accounts a on a.id = l.account_id
    where l.company_id = p_company_id and a.type in ('revenue', 'expense')
      and e.entry_date between v_fy.year_start and v_fy.year_end and e.fiscal_close_id is null
    group by a.code, a.id
    having sum(l.debit - l.credit) <> 0
    union all
    select 1, '', private.role_account(p_company_id, 'RETAINED_EARNINGS'),
           greatest(-v_profit, 0), greatest(v_profit, 0)
  ) x where x.dr + x.cr > 0;
  perform set_config('app.period_override', 'off', true);
  perform set_config('app.engine', 'off', true);
  return v_id;
end;
$$;

-- Owner only: undo the latest year-end closing (reversal entry, also hidden from the P&L).
create or replace function public.reopen_fiscal_year(p_company_id uuid, p_year_end date, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_c public.fiscal_year_closes;
  v_e public.journal_entries;
  v_new uuid;
begin
  if not private.has_role(p_company_id, '{owner}') then
    raise exception 'PERIOD_REOPEN_OWNER_ONLY' using errcode = 'P0001';
  end if;
  if nullif(trim(p_reason), '') is null then
    raise exception 'VOID_REASON_REQUIRED' using errcode = 'P0001';
  end if;
  select * into v_c from public.fiscal_year_closes
  where company_id = p_company_id and year_end = p_year_end and reopened_at is null for update;
  if v_c.id is null then
    raise exception 'FISCAL_YEAR_NOT_CLOSED' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.fiscal_year_closes where company_id = p_company_id and reopened_at is null and year_end > p_year_end) then
    raise exception 'FISCAL_YEAR_ORDER' using errcode = 'P0001';
  end if;
  perform set_config('app.engine', 'on', true);
  perform set_config('app.period_override', 'on', true);
  for v_e in select * from public.journal_entries where fiscal_close_id = v_c.id and reverses_entry_id is null loop
    insert into public.journal_entries (company_id, entry_date, description, fiscal_close_id, reverses_entry_id)
    values (p_company_id, v_e.entry_date, 'REOPEN ' || v_e.description, v_c.id, v_e.id) returning id into v_new;
    insert into public.journal_lines (company_id, entry_id, line_no, account_id, debit, credit)
    select company_id, v_new, line_no, account_id, credit, debit from public.journal_lines where entry_id = v_e.id;
  end loop;
  update public.fiscal_year_closes set reopened_at = now(), reopened_by = auth.uid(), reopen_reason = trim(p_reason)
  where id = v_c.id;
  perform set_config('app.period_override', 'off', true);
  perform set_config('app.engine', 'off', true);
end;
$$;

-- ---------------------------------------------------------------------------
-- reports: year-end closing is not shown in the P&L / dashboard (D18)
-- ---------------------------------------------------------------------------
create or replace function public.report_income_statement(p_company_ids uuid[], p_from date, p_to date)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_ids uuid[] := private.report_scope(p_company_ids);
begin
  if p_from is null or p_to is null or p_from > p_to then
    raise exception 'REPORT_PERIOD_INVALID' using errcode = 'P0001';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'code', r.code, 'type', r.type, 'name_th', r.name_th, 'name_en', r.name_en,
             'amount', r.amount) order by r.type desc, r.code)  -- 'revenue' before 'expense'
    from (
      select a.code, a.type,
             string_agg(distinct a.name_th, ' / ') as name_th,
             string_agg(distinct coalesce(a.name_en, a.name_th), ' / ') as name_en,
             sum(case when a.type = 'revenue' then l.credit - l.debit else l.debit - l.credit end) as amount
      from public.journal_lines l
      join public.journal_entries e on e.id = l.entry_id
      join public.accounts a on a.id = l.account_id
      where l.company_id = any (v_ids) and a.type in ('revenue', 'expense')
        and e.entry_date between p_from and p_to
        and e.fiscal_close_id is null  -- D18: year-end closing is not shown in the P&L
      group by a.code, a.type
    ) r
    where r.amount <> 0
  ), '[]'::jsonb);
end;
$$;

create or replace function public.dashboard_summary(p_company_id uuid, p_months int default 12)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_today date := (now() at time zone 'Asia/Bangkok')::date;
  v_first date;
  v_months jsonb;
  v_cash numeric(18, 2);
  v_ar numeric(18, 2);
  v_ap numeric(18, 2);
  v_overdue jsonb;
begin
  if not private.is_member(p_company_id) then
    raise exception 'permission denied' using errcode = '42501';
  end if;
  p_months := least(greatest(coalesce(p_months, 12), 1), 36);
  v_first := (date_trunc('month', v_today) - make_interval(months => p_months - 1))::date;

  -- Revenue = credit − debit on revenue accounts (returns reduce it); expenses = debit − credit
  select jsonb_agg(jsonb_build_object(
           'month', to_char(m.month, 'YYYY-MM'),
           'revenue', coalesce(x.revenue, 0),
           'expenses', coalesce(x.expenses, 0)) order by m.month)
    into v_months
  from generate_series(v_first, v_today, interval '1 month') as m(month)
  left join (
    select date_trunc('month', e.entry_date)::date as month,
           sum(case when a.type = 'revenue' then l.credit - l.debit else 0 end) as revenue,
           sum(case when a.type = 'expense' then l.debit - l.credit else 0 end) as expenses
    from public.journal_lines l
    join public.journal_entries e on e.id = l.entry_id
    join public.accounts a on a.id = l.account_id
    where l.company_id = p_company_id and e.entry_date >= v_first and e.entry_date <= v_today
      and e.fiscal_close_id is null
      and a.type in ('revenue', 'expense')
    group by 1
  ) x on x.month = m.month::date;

  -- Money on hand: cash/bank accounts (mapped CASH/BANK roles or linked to a bank account)
  select coalesce(sum(l.debit - l.credit), 0) into v_cash
  from public.journal_lines l
  where l.company_id = p_company_id
    and l.account_id in (
      select account_id from public.account_mappings
      where company_id = p_company_id and role in ('CASH', 'BANK')
      union
      select account_id from public.bank_accounts where company_id = p_company_id);

  select coalesce(sum(l.debit - l.credit), 0) into v_ar
  from public.journal_lines l
  where l.company_id = p_company_id
    and l.account_id = (select account_id from public.account_mappings
                        where company_id = p_company_id and role = 'AR');

  select coalesce(sum(l.credit - l.debit), 0) into v_ap
  from public.journal_lines l
  where l.company_id = p_company_id
    and l.account_id = (select account_id from public.account_mappings
                        where company_id = p_company_id and role = 'AP');

  select jsonb_build_object('count', count(*), 'amount', coalesce(sum(b.outstanding), 0))
    into v_overdue
  from public.documents d
  cross join lateral private.doc_balance(d.id) b
  where d.company_id = p_company_id and d.status = 'posted'
    and d.type in ('invoice', 'debit_note') and d.due_date < v_today and b.outstanding > 0;

  return jsonb_build_object('months', v_months, 'cash', v_cash, 'receivables', v_ar,
    'payables', v_ap, 'overdue', v_overdue, 'today', v_today);
end;
$$;


revoke execute on function public.set_fiscal_year_start, public.period_close_checklist, public.close_period,
  public.reopen_period, public.fiscal_year_preview, public.close_fiscal_year, public.reopen_fiscal_year
  from public, anon;
grant execute on function public.set_fiscal_year_start, public.period_close_checklist, public.close_period,
  public.reopen_period, public.fiscal_year_preview, public.close_fiscal_year, public.reopen_fiscal_year
  to authenticated;
revoke execute on function private.fiscal_year_of, private.guard_locked_period from public, anon;
