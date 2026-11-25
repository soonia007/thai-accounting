-- M6: purchases — WHT income types (D6), withholding certificates 50 ทวิ (D7),
-- payer-borne tax (D8), attachments.

-- ---------------------------------------------------------------------------
-- New account: income tax borne for payees (D8)
-- ---------------------------------------------------------------------------
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
    when 'DEFAULT_EXPENSE' then 'expense'
    when 'WHT_BORNE_EXPENSE' then 'expense'
  end::public.account_type;
$$;

insert into public.account_templates
  (business_type, code, name_th, name_en, type, parent_code, is_group, mapping_role, sort_order)
select b.bt, '5285', 'ภาษีเงินได้ออกแทนผู้รับ', 'Income tax borne for payees', 'expense', '5200', false,
       'WHT_BORNE_EXPENSE', 535
from (select unnest(enum_range(null::public.business_type)) as bt) b
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
    where t.mapping_role = 'WHT_BORNE_EXPENSE'
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
-- WHT income types (D6) — reference data shared by all companies.
-- form_row = row on the 50 ทวิ form; default_rate is a suggestion (editable per line).
-- ---------------------------------------------------------------------------
create table public.wht_income_types (
  code text primary key,
  name_th text not null,
  name_en text not null,
  section text not null,          -- มาตรา 40(...)
  form_row text not null,         -- 1, 2, 3, 4a, 4b, 5, 6
  default_rate numeric(5, 2),
  sort_order int not null
);
alter table public.wht_income_types enable row level security;
create policy wht_income_types_select on public.wht_income_types for select to authenticated using (true);
revoke all on public.wht_income_types from anon;
revoke insert, update, delete on public.wht_income_types from authenticated;

insert into public.wht_income_types (code, name_th, name_en, section, form_row, default_rate, sort_order) values
  ('service',       'ค่าบริการ',                         'Service fees',                 '40(8)',    '5', 3,    10),
  ('professional',  'ค่าวิชาชีพอิสระ',                   'Professional fees',            '40(6)',    '5', 3,    20),
  ('contract_work', 'ค่าจ้างทำของ',                      'Contract work',                '40(7)',    '5', 3,    30),
  ('rent',          'ค่าเช่า',                           'Rent',                         '40(5)',    '5', 5,    40),
  ('advertising',   'ค่าโฆษณา',                          'Advertising',                  '40(8)',    '5', 2,    50),
  ('transport',     'ค่าขนส่ง',                          'Transport',                    '40(8)',    '5', 1,    60),
  ('insurance',     'เบี้ยประกันวินาศภัย',                 'Non-life insurance premiums',  '40(8)',    '5', 1,    70),
  ('prize',         'รางวัล ส่วนลด หรือประโยชน์จากการส่งเสริมการขาย', 'Prizes and sales promotion', '40(8)', '5', 5, 80),
  ('performer',     'ค่าแสดงของนักแสดงสาธารณะ',             'Public performers',            '40(8)',    '5', 5,    90),
  ('commission',    'ค่าธรรมเนียม ค่านายหน้า',              'Fees and commissions',         '40(2)',    '2', 3,   100),
  ('interest',      'ดอกเบี้ย',                           'Interest',                     '40(4)(ก)', '4a', 1,  110),
  ('dividend',      'เงินปันผล',                          'Dividends',                    '40(4)(ข)', '4b', 10, 120),
  ('other',         'อื่นๆ',                              'Other',                        '40(8)',    '6', null, 999);

create type public.wht_condition as enum ('withhold', 'pay_always', 'pay_once');
create type public.wht_form as enum ('pnd3', 'pnd53');

alter table public.products add column wht_income_type text references public.wht_income_types (code);
alter table public.document_lines add column wht_income_type text references public.wht_income_types (code);
alter table public.documents add column wht_condition public.wht_condition not null default 'withhold';
alter table public.payments add column wht_condition public.wht_condition not null default 'withhold';

grant insert (wht_condition) on public.documents to authenticated;
grant update (wht_condition) on public.documents to authenticated;
grant insert (wht_income_type) on public.document_lines to authenticated;
grant update (wht_income_type) on public.document_lines to authenticated;
grant insert (wht_condition) on public.payments to authenticated;
grant update (wht_condition) on public.payments to authenticated;

