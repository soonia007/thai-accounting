-- M11 withholding-tax reports — additive only:
--   * PND.3 / PND.53 monthly (attachment lines + summary by income type) from the 50 ทวิ
--     certificates issued in M6 (D6, D7, D8); voided certificates are excluded
--   * register of issued 50 ทวิ
--   * D14: register of 50 ทวิ received (customers withheld tax from us) from the ledger
--     (WHT_RECEIVABLE), with the customer's certificate number / date entered on the receipt
--     or cash sale (editable after posting — it does not change the books)
--   * e-filing text file: not built yet (format to be supplied by the owner)

alter table public.payments
  add column received_wht_cert_no text,
  add column received_wht_cert_date date;
alter table public.documents
  add column received_wht_cert_no text,
  add column received_wht_cert_date date;

create or replace function private.wht_report_scope(p_company_id uuid, p_from date, p_to date)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.is_member(p_company_id) then
    raise exception 'permission denied' using errcode = '42501';
  end if;
  if p_from is null or p_to is null or p_from > p_to then
    raise exception 'REPORT_PERIOD_INVALID' using errcode = 'P0001';
  end if;
end;
$$;

-- One row per certificate line (income type) for a PND form — the attachment (ใบแนบ).
create or replace function public.report_wht_pnd(
  p_company_id uuid, p_from date, p_to date, p_form public.wht_form)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.wht_report_scope(p_company_id, p_from, p_to);
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'cert_id', w.id, 'cert_number', w.number, 'date', w.cert_date,
             'contact', c.name, 'tax_id', c.tax_id, 'branch', c.branch_code, 'address', c.address,
             'income_type', l.income_type, 'income_name_th', t.name_th, 'income_name_en', t.name_en,
             'section', t.section, 'rate', l.wht_rate, 'income', l.income_amount, 'tax', l.tax_amount,
             'condition', w.condition)
           order by w.cert_date, w.number, l.line_no)
    from public.wht_certificates w
    join public.wht_certificate_lines l on l.certificate_id = w.id
    join public.wht_income_types t on t.code = l.income_type
    join public.contacts c on c.id = w.contact_id
    where w.company_id = p_company_id and w.form = p_form and w.voided_at is null
      and w.cert_date between p_from and p_to
  ), '[]'::jsonb);
end;
$$;

-- Register of issued certificates (voided ones listed and flagged).
create or replace function public.report_wht_certificates(p_company_id uuid, p_from date, p_to date)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.wht_report_scope(p_company_id, p_from, p_to);
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', w.id, 'number', w.number, 'date', w.cert_date, 'form', w.form,
             'contact', c.name, 'tax_id', c.tax_id, 'income', w.total_income, 'tax', w.total_tax,
             'voided', w.voided_at is not null)
           order by w.cert_date, w.number)
    from public.wht_certificates w
    join public.contacts c on c.id = w.contact_id
    where w.company_id = p_company_id and w.cert_date between p_from and p_to
  ), '[]'::jsonb);
end;
$$;

-- Register of tax withheld from us: one row per receipt / cash sale whose WHT hit the
-- WHT_RECEIVABLE account in the period (voids net to zero and drop out). Income = the
-- withholding lines' base (in proportion for partial receipts).
create or replace function public.report_wht_received(p_company_id uuid, p_from date, p_to date)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.wht_report_scope(p_company_id, p_from, p_to);
  return coalesce((
    with v as (
      select e.document_id, e.payment_id, min(e.entry_date) as entry_date, sum(l.debit - l.credit) as tax
      from public.journal_lines l
      join public.journal_entries e on e.id = l.entry_id
      where l.company_id = p_company_id
        and l.account_id = (select account_id from public.account_mappings
                            where company_id = p_company_id and role = 'WHT_RECEIVABLE')
        and (e.document_id is not null or e.payment_id is not null)
      group by e.document_id, e.payment_id
      having sum(l.debit - l.credit) <> 0
    )
    select jsonb_agg(jsonb_build_object(
             'kind', case when v.document_id is not null then 'document' else 'payment' end,
             'source_id', coalesce(v.document_id, v.payment_id),
             'date', v.entry_date, 'number', coalesce(d.number, p.number),
             'contact', c.name, 'tax_id', c.tax_id, 'tax', v.tax,
             'income', case
               when v.document_id is not null then (
                 select coalesce(sum(dl.base_amount), 0) from public.document_lines dl
                 where dl.document_id = v.document_id and dl.wht_rate > 0)
               else (
                 select coalesce(sum(round(
                   (select coalesce(sum(dl.base_amount), 0) from public.document_lines dl
                    where dl.document_id = a.document_id and dl.wht_rate > 0)
                   * a.wht_amount / nullif(ad.wht_total, 0), 2)), 0)
                 from public.payment_allocations a
                 join public.documents ad on ad.id = a.document_id
                 where a.payment_id = v.payment_id and a.wht_amount > 0)
             end,
             'cert_no', coalesce(d.received_wht_cert_no, p.received_wht_cert_no),
             'cert_date', coalesce(d.received_wht_cert_date, p.received_wht_cert_date))
           order by v.entry_date, coalesce(d.number, p.number))
    from v
    left join public.documents d on d.id = v.document_id
    left join public.payments p on p.id = v.payment_id
    left join public.contacts c on c.id = coalesce(d.contact_id, p.contact_id)
    where v.entry_date between p_from and p_to
  ), '[]'::jsonb);
end;
$$;

-- The customer's 50 ทวิ for tax they withheld from us (on a receipt or a cash sale).
create or replace function public.set_received_wht_cert(
  p_document_id uuid, p_payment_id uuid, p_cert_no text, p_cert_date date)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_company uuid;
  v_status public.document_status;
begin
  if (p_document_id is null) = (p_payment_id is null) then
    raise exception 'WHT_CERT_TARGET' using errcode = 'P0001';
  end if;
  if p_document_id is not null then
    select company_id, status into v_company, v_status from public.documents
    where id = p_document_id and type = 'cash_sale' and wht_total > 0;
  else
    select company_id, status into v_company, v_status from public.payments
    where id = p_payment_id and direction = 'received' and wht_amount > 0;
  end if;
  if v_company is null then
    raise exception 'WHT_CERT_TARGET' using errcode = 'P0001';
  end if;
  if not private.has_role(v_company, '{owner,admin,accountant,staff}') then
    raise exception 'permission denied' using errcode = '42501';
  end if;
  if v_status = 'voided' then
    raise exception 'DOCUMENT_VOIDED' using errcode = 'P0001';
  end if;

  perform set_config('app.engine', 'on', true);
  if p_document_id is not null then
    update public.documents set received_wht_cert_no = nullif(trim(p_cert_no), ''),
      received_wht_cert_date = p_cert_date where id = p_document_id;
  else
    update public.payments set received_wht_cert_no = nullif(trim(p_cert_no), ''),
      received_wht_cert_date = p_cert_date where id = p_payment_id;
  end if;
  perform set_config('app.engine', 'off', true);
end;
$$;

revoke execute on function public.report_wht_pnd, public.report_wht_certificates,
  public.report_wht_received, public.set_received_wht_cert from public, anon;
grant execute on function public.report_wht_pnd, public.report_wht_certificates,
  public.report_wht_received, public.set_received_wht_cert to authenticated;
revoke execute on function private.wht_report_scope from public, anon;
