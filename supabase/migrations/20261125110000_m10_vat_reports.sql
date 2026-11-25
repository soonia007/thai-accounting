-- M10 VAT reports (Phase 2) — additive only (spec Phase 2 §0.2):
--   * D11: purchase VAT that cannot be claimed, flagged per line → booked into the line's cost
--     instead of input VAT (default: claimable = the old behaviour, so existing data is unchanged)
--   * D12: the vendor's tax invoice number/date and the month the input VAT is claimed in
--     (tax-invoice month … +6 months, Revenue Code s.82/3) on purchases and on payments that
--     realise deferred service VAT (D2)
--   * D13: monthly PP.30 filings recorded with the refund / carry-forward choice
--   * read-only reports: output VAT, input VAT, PP.30 summary — computed from the ledger
--     (OUTPUT_VAT / INPUT_VAT accounts), so the tax point follows the posting rules (D1, D2, D5)

alter table public.document_lines add column vat_claimable boolean not null default true;

alter table public.documents
  add column tax_invoice_no text,
  add column tax_invoice_date date,
  add column vat_claim_month date
    check (vat_claim_month is null or extract(day from vat_claim_month) = 1);
alter table public.payments
  add column tax_invoice_no text,
  add column tax_invoice_date date,
  add column vat_claim_month date
    check (vat_claim_month is null or extract(day from vat_claim_month) = 1);

-- Claim month must be the first day of a month from the tax-invoice month up to 6 months later.
create or replace function private.check_vat_claim_month(p_invoice_date date, p_month date)
returns void
language plpgsql
immutable
as $$
declare
  v_first date := date_trunc('month', p_invoice_date)::date;
begin
  if p_month is null then
    return;
  end if;
  if extract(day from p_month) <> 1 or p_month < v_first
     or p_month > (v_first + interval '6 months')::date then
    raise exception 'VAT_CLAIM_MONTH_INVALID' using errcode = 'P0001';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Posting engine (D11) — same as M6 except the claimable flag