-- Tax for one WHT group (D8): pay_always grosses up, others are base × rate.
create or replace function public.wht_tax(p_base numeric, p_rate numeric, p_condition public.wht_condition)
returns numeric
language sql
immutable
set search_path = ''
as $$
  select case
    when coalesce(p_rate, 0) <= 0 or coalesce(p_base, 0) = 0 then 0::numeric(18, 2)
    when p_condition = 'pay_always' then round(p_base * p_rate / (100 - p_rate), 2)
    else round(p_base * p_rate / 100, 2)
  end;
$$;

-- ---------------------------------------------------------------------------
-- Engine changes (from M4, edited for D6/D8)
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

    v_line_out := v_line_out || jsonb_build_object(
      'base_amount', c.base_amount, 'vat_amount', c.vat_amount, 'wht_amount', v_line_wht,
      'item_kind', v_kind);

    v_subtotal := v_subtotal + c.base_amount;
    v_wht := v_wht + v_line_wht;
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
      'vat_total', v_vat_goods + v_vat_service,
      'vat_deferred_total', case when v_service_vat_role in ('OUTPUT_VAT_DEFERRED', 'INPUT_VAT_DEFERRED')
                                 then v_vat_service else 0 end,
      'total', v_total,
      'wht_total', v_wht,
      'net_total', v_net));
end;
$$;

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
  v_cond public.wht_condition := coalesce((p_pay ->> 'wht_condition')::public.wht_condition, 'withhold');
  v_expected numeric(18, 2);
begin
  if v_dir is null then
    raise exception 'PAYMENT_DIRECTION_REQUIRED' using errcode = 'P0001';
  end if;
  if v_dir = 'received' and v_cond <> 'withhold' then
    raise exception 'WHT_CONDITION_INVALID' using errcode = 'P0001';
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

  -- D8: borne tax is paid on top; the payee still receives the full settled amount
  v_expected := v_amount + (case when v_cond = 'withhold' then v_wht else 0 end);
  if v_alloc_sum <> v_expected then
    raise exception 'PAYMENT_NOT_ALLOCATED' using errcode = 'P0001',
      detail = format('allocated %s, amount + wht %s', v_alloc_sum, v_expected);
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
          'INPUT_VAT_DEFERRED', 'C', v_transfer_sum, 'vat_transfer')::private.jline,
      row(6, case when v_wht > 0 and v_cond <> 'withhold'
                  then private.role_account(p_company_id, 'WHT_BORNE_EXPENSE') end,
          'WHT_BORNE_EXPENSE', 'D', case when v_cond <> 'withhold' then v_wht else 0 end, 'wht')::private.jline];
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
    when 'payment_received' then 'RV' when 'payment_paid' then 'PV'
    when 'wht_certificate' then 'WHT' else upper(p_series) end);
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
        'wht_rate', l.wht_rate, 'wht_income_type', l.wht_income_type, 'account_id', l.account_id) order by l.line_no)
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
    'wht_condition', p.wht_condition,
    'allocations', coalesce((
      select jsonb_agg(jsonb_build_object('document_id', a.document_id, 'amount', a.amount,
                                          'wht_amount', a.wht_amount) order by a.id)
      from public.payment_allocations a where a.payment_id = p.id), '[]'::jsonb))
  from public.payments p where p.id = p_payment_id;
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
      payment_account_id, ref_document_id, reference, notes, source, wht_condition)
    values (v_company, (p_doc ->> 'type')::public.document_type,
      coalesce((p_doc ->> 'doc_date')::date, (now() at time zone 'Asia/Bangkok')::date),
      (p_doc ->> 'due_date')::date, nullif(p_doc ->> 'contact_id', '')::uuid,
      coalesce((p_doc ->> 'vat_mode')::public.vat_mode, 'exclusive'), (p_doc ->> 'vat_rate')::numeric,
      nullif(p_doc ->> 'payment_account_id', '')::uuid, nullif(p_doc ->> 'ref_document_id', '')::uuid,
      p_doc ->> 'reference', p_doc ->> 'notes',
      coalesce((p_doc ->> 'source')::public.document_source, 'manual'),
      coalesce((p_doc ->> 'wht_condition')::public.wht_condition, 'withhold'))
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
      wht_condition = coalesce((p_doc ->> 'wht_condition')::public.wht_condition, 'withhold')
    where id = v_id;
    delete from public.document_lines where document_id = v_id;
  end if;

  insert into public.document_lines (company_id, document_id, line_no, product_id, description, item_kind,
    qty, unit_price, discount, vat_type, wht_rate, wht_income_type, account_id, base_amount, vat_amount, wht_amount)
  select v_company, v_id, x.ord::int, nullif(x.l ->> 'product_id', '')::uuid, coalesce(x.l ->> 'description', ''),
    (cc.c ->> 'item_kind')::public.product_kind,
    coalesce((x.l ->> 'qty')::numeric, 1), coalesce((x.l ->> 'unit_price')::numeric, 0),
    coalesce((x.l ->> 'discount')::numeric, 0),
    coalesce((x.l ->> 'vat_type')::public.product_vat_type, 'standard'),
    coalesce((x.l ->> 'wht_rate')::numeric, 0), nullif(x.l ->> 'wht_income_type', ''),
    nullif(x.l ->> 'account_id', '')::uuid,
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
      amount, wht_amount, reference, notes, wht_condition)
    values (v_company, (p_pay ->> 'direction')::public.payment_direction,
      coalesce((p_pay ->> 'pay_date')::date, (now() at time zone 'Asia/Bangkok')::date),
      (p_pay ->> 'contact_id')::uuid, (p_pay ->> 'payment_account_id')::uuid,
      coalesce((p_pay ->> 'amount')::numeric, 0), coalesce((p_pay ->> 'wht_amount')::numeric, 0),
      p_pay ->> 'reference', p_pay ->> 'notes',
      coalesce((p_pay ->> 'wht_condition')::public.wht_condition, 'withhold'))
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
      notes = p_pay ->> 'notes',
      wht_condition = coalesce((p_pay ->> 'wht_condition')::public.wht_condition, 'withhold')
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

