-- M16: full financial dashboard. One company or every company the user belongs to (simple sum,
-- no inter-company elimination). Aging is by days past due (due_date, else doc_date).
create or replace function public.dashboard_full(p_company_ids uuid[], p_months int default 12)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_today date := (now() at time zone 'Asia/Bangkok')::date;
  v_ids uuid[];
  v_first date;
  v_prev date := (date_trunc('month', v_today) - interval '1 month')::date;
  v_months jsonb;
  v_cash numeric(18, 2);
  v_ar numeric(18, 2);
  v_ap numeric(18, 2);
  v_aging jsonb;
  v_taxes jsonb := '[]'::jsonb;
  v_co record;
  v_vat jsonb;
begin
  select coalesce(array_agg(id), '{}') into v_ids
  from unnest(p_company_ids) as id where private.is_member(id);
  if cardinality(v_ids) = 0 then
    raise exception 'permission denied' using errcode = '42501';
  end if;
  p_months := least(greatest(coalesce(p_months, 12), 1), 36);
  v_first := (date_trunc('month', v_today) - make_interval(months => p_months - 1))::date;

  with cash_accts as (
    select company_id, account_id from public.account_mappings
    where company_id = any (v_ids) and role in ('CASH', 'BANK')
    union
    select company_id, account_id from public.bank_accounts where company_id = any (v_ids)
  ), x as (
    select date_trunc('month', e.entry_date)::date as month,
           sum(case when a.type = 'revenue' then l.credit - l.debit else 0 end) as revenue,
           sum(case when a.type = 'expense' then l.debit - l.credit else 0 end) as expenses,
           sum(case when c.account_id is not null then l.debit else 0 end) as cash_in,
           sum(case when c.account_id is not null then l.credit else 0 end) as cash_out
    from public.journal_lines l
    join public.journal_entries e on e.id = l.entry_id
    join public.accounts a on a.id = l.account_id
    left join cash_accts c on c.company_id = l.company_id and c.account_id = l.account_id
    where l.company_id = any (v_ids) and e.entry_date between v_first and v_today
      and e.fiscal_close_id is null
    group by 1
  )
  select jsonb_agg(jsonb_build_object(
           'month', to_char(m.month, 'YYYY-MM'),
           'revenue', coalesce(x.revenue, 0), 'expenses', coalesce(x.expenses, 0),
           'cash_in', coalesce(x.cash_in, 0), 'cash_out', coalesce(x.cash_out, 0)) order by m.month)
    into v_months
  from generate_series(v_first, v_today, interval '1 month') as m(month)
  left join x on x.month = m.month::date;

  select coalesce(sum(l.debit - l.credit), 0) into v_cash
  from public.journal_lines l
  where l.company_id = any (v_ids)
    and (l.company_id, l.account_id) in (
      select company_id, account_id from public.account_mappings
      where company_id = any (v_ids) and role in ('CASH', 'BANK')
      union
      select company_id, account_id from public.bank_accounts where company_id = any (v_ids));

  select coalesce(sum(case when m.role = 'AR' then l.debit - l.credit else 0 end), 0),
         coalesce(sum(case when m.role = 'AP' then l.credit - l.debit else 0 end), 0)
    into v_ar, v_ap
  from public.journal_lines l
  join public.account_mappings m on m.company_id = l.company_id and m.account_id = l.account_id
  where l.company_id = any (v_ids) and m.role in ('AR', 'AP');

  with open_docs as (
    select case when d.type = 'bill' then 'ap' else 'ar' end as side,
           v_today - coalesce(d.due_date, d.doc_date) as days, b.outstanding
    from public.documents d
    cross join lateral private.doc_balance(d.id) b
    where d.company_id = any (v_ids) and d.status = 'posted'
      and d.type in ('invoice', 'debit_note', 'bill') and b.outstanding > 0
  ), side as (select unnest(array['ar', 'ap']) as side)
  select jsonb_object_agg(s.side, (
           select jsonb_build_object(
             'current', coalesce(sum(outstanding) filter (where days <= 0), 0),
             'd30', coalesce(sum(outstanding) filter (where days between 1 and 30), 0),
             'd60', coalesce(sum(outstanding) filter (where days between 31 and 60), 0),
             'd90', coalesce(sum(outstanding) filter (where days between 61 and 90), 0),
             'over90', coalesce(sum(outstanding) filter (where days > 90), 0),
             'count', count(*), 'overdue_count', count(*) filter (where days > 0))
           from open_docs o where o.side = s.side))
    into v_aging
  from side s;

  -- Filings due this month for last month's activity (due dates: paper / e-filing).
  for v_co in select id, name, vat_registered from public.companies where id = any (v_ids) order by name loop
    if v_co.vat_registered then
      begin
        v_vat := public.vat_return_summary(v_co.id, v_prev);
      exception when insufficient_privilege then
        v_vat := null; -- roles that can't see VAT reports just don't get the estimate
      end;
      if v_vat is not null then
      v_taxes := v_taxes || jsonb_build_object('company_id', v_co.id, 'company', v_co.name, 'form', 'pp30',
        'amount', coalesce((v_vat ->> 'net')::numeric, 0), 'filed', v_vat -> 'filing' <> 'null'::jsonb,
        'due', (v_prev + interval '1 month 14 days')::date, 'due_efiling', (v_prev + interval '1 month 22 days')::date);
      end if;
    end if;
    v_taxes := v_taxes || coalesce((
      select jsonb_agg(jsonb_build_object('company_id', v_co.id, 'company', v_co.name, 'form', f.form,
        'amount', coalesce(t.tax, 0), 'filed', null,
        'due', (v_prev + interval '1 month 6 days')::date, 'due_efiling', (v_prev + interval '1 month 14 days')::date)
        order by f.form)
      from unnest(array['pnd3', 'pnd53']::public.wht_form[]) as f(form)
      left join lateral (
        select sum(wl.tax_amount) as tax
        from public.wht_certificates w join public.wht_certificate_lines wl on wl.certificate_id = w.id
        where w.company_id = v_co.id and w.form = f.form and w.voided_at is null
          and w.cert_date >= v_prev and w.cert_date < (v_prev + interval '1 month')::date
      ) t on true
      where coalesce(t.tax, 0) <> 0), '[]'::jsonb);
  end loop;

  return jsonb_build_object('months', v_months, 'cash', v_cash, 'receivables', v_ar, 'payables', v_ap,
    'aging', v_aging, 'taxes', v_taxes, 'tax_month', to_char(v_prev, 'YYYY-MM'), 'today', v_today,
    'company_count', cardinality(v_ids));
end;
$$;

revoke execute on function public.dashboard_full from public, anon;
grant execute on function public.dashboard_full to authenticated;