-- ---------------------------------------------------------------------------
create or replace function private.build_journal(p_company_id uuid, p_doc jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_company public.companies;
  v_type public.document_type := (p_doc ->> 'type')::public.document_type;
  v_vat_mode public.vat_mode := coalesce((p_doc ->> 'vat_mode')::public.vat_mode, 'exclusive');
  v_vat_rate numeric;
  v_is_sale boolean;
  v_lines private.jline[] := '{}';
  v_line_out jsonb := '[]';
  l jsonb;
  c record;
  v_rate numeric;
  v_kind public.product_kind;
  v_product public.products;
  v_acc public.accounts;
  v_acc_id uuid;
  v_role public.account_role;
  v_subtotal numeric(18, 2) := 0;
  v_vat_goods numeric(18, 2) := 0;
  v_vat_service numeric(18, 2) := 0;
  v_wht numeric(18, 2) := 0;
  v_total numeric(18, 2);
  v_net numeric(18, 2);
  v_service_vat_role public.account_role;
  v_ref public.documents;
  v_bal record;
  v_ord int := 0;
  v_payment_acc public.accounts;
  v_result jsonb;
  v_cond public.wht_condition := coalesce((p_doc ->> 'wht_condition')::public.wht_condition, 'withhold');
  v_line_wht numeric(18, 2);
  v_claim boolean;
  v_vat_nonclaim numeric(18, 2) := 0;
begin
  select * into v_company from public.companies where id = p_company_id;
  if v_company.id is null then
    raise exception 'COMPANY_NOT_FOUND' using errcode = 'P0001';
  end if;
  if v_type is null then
    raise exception 'DOCUMENT_TYPE_REQUIRED' using errcode = 'P0001';
  end if;

  -- Companies that are not VAT registered never charge VAT (spec §2)
  if not v_company.vat_registered then
    v_vat_mode := 'none';
  end if;
  v_vat_rate := coalesce((p_doc ->> 'vat_rate')::numeric, v_company.vat_rate);
  v_is_sale := v_type in ('quotation', 'invoice', 'cash_sale', 'credit_note', 'debit_note');
  -- D8: the payer can bear the tax only on what we pay
  if v_is_sale and v_cond <> 'withhold' then
    raise exception 'WHT_CONDITION_INVALID' using errcode = 'P0001';
  end if;

  -- ---- lines ---------------------------------------------------------------
  for l in select value from jsonb_array_elements(coalesce(p_doc -> 'lines', '[]'::jsonb))
  loop
    v_product := null;
    if nullif(l ->> 'product_id', '') is not null then
      select * into v_product from public.products
      where id = (l ->> 'product_id')::uuid and company_id = p_company_id;
      if v_product.id is null then
        raise exception 'PRODUCT_NOT_FOUND' using errcode = 'P0001';
      end if;
    end if;
    v_kind := coalesce((l ->> 'item_kind')::public.product_kind, v_product.kind, 'service');
    v_rate := case
      when v_vat_mode = 'none' then 0
      when coalesce((l ->> 'vat_type')::public.product_vat_type, v_product.vat_type, 'standard') <> 'standard' then 0
      else v_vat_rate
    end;

    select * into c from public.calc_line(
      (l ->> 'qty')::numeric, (l ->> 'unit_price')::numeric, (l ->> 'discount')::numeric,
      v_vat_mode, v_rate, (l ->> 'wht_rate')::numeric);
    v_line_wht := public.wht_tax(c.base_amount, (l ->> 'wht_rate')::numeric, v_cond);

    -- D6: purchases need an income type for the 50 ทวิ certificate
    if not v_is_sale and coalesce((l ->> 'wht_rate')::numeric, 0) > 0 then
      if nullif(l ->> 'wht_income_type', '') is null then
        raise exception 'WHT_INCOME_TYPE_REQUIRED' using errcode = 'P0001';
      end if;
      if not exists (select 1 from public.wht_income_types where code = l ->> 'wht_income_type') then
        raise exception 'WHT_INCOME_TYPE_INVALID' using errcode = 'P0001';
      end if;
    end if;

    -- D11: purchase VAT that cannot be claimed (per line) becomes part of the line's cost
    v_claim := v_is_sale or coalesce((l ->> 'vat_claimable')::boolean, true);
    v_line_out := v_line_out || jsonb_build_object(
      'base_amount', c.base_amount, 'vat_amount', c.vat_amount, 'wht_amount', v_line_wht,
      'item_kind', v_kind, 'vat_claimable', v_claim);

    v_subtotal := v_subtotal + c.base_amount;
    v_wht := v_wht + v_line_wht;
    if not v_claim then
      v_vat_nonclaim := v_vat_nonclaim + c.vat_amount;
    elsif v_kind = 'service' then
      v_vat_service := v_vat_service + c.vat_amount;
    else
      v_vat_goods := v_vat_goods + c.vat_amount;
    end if;

    -- revenue / expense account for this line
    if v_type in ('quotation', 'purchase_order') or c.base_amount = 0 then
      continue;
    end if;
    v_role := null;
    if v_type = 'credit_note' then
      v_role := 'SALES_RETURNS';                                   -- D4
      v_acc_id := private.role_account(p_company_id, v_role);
    else
      v_acc_id := coalesce(
        nullif(l ->> 'account_id', '')::uuid,
        case when v_is_sale then v_product.income_account_id else v_product.expense_account_id end);
      if v_acc_id is null then
        v_role := case when v_is_sale then 'SALES_REVENUE' else 'DEFAULT_EXPENSE' end;
        v_acc_id := private.role_account(p_company_id, v_role);
      else
        select * into v_acc from public.accounts where id = v_acc_id and company_id = p_company_id;
        if v_acc.id is null
           or (v_is_sale and v_acc.type <> 'revenue')
           or (not v_is_sale and v_acc.type not in ('expense', 'asset')) then
          raise exception 'LINE_ACCOUNT_TYPE' using errcode = 'P0001';
        end if;
      end if;
    end if;
    v_ord := v_ord + 1;
    v_lines := v_lines || row(v_ord, v_acc_id, v_role::text,
      case when v_is_sale and v_type <> 'credit_note' then 'C' else 'D' end,
      c.base_amount + case when v_claim then 0 else c.vat_amount end,
      case when v_type = 'credit_note' then 'returns' else 'line' end)::private.jline;
  end loop;

  v_total := v_subtotal + v_vat_goods + v_vat_service + v_vat_nonclaim;
  -- D8: when the payer bears the tax the payee receives the full amount
  v_net := v_total - case when v_cond = 'withhold' then v_wht else 0 end;

  -- ---- which VAT account takes service VAT (D1, D2, D5) ---------------------
  v_service_vat_role := null;
  if v_type in ('invoice') then
    v_service_vat_role := 'OUTPUT_VAT_DEFERRED';
  elsif v_type = 'bill' then
    v_service_vat_role := 'INPUT_VAT_DEFERRED';
  elsif v_type in ('cash_sale') then
    v_service_vat_role := 'OUTPUT_VAT';
  elsif v_type in ('cash_purchase') then
    v_service_vat_role := 'INPUT_VAT';
  elsif v_type in ('credit_note', 'debit_note') then
    if nullif(p_doc ->> 'ref_document_id', '') is null then
      raise exception 'NOTE_REF_REQUIRED' using errcode = 'P0001';
    end if;
    select * into v_ref from public.documents
    where id = (p_doc ->> 'ref_document_id')::uuid and company_id = p_company_id;
    if v_ref.id is null or v_ref.status <> 'posted' or v_ref.type not in ('invoice', 'debit_note') then
      raise exception 'NOTE_REF_INVALID' using errcode = 'P0001';
    end if;
    if nullif(p_doc ->> 'contact_id', '') is not null
       and (p_doc ->> 'contact_id')::uuid is distinct from v_ref.contact_id then
      raise exception 'NOTE_CONTACT_MISMATCH' using errcode = 'P0001';
    end if;
    select * into v_bal from private.doc_balance(v_ref.id);
    -- outstanding + paid = invoice total − earlier credit notes
    if v_type = 'credit_note' and v_total > v_bal.outstanding + v_bal.paid then
      raise exception 'CREDIT_NOTE_EXCEEDS' using errcode = 'P0001';
    end if;
    if v_vat_service > 0 then
      if v_bal.paid = 0 then
        v_service_vat_role := 'OUTPUT_VAT_DEFERRED';          -- D5: unpaid
      elsif v_bal.outstanding <= 0 then
        v_service_vat_role := 'OUTPUT_VAT';                   -- D5: fully paid
      else
        raise exception 'NOTE_REF_PARTIALLY_PAID' using errcode = 'P0001';
      end if;
    else
      v_service_vat_role := 'OUTPUT_VAT';
    end if;
  end if;

  -- ---- header-side lines ----------------------------------------------------
  if v_type in ('invoice', 'debit_note') then
    v_lines := row(0, private.role_account(p_company_id, 'AR'), 'AR', 'D', v_total, 'total')::private.jline || v_lines;
    v_lines := v_lines
      || row(900, case when v_vat_goods > 0 then private.role_account(p_company_id, 'OUTPUT_VAT') end,
             'OUTPUT_VAT', 'C', v_vat_goods, 'vat')::private.jline
      || row(901, case when v_vat_service > 0 then private.role_account(p_company_id, v_service_vat_role) end,
             v_service_vat_role::text, 'C', v_vat_service,
             case when v_service_vat_role = 'OUTPUT_VAT_DEFERRED' then 'vat_deferred' else 'vat' end)::private.jline;

  elsif v_type = 'credit_note' then
    v_lines := v_lines
      || row(900, case when v_vat_goods > 0 then private.role_account(p_company_id, 'OUTPUT_VAT') end,
             'OUTPUT_VAT', 'D', v_vat_goods, 'vat')::private.jline
      || row(901, case when v_vat_service > 0 then private.role_account(p_company_id, v_service_vat_role) end,
             v_service_vat_role::text, 'D', v_vat_service,
             case when v_service_vat_role = 'OUTPUT_VAT_DEFERRED' then 'vat_deferred' else 'vat' end)::private.jline
      || row(999, private.role_account(p_company_id, 'AR'), 'AR', 'C', v_total, 'total')::private.jline;

  elsif v_type = 'cash_sale' then
    select * into v_payment_acc from public.accounts
    where id = nullif(p_doc ->> 'payment_account_id', '')::uuid and company_id = p_company_id;
    if v_payment_acc.id is null or v_payment_acc.type <> 'asset' then
      raise exception 'PAYMENT_ACCOUNT_REQUIRED' using errcode = 'P0001';
    end if;
    v_lines := array[
        row(0, v_payment_acc.id, null, 'D', v_net, 'payment')::private.jline,
        row(1, case when v_wht > 0 then private.role_account(p_company_id, 'WHT_RECEIVABLE') end,
            'WHT_RECEIVABLE', 'D', v_wht, 'wht')::private.jline]
      || v_lines
      || row(900, case when v_vat_goods + v_vat_service > 0 then private.role_account(p_company_id, 'OUTPUT_VAT') end,
             'OUTPUT_VAT', 'C', v_vat_goods + v_vat_service, 'vat')::private.jline;

  elsif v_type = 'bill' then
    v_lines := v_lines
      || row(900, case when v_vat_goods > 0 then private.role_account(p_company_id, 'INPUT_VAT') end,
             'INPUT_VAT', 'D', v_vat_goods, 'vat')::private.jline
      || row(901, case when v_vat_service > 0 then private.role_account(p_company_id, 'INPUT_VAT_DEFERRED') end,
             'INPUT_VAT_DEFERRED', 'D', v_vat_service, 'vat_deferred')::private.jline
      || row(999, private.role_account(p_company_id, 'AP'), 'AP', 'C', v_total, 'total')::private.jline;

  elsif v_type = 'cash_purchase' then
    select * into v_payment_acc from public.accounts
    where id = nullif(p_doc ->> 'payment_account_id', '')::uuid and company_id = p_company_id;
    if v_payment_acc.id is null or v_payment_acc.type <> 'asset' then
      raise exception 'PAYMENT_ACCOUNT_REQUIRED' using errcode = 'P0001';
    end if;
    v_lines := v_lines
      || row(900, case when v_vat_goods + v_vat_service > 0 then private.role_account(p_company_id, 'INPUT_VAT') end,
             'INPUT_VAT', 'D', v_vat_goods + v_vat_service, 'vat')::private.jline
      || row(998, v_payment_acc.id, null, 'C', v_net, 'payment')::private.jline
      || row(950, case when v_wht > 0 and v_cond <> 'withhold'
                       then private.role_account(p_company_id, 'WHT_BORNE_EXPENSE') end,
             'WHT_BORNE_EXPENSE', 'D', case when v_cond <> 'withhold' then v_wht else 0 end, 'wht')::private.jline
      || row(999, case when v_wht > 0 then private.role_account(p_company_id, 'WHT_PAYABLE') end,
             'WHT_PAYABLE', 'C', v_wht, 'wht')::private.jline;
  end if;

  -- ---- aggregate per account & side, debits first ---------------------------
  select coalesce(jsonb_agg(jsonb_build_object(
           'account_id', account_id, 'role', role, 'debit', case when side = 'D' then amount else 0 end,
           'credit', case when side = 'C' then amount else 0 end, 'sources', sources)
         order by side desc, first_ord), '[]'::jsonb)
    into v_result
  from (
    select account_id, side, min(role) as role, sum(amount) as amount, min(ord) as first_ord,
           jsonb_agg(distinct source) as sources
    from unnest(v_lines) x
    where amount <> 0 and account_id is not null
    group by account_id, side
  ) g;

  return jsonb_build_object(
    'lines', v_result,
    'line_amounts', v_line_out,
    'totals', jsonb_build_object(
      'subtotal', v_subtotal,
      'vat_total', v_vat_goods + v_vat_service + v_vat_nonclaim,
      'vat_deferred_total', case when v_service_vat_role in ('OUTPUT_VAT_DEFERRED', 'INPUT_VAT_DEFERRED')
                                 then v_vat_service else 0 end,
      'total', v_total,
      'wht_total', v_wht,
      'net_total', v_net));
end;
$$;

create or replace function private.document_payload(p_document_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'type', d.type, 'doc_date', d.doc_date, 'contact_id', d.contact_id, 'vat_mode', d.vat_mode,
    'vat_rate', d.vat_rate, 'payment_account_id', d.payment_account_id,
    'ref_document_id', d.ref_document_id, 'wht_condition', d.wht_condition,
    'lines', coalesce((
      select jsonb_agg(jsonb_build_object(
        'product_id', l.product_id, 'description', l.description, 'item_kind', l.item_kind,
        'qty', l.qty, 'unit_price', l.unit_price, 'discount', l.discount, 'vat_type', l.vat_type,
        'wht_rate', l.wht_rate, 'wht_income_type', l.wht_income_type, 'account_id', l.account_id,
        'vat_claimable', l.vat_claimable) order by l.line_no)
      from public.document_lines l where l.document_id = d.id), '[]'::jsonb))
  from public.documents d where d.id = p_document_id;
$$;

create or replace function public.save_document(p_doc jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_company uuid := (p_doc ->> 'company_id')::uuid;
  v_id uuid := nullif(p_doc ->> 'id', '')::uuid;
  v_status public.document_status;
  v_built jsonb;
  v_vat_rate numeric;
  v_purchase boolean := (p_doc ->> 'type') in ('bill', 'cash_purchase');
  v_ti_no text;
  v_ti_date date;
  v_claim_month date;
begin
  if not private.has_role(v_company, '{owner,admin,accountant,staff}') then
    raise exception 'permission denied' using errcode = '42501';
  end if;
  select vat_rate into v_vat_rate from public.companies where id = v_company;
  p_doc := p_doc || jsonb_build_object('vat_rate', coalesce((p_doc ->> 'vat_rate')::numeric, v_vat_rate));

  -- Notes are validated against their reference only when posting; skip here.
  if (p_doc ->> 'type') in ('credit_note', 'debit_note') then
    v_built := private.build_journal(v_company,
      (p_doc - 'ref_document_id') || jsonb_build_object('type', 'invoice'));
  else
    v_built := private.build_journal(v_company, p_doc);
  end if;

  -- M10: the vendor's tax invoice (purchases only) and the month the input VAT is claimed in
  if v_purchase then
    v_ti_no := nullif(trim(p_doc ->> 'tax_invoice_no'), '');
    v_ti_date := nullif(p_doc ->> 'tax_invoice_date', '')::date;
    v_claim_month := nullif(p_doc ->> 'vat_claim_month', '')::date;
    perform private.check_vat_claim_month(
      coalesce(v_ti_date, (p_doc ->> 'doc_date')::date, (now() at time zone 'Asia/Bangkok')::date), v_claim_month);
  end if;

  if v_id is null then
    insert into public.documents (company_id, type, doc_date, due_date, contact_id, vat_mode, vat_rate,
      payment_account_id, ref_document_id, reference, notes, source, wht_condition,
      tax_invoice_no, tax_invoice_date, vat_claim_month)
    values (v_company, (p_doc ->> 'type')::public.document_type,
      coalesce((p_doc ->> 'doc_date')::date, (now() at time zone 'Asia/Bangkok')::date),
      (p_doc ->> 'due_date')::date, nullif(p_doc ->> 'contact_id', '')::uuid,
      coalesce((p_doc ->> 'vat_mode')::public.vat_mode, 'exclusive'), (p_doc ->> 'vat_rate')::numeric,
      nullif(p_doc ->> 'payment_account_id', '')::uuid, nullif(p_doc ->> 'ref_document_id', '')::uuid,
      p_doc ->> 'reference', p_doc ->> 'notes',
      coalesce((p_doc ->> 'source')::public.document_source, 'manual'),
      coalesce((p_doc ->> 'wht_condition')::public.wht_condition, 'withhold'),
      v_ti_no, v_ti_date, v_claim_month)
    returning id into v_id;
  else
    select status into v_status from public.documents where id = v_id and company_id = v_company for update;
    if v_status is null then
      raise exception 'DOCUMENT_NOT_FOUND' using errcode = 'P0001';
    end if;
    if v_status <> 'draft' then
      raise exception 'DOCUMENT_NOT_DRAFT' using errcode = 'P0001';
    end if;
    update public.documents set
      doc_date = coalesce((p_doc ->> 'doc_date')::date, doc_date),
      due_date = (p_doc ->> 'due_date')::date,
      contact_id = nullif(p_doc ->> 'contact_id', '')::uuid,
      vat_mode = coalesce((p_doc ->> 'vat_mode')::public.vat_mode, vat_mode),
      vat_rate = (p_doc ->> 'vat_rate')::numeric,
      payment_account_id = nullif(p_doc ->> 'payment_account_id', '')::uuid,
      ref_document_id = nullif(p_doc ->> 'ref_document_id', '')::uuid,
      reference = p_doc ->> 'reference',
      notes = p_doc ->> 'notes',
      wht_condition = coalesce((p_doc ->> 'wht_condition')::public.wht_condition, 'withhold'),
      tax_invoice_no = v_ti_no,
      tax_invoice_date = v_ti_date,
      vat_claim_month = v_claim_month
    where id = v_id;
    delete from public.document_lines where document_id = v_id;
  end if;

  insert into public.document_lines (company_id, document_id, line_no, product_id, description, item_kind,
    qty, unit_price, discount, vat_type, wht_rate, wht_income_type, account_id, base_amount, vat_amount, wht_amount,
    vat_claimable)
  select v_company, v_id, x.ord::int, nullif(x.l ->> 'product_id', '')::uuid, coalesce(x.l ->> 'description', ''),
    (cc.c ->> 'item_kind')::public.product_kind,
    coalesce((x.l ->> 'qty')::numeric, 1), coalesce((x.l ->> 'unit_price')::numeric, 0),
    coalesce((x.l ->> 'discount')::numeric, 0),
    coalesce((x.l ->> 'vat_type')::public.product_vat_type, 'standard'),
    coalesce((x.l ->> 'wht_rate')::numeric, 0), nullif(x.l ->> 'wht_income_type', ''),
    nullif(x.l ->> 'account_id', '')::uuid,
    (cc.c ->> 'base_amount')::numeric, (cc.c ->> 'vat_amount')::numeric, (cc.c ->> 'wht_amount')::numeric,
    coalesce((cc.c ->> 'vat_claimable')::boolean, true)
  from jsonb_array_elements(coalesce(p_doc -> 'lines', '[]')) with ordinality as x(l, ord)
  cross join lateral (select v_built -> 'line_amounts' -> (x.ord::int - 1) as c) cc;

  update public.documents set
    subtotal = (v_built #>> '{totals,subtotal}')::numeric,
    vat_total = (v_built #>> '{totals,vat_total}')::numeric,
    vat_deferred_total = 0,  -- final split is decided when posting
    total = (v_built #>> '{totals,total}')::numeric,
    wht_total = (v_built #>> '{totals,wht_total}')::numeric,
    net_total = (v_built #>> '{totals,net_total}')::numeric
  where id = v_id;

  return v_id;
end;
$$;


-- ---------------------------------------------------------------------------
-- PP.30 filings (D13)
-- ---------------------------------------------------------------------------
create table public.vat_returns (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  month date not null check (extract(day from month) = 1),
  output_vat numeric(18, 2) not null,
  input_vat numeric(18, 2) not null,
  carried_in numeric(18, 2) not null default 0 check (carried_in >= 0),
  -- > 0 tax to pay, < 0 tax overpaid this month (after the carried-in credit)
  net numeric(18, 2) not null,
  excess_choice text check (excess_choice in ('refund', 'carry')),
  summary jsonb not null,
  filed_at timestamptz not null default now(),
  filed_by uuid references auth.users (id) on delete set null default auth.uid(),
  unique (company_id, month),
  check ((net < 0) = (excess_choice is not null))
);

create trigger vat_returns_audit after insert or update or delete on public.vat_returns
  for each row execute function private.audit();

alter table public.vat_returns enable row level security;
revoke all on public.vat_returns from anon;
revoke insert, update, delete on public.vat_returns from authenticated;
create policy vat_returns_select on public.vat_returns for select to authenticated
  using (private.is_member(company_id));

create or replace function private.vat_month_filed(p_company_id uuid, p_month date)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.vat_returns where company_id = p_company_id and month = p_month);
$$;

-- ---------------------------------------------------------------------------
-- Vendor tax invoice / claim month on a purchase document or a payment, also after posting
-- (they do not change the ledger). Not into or out of a month whose PP.30 is filed.
-- ---------------------------------------------------------------------------
create or replace function public.set_vat_claim(
  p_document_id uuid, p_payment_id uuid, p_tax_invoice_no text, p_tax_invoice_date date,
  p_claim_month date)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_company uuid;
  v_base_date date;
  v_old_month date;
  v_new_month date;
  v_status public.document_status;
begin
  if (p_document_id is null) = (p_payment_id is null) then
    raise exception 'VAT_CLAIM_TARGET' using errcode = 'P0001';
  end if;
  if p_document_id is not null then
    select company_id, status, doc_date,
           coalesce(vat_claim_month, date_trunc('month', coalesce(tax_invoice_date, doc_date))::date)
      into v_company, v_status, v_base_date, v_old_month
    from public.documents where id = p_document_id and type in ('bill', 'cash_purchase');
  else
    select company_id, status, pay_date,
           coalesce(vat_claim_month, date_trunc('month', coalesce(tax_invoice_date, pay_date))::date)
      into v_company, v_status, v_base_date, v_old_month
    from public.payments where id = p_payment_id and direction = 'paid';
  end if;
  if v_company is null then
    raise exception 'VAT_CLAIM_TARGET' using errcode = 'P0001';
  end if;
  if not private.has_role(v_company, '{owner,admin,accountant,staff}') then
    raise exception 'permission denied' using errcode = '42501';
  end if;
  if v_status = 'voided' then
    raise exception 'DOCUMENT_VOIDED' using errcode = 'P0001';
  end if;
  perform private.check_vat_claim_month(coalesce(p_tax_invoice_date, v_base_date), p_claim_month);
  v_new_month := coalesce(p_claim_month, date_trunc('month', coalesce(p_tax_invoice_date, v_base_date))::date);
  if v_status = 'posted' and (private.vat_month_filed(v_company, v_old_month)
                              or private.vat_month_filed(v_company, v_new_month)) then
    raise exception 'VAT_MONTH_FILED' using errcode = 'P0001';
  end if;

  perform set_config('app.engine', 'on', true);
  if p_document_id is not null then
    update public.documents set tax_invoice_no = nullif(trim(p_tax_invoice_no), ''),
      tax_invoice_date = p_tax_invoice_date, vat_claim_month = p_claim_month
    where id = p_document_id;
  else
    update public.payments set tax_invoice_no = nullif(trim(p_tax_invoice_no), ''),
      tax_invoice_date = p_tax_invoice_date, vat_claim_month = p_claim_month
    where id = p_payment_id;
  end if;
  perform set_config('app.engine', 'off', true);
end;
$$;

-- ---------------------------------------------------------------------------
-- Reports
-- ---------------------------------------------------------------------------
create or replace function private.vat_report_scope(p_company_id uuid, p_month date)
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
  if p_month is null or extract(day from p_month) <> 1 then
    raise exception 'REPORT_PERIOD_INVALID' using errcode = 'P0001';
  end if;
end;
$$;

-- One row per source document / payment whose VAT hits the role's account. Base: documents →
-- the VAT-bearing (claimable) lines' base in proportion to the VAT on this account (exact
-- unless goods and services are mixed); payments → VAT ÷ rate.
create or replace function private.vat_rows(p_company_id uuid, p_role public.account_role)
returns table (
  document_id uuid, payment_id uuid, vat numeric, base numeric, entry_date date)
language sql
stable
security definer
set search_path = ''
as $$
  with v as (
    select e.document_id, e.payment_id, min(e.entry_date) as entry_date,
           sum(case when p_role = 'OUTPUT_VAT' then l.credit - l.debit else l.debit - l.credit end) as vat
    from public.journal_lines l
    join public.journal_entries e on e.id = l.entry_id
    where l.company_id = p_company_id
      and l.account_id = (select account_id from public.account_mappings
                          where company_id = p_company_id and role = p_role)
      and (e.document_id is not null or e.payment_id is not null)
    group by e.document_id, e.payment_id
    having sum(l.credit - l.debit) <> 0
  )
  select v.document_id, v.payment_id, v.vat,
         case
           when v.document_id is not null then (
             select case when coalesce(sum(dl.vat_amount), 0) = 0 then round(v.vat * 100 / nullif(d.vat_rate, 0), 2)
                         else round(sum(dl.base_amount) * abs(v.vat) / sum(dl.vat_amount), 2) * sign(v.vat) end
             from public.documents d
             left join public.document_lines dl
               on dl.document_id = d.id and dl.vat_amount > 0 and dl.vat_claimable
             where d.id = v.document_id group by d.vat_rate)
           else (
             select round(v.vat * 100 / nullif(max(d.vat_rate), 0), 2)
             from public.payment_allocations a join public.documents d on d.id = a.document_id
             where a.payment_id = v.payment_id)
         end as base,
         v.entry_date
  from v;
$$;

create or replace function public.report_vat_sales(p_company_id uuid, p_month date)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.vat_report_scope(p_company_id, p_month);
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'date', x.date, 'number', x.number, 'contact', c.name, 'tax_id', c.tax_id,
             'branch', c.branch_code, 'base', r.base, 'vat', r.vat,
             'kind', case when r.document_id is not null then 'document' else 'payment' end,
             'source_id', coalesce(r.document_id, r.payment_id))
           order by x.date, x.number)
    from private.vat_rows(p_company_id, 'OUTPUT_VAT') r
    left join public.documents d on d.id = r.document_id
    left join public.payments p on p.id = r.payment_id
    cross join lateral (select coalesce(d.doc_date, p.pay_date) as date,
                               coalesce(d.number, p.number) as number,
                               coalesce(d.contact_id, p.contact_id) as contact_id) x
    left join public.contacts c on c.id = x.contact_id
    where r.entry_date >= p_month and r.entry_date < (p_month + interval '1 month')::date
  ), '[]'::jsonb);
end;
$$;

create or replace function public.report_vat_purchases(p_company_id uuid, p_month date)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.vat_report_scope(p_company_id, p_month);
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'date', x.date, 'number', x.number, 'our_number', x.our_number,
             'contact', c.name, 'tax_id', c.tax_id, 'branch', c.branch_code,
             'base', r.base, 'vat', r.vat, 'late', x.claim_month > date_trunc('month', x.date)::date,
             'kind', case when r.document_id is not null then 'document' else 'payment' end,
             'source_id', coalesce(r.document_id, r.payment_id))
           order by x.date, x.number)
    from private.vat_rows(p_company_id, 'INPUT_VAT') r
    left join public.documents d on d.id = r.document_id
    left join public.payments p on p.id = r.payment_id
    cross join lateral (
      select coalesce(d.tax_invoice_date, p.tax_invoice_date, d.doc_date, p.pay_date) as date,
             coalesce(d.tax_invoice_no, p.tax_invoice_no, d.reference, p.reference, d.number, p.number) as number,
             coalesce(d.number, p.number) as our_number,
             coalesce(d.contact_id, p.contact_id) as contact_id,
             coalesce(d.vat_claim_month, p.vat_claim_month,
                      date_trunc('month', coalesce(d.tax_invoice_date, p.tax_invoice_date, d.doc_date, p.pay_date))::date)
               as claim_month) x
    left join public.contacts c on c.id = x.contact_id
    where x.claim_month = p_month
  ), '[]'::jsonb);
