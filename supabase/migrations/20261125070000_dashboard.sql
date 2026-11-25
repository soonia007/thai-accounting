-- Dashboard summary (read-only): monthly revenue / expenses from the ledger, money on hand,
-- receivables / payables and overdue invoices. Everything comes from posted journal lines
-- (voids post reversals on the same date, so they net to zero automatically).

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

revoke execute on function public.dashboard_summary from public, anon;
grant execute on function public.dashboard_summary to authenticated;
