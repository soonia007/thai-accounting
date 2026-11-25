-- M8 reports (read-only): trial balance, income statement, balance sheet, general ledger and
-- receivable / payable summary. Everything is computed from posted journal lines (voids are
-- reversal entries on the same date, so they net out). Each report takes a LIST of companies:
-- one company, or several the user belongs to ("combined"). Combined = plain sum by account code
-- (decision D10): no intercompany eliminations. Amounts are numeric(18,2).

create or replace function private.report_scope(p_company_ids uuid[])
returns uuid[]
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_ids uuid[];
  v_id uuid;
begin
  select coalesce(array_agg(distinct x), '{}') into v_ids from unnest(p_company_ids) as x;
  if cardinality(v_ids) = 0 then
    raise exception 'REPORT_NO_COMPANY' using errcode = 'P0001';
  end if;
  foreach v_id in array v_ids loop
    if not private.is_member(v_id) then
      raise exception 'permission denied' using errcode = '42501';
    end if;
  end loop;
  return v_ids;
end;
$$;

-- ---------------------------------------------------------------------------
-- Trial balance: opening (signed dr − cr), period debit / credit, closing (signed).
-- ---------------------------------------------------------------------------
create or replace function public.report_trial_balance(p_company_ids uuid[], p_from date, p_to date)
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
             'opening', r.opening, 'debit', r.debit, 'credit', r.credit, 'closing', r.closing)
           order by r.code, r.type)
    from (
      select a.code, a.type,
             string_agg(distinct a.name_th, ' / ') as name_th,
             string_agg(distinct coalesce(a.name_en, a.name_th), ' / ') as name_en,
             sum(case when e.entry_date < p_from then l.debit - l.credit else 0 end) as opening,
             sum(case when e.entry_date >= p_from then l.debit else 0 end) as debit,
             sum(case when e.entry_date >= p_from then l.credit else 0 end) as credit,
             sum(l.debit - l.credit) as closing
      from public.journal_lines l
      join public.journal_entries e on e.id = l.entry_id
      join public.accounts a on a.id = l.account_id
      where l.company_id = any (v_ids) and e.entry_date <= p_to
      group by a.code, a.type
    ) r
    where r.opening <> 0 or r.debit <> 0 or r.credit <> 0
  ), '[]'::jsonb);
end;
$$;

-- ---------------------------------------------------------------------------
-- Income statement: revenue (credit − debit) and expenses (debit − credit) within the period.
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
      group by a.code, a.type
    ) r
    where r.amount <> 0
  ), '[]'::jsonb);
end;
$$;

-- ---------------------------------------------------------------------------
-- Balance sheet as of a date. Net revenue − expense of all dates up to then that is not yet
-- closed into retained earnings (period close is M15) comes back as `unclosed_profit` (D10).
-- ---------------------------------------------------------------------------
create or replace function public.report_balance_sheet(p_company_ids uuid[], p_as_of date)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_ids uuid[] := private.report_scope(p_company_ids);
  v_rows jsonb;
  v_profit numeric(18, 2);
begin
  if p_as_of is null then
    raise exception 'REPORT_PERIOD_INVALID' using errcode = 'P0001';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
           'code', r.code, 'type', r.type, 'name_th', r.name_th, 'name_en', r.name_en,
           'amount', r.amount) order by r.code), '[]'::jsonb)
    into v_rows
  from (
    select a.code, a.type,
           string_agg(distinct a.name_th, ' / ') as name_th,
           string_agg(distinct coalesce(a.name_en, a.name_th), ' / ') as name_en,
           sum(case when a.type = 'asset' then l.debit - l.credit else l.credit - l.debit end) as amount
    from public.journal_lines l
    join public.journal_entries e on e.id = l.entry_id
    join public.accounts a on a.id = l.account_id
    where l.company_id = any (v_ids) and a.type in ('asset', 'liability', 'equity')
      and e.entry_date <= p_as_of
    group by a.code, a.type
  ) r
  where r.amount <> 0;

  select coalesce(sum(l.credit - l.debit), 0)
    into v_profit
  from public.journal_lines l
  join public.journal_entries e on e.id = l.entry_id
  join public.accounts a on a.id = l.account_id
  where l.company_id = any (v_ids) and a.type in ('revenue', 'expense') and e.entry_date <= p_as_of;

  return jsonb_build_object('rows', v_rows, 'unclosed_profit', v_profit);
end;
$$;