end;
$$;

-- PP.30 summary (draft to help filing). Uses the filed snapshot when the month is filed.
create or replace function public.vat_return_summary(p_company_id uuid, p_month date)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_sales jsonb := public.report_vat_sales(p_company_id, p_month);
  v_purch jsonb := public.report_vat_purchases(p_company_id, p_month);
  v_out numeric(18, 2);
  v_taxable numeric(18, 2);
  v_in numeric(18, 2);
  v_purch_base numeric(18, 2);
  v_zero numeric(18, 2);
  v_exempt numeric(18, 2);
  v_prev public.vat_returns;
  v_filed public.vat_returns;
  v_carried numeric(18, 2) := 0;
  v_net numeric(18, 2);
  v_has_earlier boolean;
begin
  select coalesce(sum((r ->> 'vat')::numeric), 0), coalesce(sum((r ->> 'base')::numeric), 0)
    into v_out, v_taxable from jsonb_array_elements(v_sales) r;
  select coalesce(sum((r ->> 'vat')::numeric), 0), coalesce(sum((r ->> 'base')::numeric), 0)
    into v_in, v_purch_base from jsonb_array_elements(v_purch) r;

  -- zero-rated / exempt sales by document date (credit notes reduce them)
  select coalesce(sum(case when l.vat_type = 'zero' then l.base_amount * s.sign else 0 end), 0),
         coalesce(sum(case when l.vat_type = 'exempt' then l.base_amount * s.sign else 0 end), 0)
    into v_zero, v_exempt
  from public.documents d
  join public.document_lines l on l.document_id = d.id
  cross join lateral (select case when d.type = 'credit_note' then -1 else 1 end as sign) s
  where d.company_id = p_company_id and d.status = 'posted'
    and d.type in ('invoice', 'cash_sale', 'debit_note', 'credit_note')
    and d.doc_date >= p_month and d.doc_date < (p_month + interval '1 month')::date;

  select * into v_filed from public.vat_returns where company_id = p_company_id and month = p_month;
  select * into v_prev from public.vat_returns
  where company_id = p_company_id and month = (p_month - interval '1 month')::date;
  select exists (select 1 from public.vat_returns where company_id = p_company_id and month < p_month)
    into v_has_earlier;
  if v_prev.id is not null and v_prev.excess_choice = 'carry' then
    v_carried := -v_prev.net;
  end if;
  if v_filed.id is not null then
    v_carried := v_filed.carried_in;
  end if;
  v_net := v_out - v_in - v_carried;

  return jsonb_build_object(
    'month', p_month,
    'sales_total', v_taxable + v_zero + v_exempt,
    'zero_rated', v_zero,
    'exempt', v_exempt,
    'taxable_sales', v_taxable,
    'output_vat', v_out,
    'purchase_base', v_purch_base,
    'input_vat', v_in,
    'carried_in', v_carried,
    'net', v_net,
    'previous_filed', v_prev.id is not null,
    'has_earlier_filing', v_has_earlier,
    'filing', case when v_filed.id is null then null else jsonb_build_object(
      'filed_at', v_filed.filed_at, 'excess_choice', v_filed.excess_choice, 'net', v_filed.net,
      'output_vat', v_filed.output_vat, 'input_vat', v_filed.input_vat,
      'carried_in', v_filed.carried_in) end);
