-- M4 (part 4): posting engine.
--
--   private.build_journal(company, doc jsonb)          ← all posting rules (spec §2 + docs/DECISIONS.md)
--   private.build_payment_journal(company, pay jsonb)  ← receipts / payments
--        ▲                         ▲
--   public.simulate_posting()   public.post_document() / post_payment()
--   (read-only preview)         (writes journal, number, audit)
--
-- Errors: errcode P0001 + UPPER_SNAKE message (translated in the UI as dbErrors.*).

create type private.jline as (
  ord int,
  account_id uuid,
  role text,          -- account_role used (null when the account came from a line/product)
  side char(1),       -- 'D' / 'C'
  amount numeric(18, 2),
  source text         -- total | line | vat | vat_deferred | wht | payment | vat_transfer | returns
);

-- ---------------------------------------------------------------------------
-- Line math (spec §2: half-up rounding per line; docs/DECISIONS.md)
-- ---------------------------------------------------------------------------
create or replace function public.calc_line(
  p_qty numeric,
  p_unit_price numeric,
  p_discount numeric,
  p_vat_mode public.vat_mode,
  p_vat_rate numeric,       -- effective rate for this line (0 when none/zero/exempt)
  p_wht_rate numeric,
  out base_amount numeric(18, 2),
  out vat_amount numeric(18, 2),
  out wht_amount numeric(18, 2)
)
language plpgsql
immutable
as $$
declare
  v_gross numeric(18, 2) := round(coalesce(p_qty, 0) * coalesce(p_unit_price, 0), 2) - coalesce(p_discount, 0);
begin
  if v_gross < 0 then
    raise exception 'LINE_NEGATIVE' using errcode = 'P0001';
  end if;
  if p_vat_mode = 'none' or coalesce(p_vat_rate, 0) = 0 then
    base_amount := v_gross;
    vat_amount := 0.00;
  elsif p_vat_mode = 'inclusive' then
    vat_amount := round(v_gross * p_vat_rate / (100 + p_vat_rate), 2);
    base_amount := v_gross - vat_amount;
  else
    base_amount := v_gross;
    vat_amount := round(v_gross * p_vat_rate / 100, 2);
  end if;
  wht_amount := round(base_amount * coalesce(p_wht_rate, 0) / 100, 2);
end;
$$;

create or replace function private.role_account(p_company_id uuid, p_role public.account_role)
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  select account_id into v_id from public.account_mappings
  where company_id = p_company_id and role = p_role;
  if v_id is null then
    raise exception 'MAPPING_MISSING' using errcode = 'P0001', detail = p_role::text;
  end if;
  return v_id;
end;
$$;

-- Outstanding amount and remaining deferred VAT of a receivable/payable document.
--   invoice / bill:  total − posted credit notes referencing it − posted allocations
--   debit_note:      total − posted allocations
create or replace function private.doc_balance(
  p_document_id uuid,
  out outstanding numeric(18, 2),
  out deferred_remaining numeric(18, 2),
  out paid numeric(18, 2)
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_doc public.documents;
  v_cn_total numeric := 0;
  v_cn_deferred numeric := 0;
begin
  select * into v_doc from public.documents where id = p_document_id;
  select coalesce(sum(a.amount), 0), coalesce(sum(a.vat_transferred), 0)
    into paid, deferred_remaining
  from public.payment_allocations a
  join public.payments p on p.id = a.payment_id
  where a.document_id = p_document_id and p.status = 'posted';

  select coalesce(sum(n.total), 0), coalesce(sum(n.vat_deferred_total), 0)
    into v_cn_total, v_cn_deferred
  from public.documents n
  where n.ref_document_id = p_document_id and n.type = 'credit_note' and n.status = 'posted';

  outstanding := v_doc.total - v_cn_total - paid;
  -- deferred_remaining currently holds "transferred so far"
  deferred_remaining := v_doc.vat_deferred_total - v_cn_deferred - deferred_remaining;
end;
$$;

-- ---------------------------------------------------------------------------
-- build_journal: document → journal lines (pure; reads master data only)
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

    v_line_out := v_line_out || jsonb_build_object(
      'base_amount', c.base_amount, 'vat_amount', c.vat_amount, 'wht_amount', c.wht_amount,
      'item_kind', v_kind);

    v_subtotal := v_subtotal + c.base_amount;
    v_wht := v_wht + c.wht_amount;
    if v_kind = 'service' then
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
      c.base_amount, case when v_type = 'credit_note' then 'returns' else 'line' end)::private.jline;
  end loop;

  v_total := v_subtotal + v_vat_goods + v_vat_service;
  v_net := v_total - v_wht;

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
      'vat_total', v_vat_goods + v_vat_service,
      'vat_deferred_total', case when v_service_vat_role in ('OUTPUT_VAT_DEFERRED', 'INPUT_VAT_DEFERRED')
                                 then v_vat_service else 0 end,
      'total', v_total,
      'wht_total', v_wht,
      'net_total', v_net));