-- ---------------------------------------------------------------------------
-- General ledger: per account (or one account code) opening balance + every line in the period.
-- Capped so a huge period fails loudly instead of freezing the browser.
-- ---------------------------------------------------------------------------
create or replace function public.report_general_ledger(
  p_company_ids uuid[], p_from date, p_to date, p_account_code text default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_ids uuid[] := private.report_scope(p_company_ids);
  v_n bigint;
begin
  if p_from is null or p_to is null or p_from > p_to then
    raise exception 'REPORT_PERIOD_INVALID' using errcode = 'P0001';
  end if;
  select count(*) into v_n
  from public.journal_lines l
  join public.journal_entries e on e.id = l.entry_id
  join public.accounts a on a.id = l.account_id
  where l.company_id = any (v_ids) and e.entry_date between p_from and p_to
    and (p_account_code is null or a.code = p_account_code);
  if v_n > 10000 then
    raise exception 'REPORT_TOO_LARGE' using errcode = 'P0001';
  end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'code', g.code, 'type', g.type, 'name_th', g.name_th, 'name_en', g.name_en,
             'opening', g.opening, 'lines', g.lines) order by g.code, g.type)
    from (
      select x.code, x.type,
             string_agg(distinct x.name_th, ' / ') as name_th,
             string_agg(distinct coalesce(x.name_en, x.name_th), ' / ') as name_en,
             sum(case when x.entry_date < p_from then x.debit - x.credit else 0 end) as opening,
             coalesce(jsonb_agg(jsonb_build_object(
               'date', x.entry_date, 'company_id', x.company_id, 'ref', x.ref,
               'description', x.description, 'contact', x.contact,
               'debit', x.debit, 'credit', x.credit)
               order by x.entry_date, x.ref, x.entry_id, x.line_no)
               filter (where x.entry_date >= p_from), '[]'::jsonb) as lines
      from (
        select a.code, a.type, a.name_th, a.name_en, e.entry_date, l.company_id, e.id as entry_id,
               l.line_no, l.debit, l.credit,
               coalesce(d.number, pm.number, mj.number) as ref,
               coalesce(l.description, e.description) as description,
               c.name as contact
        from public.journal_lines l
        join public.journal_entries e on e.id = l.entry_id
        join public.accounts a on a.id = l.account_id
        left join public.documents d on d.id = e.document_id
        left join public.payments pm on pm.id = e.payment_id
        left join public.manual_journals mj on mj.id = e.manual_journal_id
        left join public.contacts c on c.id = l.contact_id
        where l.company_id = any (v_ids) and e.entry_date <= p_to
          and (p_account_code is null or a.code = p_account_code)
      ) x
      group by x.code, x.type
    ) g
    where g.opening <> 0 or jsonb_array_length(g.lines) > 0
  ), '[]'::jsonb);
end;
$$;

-- ---------------------------------------------------------------------------
-- Receivables ('ar') or payables ('ap') outstanding as of a date, per contact, from the ledger
-- on the company's AR / AP account. Lines without a contact appear as one "unassigned" row.
-- ---------------------------------------------------------------------------
create or replace function public.report_receivable_payable(
  p_company_ids uuid[], p_as_of date, p_kind text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_ids uuid[] := private.report_scope(p_company_ids);
  v_role public.account_role;
begin
  if p_as_of is null or p_kind not in ('ar', 'ap') then
    raise exception 'REPORT_PERIOD_INVALID' using errcode = 'P0001';
  end if;
  v_role := case p_kind when 'ar' then 'AR' else 'AP' end;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'company_id', r.company_id, 'contact_id', r.contact_id, 'contact', r.contact,
             'tax_id', r.tax_id, 'balance', r.balance) order by r.contact nulls last, r.company_id)
    from (
      select l.company_id, l.contact_id, c.name as contact, c.tax_id,
             sum(case when p_kind = 'ar' then l.debit - l.credit else l.credit - l.debit end) as balance
      from public.journal_lines l
      join public.journal_entries e on e.id = l.entry_id
      join public.account_mappings m
        on m.company_id = l.company_id and m.role = v_role and m.account_id = l.account_id
      left join public.contacts c on c.id = l.contact_id
      where l.company_id = any (v_ids) and e.entry_date <= p_as_of
      group by l.company_id, l.contact_id, c.name, c.tax_id
    ) r
    where r.balance <> 0
  ), '[]'::jsonb);
end;
$$;

revoke execute on function public.report_trial_balance, public.report_income_statement,
  public.report_balance_sheet, public.report_general_ledger, public.report_receivable_payable
  from public, anon;
grant execute on function public.report_trial_balance, public.report_income_statement,
  public.report_balance_sheet, public.report_general_ledger, public.report_receivable_payable
  to authenticated;