end;
$$;

-- Record that the PP.30 for a month was filed. p_carried_in only for the very first filing
-- (credit brought from before the company used the app); later months take it from the
-- previous filing's carry-forward.
create or replace function public.file_vat_return(
  p_company_id uuid, p_month date, p_excess_choice text default null,
  p_carried_in numeric default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sum jsonb;
  v_net numeric(18, 2);
  v_carried numeric(18, 2);
  v_today date := (now() at time zone 'Asia/Bangkok')::date;
begin
  if not private.has_role(p_company_id, '{owner,admin,accountant}') then
    raise exception 'permission denied' using errcode = '42501';
  end if;
  perform private.vat_report_scope(p_company_id, p_month);
  if p_month > date_trunc('month', v_today)::date then
    raise exception 'VAT_MONTH_IN_FUTURE' using errcode = 'P0001';
  end if;
  if private.vat_month_filed(p_company_id, p_month) then
    raise exception 'VAT_MONTH_FILED' using errcode = 'P0001';
  end if;
  v_sum := public.vat_return_summary(p_company_id, p_month);
  if (v_sum ->> 'has_earlier_filing')::boolean and not (v_sum ->> 'previous_filed')::boolean then
    raise exception 'VAT_PREVIOUS_MONTH_NOT_FILED' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.vat_returns where company_id = p_company_id and month > p_month) then
    raise exception 'VAT_LATER_MONTH_FILED' using errcode = 'P0001';
  end if;
  v_carried := (v_sum ->> 'carried_in')::numeric;
  if p_carried_in is not null then
    if (v_sum ->> 'has_earlier_filing')::boolean or p_carried_in < 0 then
      raise exception 'VAT_CARRIED_IN_INVALID' using errcode = 'P0001';
    end if;
    v_carried := round(p_carried_in, 2);
  end if;
  v_net := (v_sum ->> 'output_vat')::numeric - (v_sum ->> 'input_vat')::numeric - v_carried;
  if v_net < 0 and coalesce(p_excess_choice, '') not in ('refund', 'carry') then
    raise exception 'VAT_EXCESS_CHOICE_REQUIRED' using errcode = 'P0001';
  end if;

  insert into public.vat_returns (company_id, month, output_vat, input_vat, carried_in, net,
    excess_choice, summary)
  values (p_company_id, p_month, (v_sum ->> 'output_vat')::numeric, (v_sum ->> 'input_vat')::numeric,
    v_carried, v_net, case when v_net < 0 then p_excess_choice end,
    v_sum || jsonb_build_object('carried_in', v_carried, 'net', v_net));
end;
$$;

-- Undo the latest filing (owner/admin) — e.g. a correction before the actual submission.
create or replace function public.unfile_vat_return(p_company_id uuid, p_month date)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.has_role(p_company_id, '{owner,admin}') then
    raise exception 'permission denied' using errcode = '42501';
  end if;
  if exists (select 1 from public.vat_returns where company_id = p_company_id and month > p_month) then
    raise exception 'VAT_LATER_MONTH_FILED' using errcode = 'P0001';
  end if;
  delete from public.vat_returns where company_id = p_company_id and month = p_month;
end;
$$;

revoke execute on function public.set_vat_claim, public.report_vat_sales, public.report_vat_purchases,
  public.vat_return_summary, public.file_vat_return, public.unfile_vat_return from public, anon;
grant execute on function public.set_vat_claim, public.report_vat_sales, public.report_vat_purchases,
  public.vat_return_summary, public.file_vat_return, public.unfile_vat_return to authenticated;
revoke execute on function private.vat_rows, private.vat_month_filed, private.vat_report_scope,
  private.check_vat_claim_month from public, anon;