-- ---------------------------------------------------------------------------
-- Withholding tax certificates — 50 ทวิ (D7)
--   one per posted payment (bills) or posted cash purchase, dated the pay date,
--   form ภ.ง.ด.3 (individual) / ภ.ง.ด.53 (juristic), numbered yearly.
-- ---------------------------------------------------------------------------
create table public.wht_certificates (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  number text not null,
  cert_date date not null,
  contact_id uuid not null,
  form public.wht_form not null,
  condition public.wht_condition not null,
  payment_id uuid,
  document_id uuid,
  total_income numeric(18, 2) not null,
  total_tax numeric(18, 2) not null,
  voided_at timestamptz,
  created_at timestamptz not null default now(),
  unique (company_id, number),
  unique (company_id, id),
  foreign key (company_id, contact_id) references public.contacts (company_id, id),
  foreign key (company_id, payment_id) references public.payments (company_id, id) on delete cascade,
  foreign key (company_id, document_id) references public.documents (company_id, id) on delete cascade,
  check ((payment_id is null) <> (document_id is null))
);
create index wht_certificates_company_date_idx on public.wht_certificates (company_id, cert_date);

create table public.wht_certificate_lines (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  certificate_id uuid not null,
  line_no int not null,
  income_type text not null references public.wht_income_types (code),
  wht_rate numeric(5, 2) not null,
  income_amount numeric(18, 2) not null,
  tax_amount numeric(18, 2) not null,
  foreign key (company_id, certificate_id) references public.wht_certificates (company_id, id) on delete cascade
);

alter table public.wht_certificates enable row level security;
alter table public.wht_certificate_lines enable row level security;
revoke all on public.wht_certificates, public.wht_certificate_lines from anon;
revoke insert, update, delete on public.wht_certificates, public.wht_certificate_lines from authenticated;
create policy wht_certificates_select on public.wht_certificates for select to authenticated
  using (private.is_member(company_id));
create policy wht_certificate_lines_select on public.wht_certificate_lines for select to authenticated
  using (private.is_member(company_id));

create trigger wht_certificates_audit after insert or update or delete on public.wht_certificates
  for each row execute function private.audit();

-- p_groups: [{income_type, rate, base}] — base = income before tax for this settlement.
-- Group taxes are reconciled to p_total_tax (the amount actually booked) on the largest group.
create or replace function private.create_wht_certificate(
  p_company_id uuid, p_date date, p_contact_id uuid, p_condition public.wht_condition,
  p_payment_id uuid, p_document_id uuid, p_groups jsonb, p_total_tax numeric)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_entity public.entity_type;
  v_id uuid;
  v_diff numeric(18, 2);
  v_rows jsonb;