end;
$$;

-- ---------------------------------------------------------------------------
-- build_payment_journal: receipt / payment → journal lines
-- payload: { direction, pay_date, contact_id, payment_account_id, amount, wht_amount,
--            allocations: [{document_id, amount, wht_amount}] }
-- ---------------------------------------------------------------------------
create or replace function private.build_payment_journal(p_company_id uuid, p_pay jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_dir public.payment_direction := (p_pay ->> 'direction')::public.payment_direction;
  v_amount numeric(18, 2) := coalesce((p_pay ->> 'amount')::numeric, 0);
  v_wht numeric(18, 2) := coalesce((p_pay ->> 'wht_amount')::numeric, 0);
  v_contact uuid := nullif(p_pay ->> 'contact_id', '')::uuid;
  v_acc public.accounts;
  v_lines private.jline[] := '{}';
  v_alloc_out jsonb := '[]';
  a jsonb;
  v_doc public.documents;
  v_bal record;
  v_alloc numeric(18, 2);
  v_alloc_sum numeric(18, 2) := 0;
  v_transfer numeric(18, 2);
  v_transfer_sum numeric(18, 2) := 0;
  v_result jsonb;
begin
  if v_dir is null then
    raise exception 'PAYMENT_DIRECTION_REQUIRED' using errcode = 'P0001';
  end if;
  if v_contact is null then
    raise exception 'CONTACT_REQUIRED' using errcode = 'P0001';
  end if;
  select * into v_acc from public.accounts
  where id = nullif(p_pay ->> 'payment_account_id', '')::uuid and company_id = p_company_id;
  if v_acc.id is null or v_acc.type <> 'asset' then
    raise exception 'PAYMENT_ACCOUNT_REQUIRED' using errcode = 'P0001';
  end if;
  if jsonb_array_length(coalesce(p_pay -> 'allocations', '[]')) = 0 then
    raise exception 'PAYMENT_NO_ALLOCATIONS' using errcode = 'P0001';
  end if;

  for a in select value from jsonb_array_elements(p_pay -> 'allocations')
  loop
    v_alloc := (a ->> 'amount')::numeric;
    if v_alloc is null or v_alloc <= 0 then
      raise exception 'ALLOCATION_AMOUNT_INVALID' using errcode = 'P0001';
    end if;
    select * into v_doc from public.documents
    where id = (a ->> 'document_id')::uuid and company_id = p_company_id;
    if v_doc.id is null or v_doc.status <> 'posted'
       or (v_dir = 'received' and v_doc.type not in ('invoice', 'debit_note'))
       or (v_dir = 'paid' and v_doc.type <> 'bill') then
      raise exception 'ALLOCATION_DOCUMENT_INVALID' using errcode = 'P0001';
    end if;
    if v_doc.contact_id is distinct from v_contact then
      raise exception 'ALLOCATION_CONTACT_MISMATCH' using errcode = 'P0001';
    end if;
    select * into v_bal from private.doc_balance(v_doc.id);
    if v_alloc > v_bal.outstanding then
      raise exception 'ALLOCATION_EXCEEDS_OUTSTANDING' using errcode = 'P0001',
        detail = format('%s > %s', v_alloc, v_bal.outstanding);
    end if;

    -- Deferred VAT realised in proportion to what is settled; the final settlement takes the rest.
    if v_bal.deferred_remaining <= 0 then
      v_transfer := 0;
    elsif v_alloc = v_bal.outstanding then
      v_transfer := v_bal.deferred_remaining;
    else
      v_transfer := round(v_bal.deferred_remaining * v_alloc / v_bal.outstanding, 2);
    end if;

    v_alloc_sum := v_alloc_sum + v_alloc;
    v_transfer_sum := v_transfer_sum + v_transfer;
    v_alloc_out := v_alloc_out || jsonb_build_object(
      'document_id', v_doc.id, 'amount', v_alloc,
      'wht_amount', coalesce((a ->> 'wht_amount')::numeric, 0), 'vat_transferred', v_transfer);
  end loop;

  if v_alloc_sum <> v_amount + v_wht then
    raise exception 'PAYMENT_NOT_ALLOCATED' using errcode = 'P0001',
      detail = format('allocated %s, amount + wht %s', v_alloc_sum, v_amount + v_wht);
  end if;

  if v_dir = 'received' then
    v_lines := array[
      row(1, v_acc.id, null, 'D', v_amount, 'payment')::private.jline,
      row(2, case when v_wht > 0 then private.role_account(p_company_id, 'WHT_RECEIVABLE') end,
          'WHT_RECEIVABLE', 'D', v_wht, 'wht')::private.jline,
      row(3, case when v_transfer_sum > 0 then private.role_account(p_company_id, 'OUTPUT_VAT_DEFERRED') end,
          'OUTPUT_VAT_DEFERRED', 'D', v_transfer_sum, 'vat_transfer')::private.jline,
      row(4, private.role_account(p_company_id, 'AR'), 'AR', 'C', v_alloc_sum, 'total')::private.jline,
      row(5, case when v_transfer_sum > 0 then private.role_account(p_company_id, 'OUTPUT_VAT') end,
          'OUTPUT_VAT', 'C', v_transfer_sum, 'vat_transfer')::private.jline];
  else
    v_lines := array[
      row(1, private.role_account(p_company_id, 'AP'), 'AP', 'D', v_alloc_sum, 'total')::private.jline,
      row(2, case when v_transfer_sum > 0 then private.role_account(p_company_id, 'INPUT_VAT') end,
          'INPUT_VAT', 'D', v_transfer_sum, 'vat_transfer')::private.jline,
      row(3, v_acc.id, null, 'C', v_amount, 'payment')::private.jline,
      row(4, case when v_wht > 0 then private.role_account(p_company_id, 'WHT_PAYABLE') end,
          'WHT_PAYABLE', 'C', v_wht, 'wht')::private.jline,
      row(5, case when v_transfer_sum > 0 then private.role_account(p_company_id, 'INPUT_VAT_DEFERRED') end,
          'INPUT_VAT_DEFERRED', 'C', v_transfer_sum, 'vat_transfer')::private.jline];
  end if;

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

  return jsonb_build_object('lines', v_result, 'allocations', v_alloc_out,
    'totals', jsonb_build_object('amount', v_amount, 'wht_amount', v_wht,
                                 'allocated', v_alloc_sum, 'vat_transferred', v_transfer_sum));
end;
$$;

-- ---------------------------------------------------------------------------
-- Document numbers: companies.doc_number_settings ->> series
--   { "prefix": "INV", "reset": "yearly" | "monthly", "digits": 4, "era": "CE" | "BE" }
-- ---------------------------------------------------------------------------
create or replace function private.next_number(p_company_id uuid, p_series text, p_date date)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_settings jsonb;
  v_prefix text;
  v_reset text;
  v_digits int;
  v_year int;
  v_period text;
  v_n int;
begin
  select doc_number_settings -> p_series into v_settings from public.companies where id = p_company_id;
  v_prefix := coalesce(v_settings ->> 'prefix', case p_series
    when 'quotation' then 'QT' when 'invoice' then 'INV' when 'cash_sale' then 'CS'
    when 'credit_note' then 'CN' when 'debit_note' then 'DN' when 'purchase_order' then 'PO'
    when 'bill' then 'EXP' when 'cash_purchase' then 'CP'
    when 'payment_received' then 'RV' when 'payment_paid' then 'PV' else upper(p_series) end);
  v_reset := coalesce(v_settings ->> 'reset', 'yearly');
  v_digits := coalesce((v_settings ->> 'digits')::int, 4);
  v_year := extract(year from p_date)::int + case when v_settings ->> 'era' = 'BE' then 543 else 0 end;
  v_period := case when v_reset = 'monthly'
                   then v_year::text || to_char(p_date, 'MM')
                   else v_year::text end;

  insert into public.doc_sequences (company_id, series, period_key, last_number)
  values (p_company_id, p_series, v_period, 0)
  on conflict do nothing;

  -- Row lock: concurrent posts in the same series wait; a rolled-back post releases its number.
  update public.doc_sequences set last_number = last_number + 1
  where company_id = p_company_id and series = p_series and period_key = v_period
  returning last_number into v_n;

  return v_prefix || '-' || v_period || '-' || lpad(v_n::text, v_digits, '0');
end;
$$;

-- ---------------------------------------------------------------------------
-- Stored document → payload used by build_journal (same shape the UI sends to simulate)
-- ---------------------------------------------------------------------------
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
    'ref_document_id', d.ref_document_id,
    'lines', coalesce((
      select jsonb_agg(jsonb_build_object(
        'product_id', l.product_id, 'description', l.description, 'item_kind', l.item_kind,
        'qty', l.qty, 'unit_price', l.unit_price, 'discount', l.discount, 'vat_type', l.vat_type,
        'wht_rate', l.wht_rate, 'account_id', l.account_id) order by l.line_no)
      from public.document_lines l where l.document_id = d.id), '[]'::jsonb))
  from public.documents d where d.id = p_document_id;