begin
  select entity_type into v_entity from public.contacts where id = p_contact_id and company_id = p_company_id;
  if v_entity is null then
    raise exception 'CONTACT_REQUIRED' using errcode = 'P0001';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object('income_type', income_type, 'rate', rate, 'base', base,
           'tax', public.wht_tax(base, rate, p_condition)) order by base desc, income_type, rate), '[]')
    into v_rows
  from (
    select coalesce(nullif(g ->> 'income_type', ''), 'other') as income_type, (g ->> 'rate')::numeric as rate,
           sum((g ->> 'base')::numeric) as base
    from jsonb_array_elements(p_groups) g
    where (g ->> 'rate')::numeric > 0
    group by 1, 2
  ) x
  where base > 0;

  if jsonb_array_length(v_rows) = 0 then
    return null;
  end if;

  v_diff := p_total_tax - (select sum((r ->> 'tax')::numeric) from jsonb_array_elements(v_rows) r);
  v_rows := jsonb_set(v_rows, '{0,tax}', to_jsonb((v_rows #>> '{0,tax}')::numeric + v_diff));

  insert into public.wht_certificates (company_id, number, cert_date, contact_id, form, condition,
    payment_id, document_id, total_income, total_tax)
  values (p_company_id, private.next_number(p_company_id, 'wht_certificate', p_date), p_date, p_contact_id,
    case when v_entity = 'individual' then 'pnd3' else 'pnd53' end::public.wht_form, p_condition,
    p_payment_id, p_document_id, 0, p_total_tax)
  returning id into v_id;

  -- pay_always: the borne tax is itself income of the payee
  insert into public.wht_certificate_lines (company_id, certificate_id, line_no, income_type, wht_rate,
    income_amount, tax_amount)
  select p_company_id, v_id, ord::int, r ->> 'income_type', (r ->> 'rate')::numeric,
         (r ->> 'base')::numeric + case when p_condition = 'pay_always' then (r ->> 'tax')::numeric else 0 end,
         (r ->> 'tax')::numeric
  from jsonb_array_elements(v_rows) with ordinality as x(r, ord);

  update public.wht_certificates
  set total_income = (select sum(income_amount) from public.wht_certificate_lines where certificate_id = v_id)
  where id = v_id;
  return v_id;
end;
$$;

-- Payment posted → certificate for the share of each bill settled; voided → certificate voided.
create or replace function private.payment_wht_certificate()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_groups jsonb;
begin
  if new.direction <> 'paid' then
    return new;
  end if;
  if old.status = 'draft' and new.status = 'posted' and new.wht_amount > 0 then
    select coalesce(jsonb_agg(jsonb_build_object('income_type', l.wht_income_type, 'rate', l.wht_rate,
             'base', round(l.base_amount * a.amount / d.total, 2))), '[]')
      into v_groups
    from public.payment_allocations a
    join public.documents d on d.id = a.document_id
    join public.document_lines l on l.document_id = d.id
    where a.payment_id = new.id and l.wht_rate > 0 and d.total > 0;
    perform private.create_wht_certificate(new.company_id, new.pay_date, new.contact_id, new.wht_condition,
      new.id, null, v_groups, new.wht_amount);
  elsif old.status = 'posted' and new.status = 'voided' then
    update public.wht_certificates set voided_at = now() where payment_id = new.id and voided_at is null;
  end if;
  return new;
end;
$$;

create trigger payments_wht_certificate after update of status on public.payments
  for each row execute function private.payment_wht_certificate();

create or replace function private.document_wht_certificate()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_groups jsonb;
begin
  if new.type <> 'cash_purchase' then
    return new;
  end if;
  if old.status = 'draft' and new.status = 'posted' and new.wht_total > 0 then
    select coalesce(jsonb_agg(jsonb_build_object('income_type', l.wht_income_type, 'rate', l.wht_rate,
             'base', l.base_amount)), '[]')
      into v_groups
    from public.document_lines l
    where l.document_id = new.id and l.wht_rate > 0;
    perform private.create_wht_certificate(new.company_id, new.doc_date, new.contact_id, new.wht_condition,
      null, new.id, v_groups, new.wht_total);
  elsif old.status = 'posted' and new.status = 'voided' then
    update public.wht_certificates set voided_at = now() where document_id = new.id and voided_at is null;
  end if;
  return new;
end;
$$;

create trigger documents_wht_certificate after update of status on public.documents
  for each row execute function private.document_wht_certificate();

-- Print data for the 50 ทวิ PDF
create or replace function public.print_wht_certificate(p_certificate_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', w.id, 'number', w.number, 'cert_date', w.cert_date, 'form', w.form, 'condition', w.condition,
    'total_income', w.total_income, 'total_tax', w.total_tax, 'voided', w.voided_at is not null,
    'source_number', coalesce(p.number, d.number),
    'payer', jsonb_build_object('name', c.name, 'tax_id', c.tax_id, 'address', c.address,
                                'branch_code', c.branch_code),
    'payee', jsonb_build_object('name', k.name, 'tax_id', k.tax_id, 'address', k.address,
                                'entity_type', k.entity_type, 'branch_code', k.branch_code),
    'lines', (select jsonb_agg(jsonb_build_object('income_type', l.income_type, 'name_th', t.name_th,
                'name_en', t.name_en, 'section', t.section, 'form_row', t.form_row, 'rate', l.wht_rate,
                'income_amount', l.income_amount, 'tax_amount', l.tax_amount) order by l.line_no)
              from public.wht_certificate_lines l join public.wht_income_types t on t.code = l.income_type
              where l.certificate_id = w.id))
  from public.wht_certificates w
  join public.companies c on c.id = w.company_id
  join public.contacts k on k.id = w.contact_id
  left join public.payments p on p.id = w.payment_id
  left join public.documents d on d.id = w.document_id
  where w.id = p_certificate_id and private.is_member(w.company_id);
$$;

-- ---------------------------------------------------------------------------
-- Attachments (bill photos / files) — Storage bucket "attachments", path = <company_id>/<uuid>-<name>
-- Attachments are evidence, not accounting data: allowed on drafts and posted documents.
-- ---------------------------------------------------------------------------
create table public.attachments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  document_id uuid,
  payment_id uuid,
  storage_path text not null unique,
  file_name text not null,
  mime_type text,
  size_bytes bigint,
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  foreign key (company_id, document_id) references public.documents (company_id, id) on delete cascade,
  foreign key (company_id, payment_id) references public.payments (company_id, id) on delete cascade,
  check ((document_id is null) <> (payment_id is null)),
  check (split_part(storage_path, '/', 1) = company_id::text)
);
alter table public.attachments enable row level security;
revoke all on public.attachments from anon;
create policy attachments_select on public.attachments for select to authenticated
  using (private.is_member(company_id));
create policy attachments_insert on public.attachments for insert to authenticated
  with check (private.has_role(company_id, '{owner,admin,accountant,staff}'));
create policy attachments_delete on public.attachments for delete to authenticated
  using (private.has_role(company_id, '{owner,admin,accountant}') or created_by = auth.uid());
revoke update on public.attachments from authenticated;
create trigger attachments_audit after insert or update or delete on public.attachments
  for each row execute function private.audit();

insert into storage.buckets (id, name, public, file_size_limit)
values ('attachments', 'attachments', false, 20 * 1024 * 1024)
on conflict (id) do nothing;

create policy attachments_objects_select on storage.objects for select to authenticated
  using (bucket_id = 'attachments'
         and private.is_member(nullif((storage.foldername(name))[1], '')::uuid));
create policy attachments_objects_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'attachments'
              and private.has_role(nullif((storage.foldername(name))[1], '')::uuid,
                                   '{owner,admin,accountant,staff}'));
create policy attachments_objects_delete on storage.objects for delete to authenticated
  using (bucket_id = 'attachments'
         and (private.has_role(nullif((storage.foldername(name))[1], '')::uuid, '{owner,admin,accountant}')
              or owner_id = auth.uid()::text));

revoke execute on function public.print_wht_certificate from public, anon;
grant execute on function public.print_wht_certificate to authenticated;
revoke execute on function private.create_wht_certificate, private.payment_wht_certificate,
  private.document_wht_certificate from public, anon, authenticated;