$$;

create or replace function private.payment_payload(p_payment_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'direction', p.direction, 'pay_date', p.pay_date, 'contact_id', p.contact_id,
    'payment_account_id', p.payment_account_id, 'amount', p.amount, 'wht_amount', p.wht_amount,
    'allocations', coalesce((
      select jsonb_agg(jsonb_build_object('document_id', a.document_id, 'amount', a.amount,
                                          'wht_amount', a.wht_amount) order by a.id)
      from public.payment_allocations a where a.payment_id = p.id), '[]'::jsonb))
  from public.payments p where p.id = p_payment_id;
$$;

-- Write journal entry + lines from a build result
create or replace function private.write_journal(
  p_company_id uuid, p_date date, p_document_id uuid, p_payment_id uuid,
  p_description text, p_contact_id uuid, p_lines jsonb, p_reverses uuid default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_entry uuid;
begin
  insert into public.journal_entries (company_id, entry_date, document_id, payment_id, description, reverses_entry_id)
  values (p_company_id, p_date, p_document_id, p_payment_id, p_description, p_reverses)
  returning id into v_entry;

  insert into public.journal_lines (company_id, entry_id, line_no, account_id, debit, credit, contact_id)
  select p_company_id, v_entry, row_number() over (), (x ->> 'account_id')::uuid,
         (x ->> 'debit')::numeric, (x ->> 'credit')::numeric, p_contact_id
  from jsonb_array_elements(p_lines) x;
  return v_entry;
end;
$$;

-- ---------------------------------------------------------------------------
-- Public RPCs
-- ---------------------------------------------------------------------------

-- Save (create or replace) a DRAFT document with its lines; the engine computes all amounts.
-- payload = build_journal payload + { id?, company_id, due_date, reference, notes, source }
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

  if v_id is null then
    insert into public.documents (company_id, type, doc_date, due_date, contact_id, vat_mode, vat_rate,
      payment_account_id, ref_document_id, reference, notes, source)
    values (v_company, (p_doc ->> 'type')::public.document_type,
      coalesce((p_doc ->> 'doc_date')::date, (now() at time zone 'Asia/Bangkok')::date),
      (p_doc ->> 'due_date')::date, nullif(p_doc ->> 'contact_id', '')::uuid,
      coalesce((p_doc ->> 'vat_mode')::public.vat_mode, 'exclusive'), (p_doc ->> 'vat_rate')::numeric,
      nullif(p_doc ->> 'payment_account_id', '')::uuid, nullif(p_doc ->> 'ref_document_id', '')::uuid,
      p_doc ->> 'reference', p_doc ->> 'notes',
      coalesce((p_doc ->> 'source')::public.document_source, 'manual'))
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
      notes = p_doc ->> 'notes'
    where id = v_id;
    delete from public.document_lines where document_id = v_id;
  end if;

  insert into public.document_lines (company_id, document_id, line_no, product_id, description, item_kind,
    qty, unit_price, discount, vat_type, wht_rate, account_id, base_amount, vat_amount, wht_amount)
  select v_company, v_id, x.ord::int, nullif(x.l ->> 'product_id', '')::uuid, coalesce(x.l ->> 'description', ''),
    (cc.c ->> 'item_kind')::public.product_kind,
    coalesce((x.l ->> 'qty')::numeric, 1), coalesce((x.l ->> 'unit_price')::numeric, 0),
    coalesce((x.l ->> 'discount')::numeric, 0),
    coalesce((x.l ->> 'vat_type')::public.product_vat_type, 'standard'),
    coalesce((x.l ->> 'wht_rate')::numeric, 0), nullif(x.l ->> 'account_id', '')::uuid,
    (cc.c ->> 'base_amount')::numeric, (cc.c ->> 'vat_amount')::numeric, (cc.c ->> 'wht_amount')::numeric
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

-- Post a draft: number + journal + audit, all in one transaction (spec M4).
create or replace function public.post_document(p_document_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_doc public.documents;
  v_built jsonb;
  v_number text;
  v_entry uuid;
begin
  select * into v_doc from public.documents where id = p_document_id for update;
  if v_doc.id is null or not private.is_member(v_doc.company_id) then
    raise exception 'DOCUMENT_NOT_FOUND' using errcode = 'P0001';
  end if;
  if not private.has_role(v_doc.company_id, '{owner,admin,accountant,staff}') then
    raise exception 'permission denied' using errcode = '42501';
  end if;
  if v_doc.status <> 'draft' then
    raise exception 'DOCUMENT_NOT_DRAFT' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.document_lines where document_id = v_doc.id) then
    raise exception 'DOCUMENT_NO_LINES' using errcode = 'P0001';
  end if;
  if v_doc.type in ('invoice', 'credit_note', 'debit_note', 'bill') and v_doc.contact_id is null then
    raise exception 'CONTACT_REQUIRED' using errcode = 'P0001';
  end if;

  v_built := private.build_journal(v_doc.company_id, private.document_payload(v_doc.id));
  if v_doc.type not in ('quotation', 'purchase_order')
     and (v_built #>> '{totals,total}')::numeric <= 0 then
    raise exception 'DOCUMENT_ZERO_TOTAL' using errcode = 'P0001';
  end if;

  v_number := private.next_number(v_doc.company_id, v_doc.type::text, v_doc.doc_date);

  perform set_config('app.engine', 'on', true);

  update public.document_lines l set
    item_kind = (c.v ->> 'item_kind')::public.product_kind,
    base_amount = (c.v ->> 'base_amount')::numeric,
    vat_amount = (c.v ->> 'vat_amount')::numeric,
    wht_amount = (c.v ->> 'wht_amount')::numeric
  from (
    select rn, v
    from jsonb_array_elements(v_built -> 'line_amounts') with ordinality as e(v, rn)
  ) c,
  (select id, row_number() over (order by line_no) as rn from public.document_lines where document_id = v_doc.id) o
  where o.id = l.id and o.rn = c.rn;

  update public.documents set
    status = 'posted',
    number = v_number,
    subtotal = (v_built #>> '{totals,subtotal}')::numeric,
    vat_total = (v_built #>> '{totals,vat_total}')::numeric,
    vat_deferred_total = (v_built #>> '{totals,vat_deferred_total}')::numeric,
    total = (v_built #>> '{totals,total}')::numeric,
    wht_total = (v_built #>> '{totals,wht_total}')::numeric,
    net_total = (v_built #>> '{totals,net_total}')::numeric,
    posted_at = now(),
    posted_by = auth.uid()
  where id = v_doc.id;

  if jsonb_array_length(v_built -> 'lines') > 0 then
    v_entry := private.write_journal(v_doc.company_id, v_doc.doc_date, v_doc.id, null,
      v_number, v_doc.contact_id, v_built -> 'lines');
  end if;

  perform set_config('app.engine', 'off', true);
  return jsonb_build_object('number', v_number, 'entry_id', v_entry);
end;
$$;

-- Void a posted document: reversing entry dated on the original date (D3).
create or replace function public.void_document(p_document_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_doc public.documents;
  v_entry uuid;
begin
  select * into v_doc from public.documents where id = p_document_id for update;
  if v_doc.id is null or not private.is_member(v_doc.company_id) then
    raise exception 'DOCUMENT_NOT_FOUND' using errcode = 'P0001';
  end if;
  if not private.has_role(v_doc.company_id, '{owner,admin,accountant}') then
    raise exception 'permission denied' using errcode = '42501';
  end if;
  if v_doc.status <> 'posted' then
    raise exception 'DOCUMENT_NOT_POSTED' using errcode = 'P0001';
  end if;
  if nullif(trim(p_reason), '') is null then
    raise exception 'VOID_REASON_REQUIRED' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.payment_allocations a join public.payments p on p.id = a.payment_id
             where a.document_id = v_doc.id and p.status = 'posted') then
    raise exception 'DOCUMENT_HAS_PAYMENTS' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.documents n
             where n.ref_document_id = v_doc.id and n.status = 'posted'
               and n.type in ('credit_note', 'debit_note')) then
    raise exception 'DOCUMENT_HAS_NOTES' using errcode = 'P0001';
  end if;

  perform set_config('app.engine', 'on', true);
  for v_entry in
    select id from public.journal_entries where document_id = v_doc.id and reverses_entry_id is null
  loop
    perform private.write_journal(v_doc.company_id, v_doc.doc_date, v_doc.id, null,
      'VOID ' || v_doc.number, v_doc.contact_id,
      (select jsonb_agg(jsonb_build_object('account_id', account_id, 'debit', credit, 'credit', debit)
                        order by line_no)
       from public.journal_lines where entry_id = v_entry),
      v_entry);
  end loop;

  update public.documents set status = 'voided', voided_at = now(), voided_by = auth.uid(),
    void_reason = trim(p_reason)
  where id = v_doc.id;
  perform set_config('app.engine', 'off', true);
end;
$$;

-- Save a draft payment with its allocations.
create or replace function public.save_payment(p_pay jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_company uuid := (p_pay ->> 'company_id')::uuid;
  v_id uuid := nullif(p_pay ->> 'id', '')::uuid;
  v_status public.document_status;
begin
  if not private.has_role(v_company, '{owner,admin,accountant,staff}') then
    raise exception 'permission denied' using errcode = '42501';
  end if;
  if v_id is null then
    insert into public.payments (company_id, direction, pay_date, contact_id, payment_account_id,
      amount, wht_amount, reference, notes)
    values (v_company, (p_pay ->> 'direction')::public.payment_direction,
      coalesce((p_pay ->> 'pay_date')::date, (now() at time zone 'Asia/Bangkok')::date),
      (p_pay ->> 'contact_id')::uuid, (p_pay ->> 'payment_account_id')::uuid,
      coalesce((p_pay ->> 'amount')::numeric, 0), coalesce((p_pay ->> 'wht_amount')::numeric, 0),
      p_pay ->> 'reference', p_pay ->> 'notes')
    returning id into v_id;
  else
    select status into v_status from public.payments where id = v_id and company_id = v_company for update;
    if v_status is null then
      raise exception 'DOCUMENT_NOT_FOUND' using errcode = 'P0001';
    end if;
    if v_status <> 'draft' then
      raise exception 'DOCUMENT_NOT_DRAFT' using errcode = 'P0001';
    end if;
    update public.payments set
      pay_date = coalesce((p_pay ->> 'pay_date')::date, pay_date),
      contact_id = (p_pay ->> 'contact_id')::uuid,
      payment_account_id = (p_pay ->> 'payment_account_id')::uuid,
      amount = coalesce((p_pay ->> 'amount')::numeric, 0),
      wht_amount = coalesce((p_pay ->> 'wht_amount')::numeric, 0),
      reference = p_pay ->> 'reference',
      notes = p_pay ->> 'notes'
    where id = v_id;
    delete from public.payment_allocations where payment_id = v_id;
  end if;

  insert into public.payment_allocations (company_id, payment_id, document_id, amount, wht_amount)
  select v_company, v_id, (a ->> 'document_id')::uuid, (a ->> 'amount')::numeric,
         coalesce((a ->> 'wht_amount')::numeric, 0)
  from jsonb_array_elements(coalesce(p_pay -> 'allocations', '[]')) a;
  return v_id;
end;
$$;

create or replace function public.post_payment(p_payment_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pay public.payments;
  v_built jsonb;
  v_number text;
  v_entry uuid;
begin
  select * into v_pay from public.payments where id = p_payment_id for update;
  if v_pay.id is null or not private.is_member(v_pay.company_id) then
    raise exception 'DOCUMENT_NOT_FOUND' using errcode = 'P0001';
  end if;
  if not private.has_role(v_pay.company_id, '{owner,admin,accountant,staff}') then
    raise exception 'permission denied' using errcode = '42501';
  end if;
  if v_pay.status <> 'draft' then
    raise exception 'DOCUMENT_NOT_DRAFT' using errcode = 'P0001';
  end if;
  -- Lock the documents being settled so two payments cannot over-allocate concurrently
  perform 1 from public.documents d
  where d.id in (select document_id from public.payment_allocations where payment_id = v_pay.id)
  order by d.id for update;

  v_built := private.build_payment_journal(v_pay.company_id, private.payment_payload(v_pay.id));
  v_number := private.next_number(v_pay.company_id, 'payment_' || v_pay.direction::text, v_pay.pay_date);

  perform set_config('app.engine', 'on', true);
  update public.payment_allocations a set vat_transferred = (x ->> 'vat_transferred')::numeric
  from jsonb_array_elements(v_built -> 'allocations') x
  where a.payment_id = v_pay.id and a.document_id = (x ->> 'document_id')::uuid;

  update public.payments set status = 'posted', number = v_number, posted_at = now(), posted_by = auth.uid()
  where id = v_pay.id;

  v_entry := private.write_journal(v_pay.company_id, v_pay.pay_date, null, v_pay.id,
    v_number, v_pay.contact_id, v_built -> 'lines');
  perform set_config('app.engine', 'off', true);
  return jsonb_build_object('number', v_number, 'entry_id', v_entry);
end;
$$;

create or replace function public.void_payment(p_payment_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pay public.payments;
  v_entry uuid;
begin
  select * into v_pay from public.payments where id = p_payment_id for update;
  if v_pay.id is null or not private.is_member(v_pay.company_id) then
    raise exception 'DOCUMENT_NOT_FOUND' using errcode = 'P0001';
  end if;
  if not private.has_role(v_pay.company_id, '{owner,admin,accountant}') then
    raise exception 'permission denied' using errcode = '42501';
  end if;
  if v_pay.status <> 'posted' then
    raise exception 'DOCUMENT_NOT_POSTED' using errcode = 'P0001';
  end if;
  if nullif(trim(p_reason), '') is null then
    raise exception 'VOID_REASON_REQUIRED' using errcode = 'P0001';
  end if;

  perform set_config('app.engine', 'on', true);
  select id into v_entry from public.journal_entries where payment_id = v_pay.id and reverses_entry_id is null;
  perform private.write_journal(v_pay.company_id, v_pay.pay_date, null, v_pay.id,
    'VOID ' || v_pay.number, v_pay.contact_id,
    (select jsonb_agg(jsonb_build_object('account_id', account_id, 'debit', credit, 'credit', debit)
                      order by line_no)
     from public.journal_lines where entry_id = v_entry),
    v_entry);
  update public.payments set status = 'voided', voided_at = now(), voided_by = auth.uid(),
    void_reason = trim(p_reason)
  where id = v_pay.id;
  perform set_config('app.engine', 'off', true);
end;
$$;

-- ---------------------------------------------------------------------------
-- simulate_posting: live preview for forms (docs/DESIGN_SIMULATION.md). Never writes.
--   p_kind = 'document' | 'payment'; p_payload = same shape as save_document / save_payment.
--   Returns { ok, lines: [{account_id, code, name_th, name_en, type, role, debit, credit,
--             sources, opening_balance}], totals } or { ok: false, error, detail }.
-- ---------------------------------------------------------------------------
create or replace function public.simulate_posting(p_kind text, p_payload jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_company uuid := (p_payload ->> 'company_id')::uuid;
  v_built jsonb;
  v_date date;
  v_err text;
  v_detail text;
  v_lines jsonb;
begin
  if v_company is null or not private.is_member(v_company) then
    raise exception 'permission denied' using errcode = '42501';
  end if;

  begin
    if p_kind = 'payment' then
      v_built := private.build_payment_journal(v_company, p_payload);
      v_date := coalesce((p_payload ->> 'pay_date')::date, (now() at time zone 'Asia/Bangkok')::date);
    else
      p_payload := p_payload || jsonb_build_object('vat_rate', coalesce((p_payload ->> 'vat_rate')::numeric,
        (select vat_rate from public.companies where id = v_company)));
      v_built := private.build_journal(v_company, p_payload);
      v_date := coalesce((p_payload ->> 'doc_date')::date, (now() at time zone 'Asia/Bangkok')::date);
    end if;
  exception when sqlstate 'P0001' then
    get stacked diagnostics v_err = message_text, v_detail = pg_exception_detail;
    return jsonb_build_object('ok', false, 'error', v_err, 'detail', v_detail);
  end;

  select coalesce(jsonb_agg(x || jsonb_build_object(
      'code', a.code, 'name_th', a.name_th, 'name_en', a.name_en, 'type', a.type,
      'opening_balance', coalesce((
        select sum(jl.debit - jl.credit) from public.journal_lines jl
        join public.journal_entries je on je.id = jl.entry_id
        where jl.account_id = a.id and je.entry_date <= v_date), 0))
      order by ord), '[]'::jsonb)
    into v_lines
  from jsonb_array_elements(v_built -> 'lines') with ordinality as t(x, ord)
  join public.accounts a on a.id = (x ->> 'account_id')::uuid;

  return jsonb_build_object('ok', true, 'lines', v_lines, 'totals', v_built -> 'totals',
    'line_amounts', v_built -> 'line_amounts', 'allocations', v_built -> 'allocations');
end;
$$;

-- Outstanding balance for UI lists (receivables/payables)
create or replace function public.document_balance(p_document_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_company uuid;
  b record;
begin
  select company_id into v_company from public.documents where id = p_document_id;
  if v_company is null or not private.is_member(v_company) then
    raise exception 'DOCUMENT_NOT_FOUND' using errcode = 'P0001';
  end if;
  select * into b from private.doc_balance(p_document_id);
  return jsonb_build_object('outstanding', b.outstanding, 'paid', b.paid,
                            'deferred_vat_remaining', b.deferred_remaining);
end;
$$;

-- Audit membership changes too
create trigger company_members_audit after insert or update or delete on public.company_members
  for each row execute function private.audit();

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
revoke execute on function public.save_document, public.post_document, public.void_document,
  public.save_payment, public.post_payment, public.void_payment, public.simulate_posting,
  public.document_balance from public, anon;
grant execute on function public.save_document, public.post_document, public.void_document,
  public.save_payment, public.post_payment, public.void_payment, public.simulate_posting,
  public.document_balance, public.calc_line to authenticated;
revoke execute on function private.build_journal, private.build_payment_journal, private.next_number,
  private.document_payload, private.payment_payload, private.write_journal, private.role_account,
  private.doc_balance from public, anon, authenticated;
