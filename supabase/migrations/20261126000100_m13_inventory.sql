-- M13 perpetual inventory — additive only (decisions D16 in docs/DECISIONS.md):
--   * products.track_stock: stocked goods; buying them debits INVENTORY (not an expense),
--     selling them (invoice / cash sale) posts COGS ↔ INVENTORY in the same journal entry
--   * cost method per company: FIFO (default) or weighted average, fixed once stock has moved;
--     costs follow the posting order
--   * no negative stock: posting a sale beyond what is on hand is refused
--   * credit notes return goods to stock at the cost they went out (unless restock = false)
--   * stock adjustments: opening (Dr INVENTORY / Cr RETAINED_EARNINGS), count / damage
--     (INVENTORY ↔ INVENTORY_ADJUSTMENT)
--   * one default warehouse per company now; the data model keeps warehouse_id everywhere

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
    when 'COGS' then 'expense'
    when 'INVENTORY_ADJUSTMENT' then 'expense'
  end::public.account_type;
$$;

-- Template accounts (every business type) + backfill existing companies
insert into public.account_templates
  (business_type, code, name_th, name_en, type, parent_code, is_group, mapping_role, sort_order)
select b.bt, v.code, v.name_th, v.name_en, v.type::public.account_type, v.parent_code, false,
       v.role::public.account_role, v.sort_order
from (values
  ('1160', 'สินค้าคงเหลือ', 'Inventory', 'asset', '1100', 'INVENTORY', 116),
  ('5101', 'ต้นทุนสินค้าที่ขาย', 'Cost of goods sold', 'expense', '5100', 'COGS', 5101),
  ('5102', 'สินค้าขาด/เกินและเสียหาย', 'Inventory shrinkage and damage', 'expense', '5100', 'INVENTORY_ADJUSTMENT', 5102)
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
    where t.mapping_role in ('INVENTORY', 'COGS', 'INVENTORY_ADJUSTMENT')
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
alter table public.companies add column cost_method text check (cost_method in ('fifo', 'average'));
alter table public.products
  add column track_stock boolean not null default false,
  add column reorder_level numeric(18, 4) check (reorder_level is null or reorder_level >= 0),
  add constraint products_track_stock_goods check (not track_stock or kind = 'product');
alter table public.documents add column restock boolean not null default true;
grant insert (track_stock, reorder_level) on public.products to authenticated;
grant update (track_stock, reorder_level) on public.products to authenticated;

create table public.warehouses (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  code text not null,
  name text not null check (length(trim(name)) > 0),
  is_default boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (company_id, code),
  unique (company_id, id)
);
create unique index warehouses_one_default on public.warehouses (company_id) where is_default;

create table public.stock_adjustments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  number text not null,
  adj_date date not null,
  kind text not null check (kind in ('opening', 'count', 'damage', 'other')),
  memo text,
  status public.document_status not null default 'posted',
  void_reason text,
  voided_at timestamptz,
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  unique (company_id, number),
  unique (company_id, id)
);

create table public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  seq bigserial not null unique,                  -- posting order = costing order
  company_id uuid not null,
  product_id uuid not null,
  warehouse_id uuid not null,
  move_date date not null,
  kind text not null check (kind in ('opening', 'purchase', 'sale', 'return', 'adjust', 'void')),
  qty numeric(18, 4) not null check (qty <> 0),   -- + in / − out
  amount numeric(18, 2) not null,                 -- value, same sign as qty
  remaining_qty numeric(18, 4) not null default 0,     -- FIFO layer (in-movements)
  remaining_amount numeric(18, 2) not null default 0,
  document_id uuid,
  adjustment_id uuid,
  reverses_movement_id uuid references public.stock_movements (id),
  voided_at timestamptz,
  created_at timestamptz not null default now(),
  unique (company_id, id),
  foreign key (company_id, product_id) references public.products (company_id, id) on delete restrict,
  foreign key (company_id, warehouse_id) references public.warehouses (company_id, id) on delete restrict,
  foreign key (company_id, document_id) references public.documents (company_id, id) on delete restrict,
  foreign key (company_id, adjustment_id) references public.stock_adjustments (company_id, id) on delete restrict
);
create index stock_movements_product_idx on public.stock_movements (product_id, warehouse_id, seq);
create index stock_movements_document_idx on public.stock_movements (document_id);
create index stock_movements_layers_idx on public.stock_movements (product_id, warehouse_id, seq)
  where remaining_qty > 0;

-- FIFO: which layers an out-movement used (to put them back on void)
create table public.stock_consumptions (
  out_movement_id uuid not null references public.stock_movements (id) on delete cascade,
  layer_movement_id uuid not null references public.stock_movements (id) on delete cascade,
  qty numeric(18, 4) not null,
  amount numeric(18, 2) not null
);
create index stock_consumptions_out_idx on public.stock_consumptions (out_movement_id);

alter table public.journal_entries add column stock_adjustment_id uuid;
alter table public.journal_entries add constraint journal_entries_stock_adjustment_fk
  foreign key (company_id, stock_adjustment_id) references public.stock_adjustments (company_id, id);

alter table public.warehouses enable row level security;
alter table public.stock_adjustments enable row level security;
alter table public.stock_movements enable row level security;
alter table public.stock_consumptions enable row level security;
revoke all on public.warehouses, public.stock_adjustments, public.stock_movements,
  public.stock_consumptions from anon;
revoke insert, update, delete on public.stock_adjustments, public.stock_movements,
  public.stock_consumptions from authenticated;
revoke all on public.stock_consumptions from authenticated;
create policy warehouses_select on public.warehouses for select to authenticated
  using (private.is_member(company_id));
create policy warehouses_update on public.warehouses for update to authenticated
  using (private.has_role(company_id, '{owner,admin,accountant}'))
  with check (private.has_role(company_id, '{owner,admin,accountant}'));
revoke insert, delete on public.warehouses from authenticated;
revoke update on public.warehouses from authenticated;
grant update (name) on public.warehouses to authenticated;
create policy stock_adjustments_select on public.stock_adjustments for select to authenticated
  using (private.is_member(company_id));
create policy stock_movements_select on public.stock_movements for select to authenticated
  using (private.is_member(company_id));
create trigger stock_adjustments_audit after insert or update or delete on public.stock_adjustments
  for each row execute function private.audit();

-- one default warehouse per company (existing companies now, new ones on creation)
insert into public.warehouses (company_id, code, name, is_default)
select id, 'MAIN', 'คลังหลัก', true from public.companies
on conflict do nothing;

create or replace function private.create_default_warehouse()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.warehouses (company_id, code, name, is_default) values (new.id, 'MAIN', 'คลังหลัก', true)
  on conflict do nothing;
  return new;
end;
$$;
create trigger companies_default_warehouse after insert on public.companies
  for each row execute function private.create_default_warehouse();

create or replace function private.default_warehouse(p_company_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select id from public.warehouses where company_id = p_company_id and is_default;
$$;

create or replace function private.cost_method(p_company_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(cost_method, 'fifo') from public.companies where id = p_company_id;
$$;

-- Tracking cannot be switched off once a product has moved (its history would be orphaned)
create or replace function private.guard_track_stock()
returns trigger
language plpgsql
as $$
begin
  if old.track_stock and not new.track_stock
     and exists (select 1 from public.stock_movements where product_id = new.id) then
    raise exception 'STOCK_TRACKING_IN_USE' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
create trigger products_guard_track_stock before update of track_stock on public.products
  for each row execute function private.guard_track_stock();

-- ---------------------------------------------------------------------------
-- costing
-- ---------------------------------------------------------------------------
-- Cost of issuing p_qty now, after p_skip units already taken by earlier lines of the same
-- document. FIFO walks the open layers in posting order; average uses value ÷ quantity on hand.
-- `short` > 0 when there is not enough stock (the amount then covers what is available).
create or replace function private.stock_issue_cost(
  p_company_id uuid, p_product_id uuid, p_warehouse_id uuid, p_qty numeric, p_skip numeric default 0,
  out amount numeric, out short numeric)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_skip numeric := coalesce(p_skip, 0);
  v_need numeric := p_qty;
  r record;
  v_avail numeric;
  v_avail_amt numeric;
  v_s numeric;
  v_take numeric;
  v_q numeric;
  v_v numeric;
begin
  amount := 0;
  if private.cost_method(p_company_id) = 'fifo' then
    for r in
      select remaining_qty, remaining_amount from public.stock_movements
      where product_id = p_product_id and warehouse_id = p_warehouse_id and remaining_qty > 0
      order by seq
    loop
      exit when v_need <= 0;
      v_avail := r.remaining_qty;
      v_avail_amt := r.remaining_amount;
      if v_skip > 0 then
        v_s := least(v_skip, v_avail);
        v_avail_amt := v_avail_amt - case when v_s = v_avail then v_avail_amt
                                          else round(v_avail_amt * v_s / v_avail, 2) end;
        v_avail := v_avail - v_s;
        v_skip := v_skip - v_s;
      end if;
      continue when v_avail <= 0;
      v_take := least(v_need, v_avail);
      amount := amount + case when v_take = v_avail then v_avail_amt
                              else round(v_avail_amt * v_take / v_avail, 2) end;
      v_need := v_need - v_take;
    end loop;
    short := greatest(v_need, 0);
  else
    select coalesce(sum(qty), 0), coalesce(sum(m.amount), 0) into v_q, v_v
    from public.stock_movements m where product_id = p_product_id and warehouse_id = p_warehouse_id;
    if v_skip > 0 and v_q > 0 then
      v_v := v_v - case when v_skip >= v_q then v_v else round(v_v * v_skip / v_q, 2) end;
      v_q := v_q - v_skip;
    end if;
    if v_q <= 0 then
      short := p_qty;
    else
      amount := case when p_qty >= v_q then v_v else round(v_v * p_qty / v_q, 2) end;
      short := greatest(p_qty - v_q, 0);
    end if;
  end if;
  amount := round(amount, 2);
end;
$$;

-- Issue stock for real (same arithmetic as stock_issue_cost with skip = 0) and record it.
create or replace function private.stock_issue(
  p_company_id uuid, p_product_id uuid, p_warehouse_id uuid, p_qty numeric, p_date date,
  p_kind text, p_document_id uuid, p_adjustment_id uuid)
returns numeric
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cost record;
  v_out uuid;
  v_need numeric := p_qty;
  r record;
  v_take numeric;
  v_amt numeric;
begin
  -- serialise costing per product
  perform 1 from public.products where id = p_product_id for update;
  select * into v_cost from private.stock_issue_cost(p_company_id, p_product_id, p_warehouse_id, p_qty, 0);
  if v_cost.short > 0 then
    raise exception 'STOCK_INSUFFICIENT' using errcode = 'P0001',
      detail = (select jsonb_build_array(jsonb_build_object('product_id', id, 'name', name, 'short', v_cost.short))::text
                from public.products where id = p_product_id);
  end if;
  insert into public.stock_movements (company_id, product_id, warehouse_id, move_date, kind, qty, amount,
    document_id, adjustment_id)
  values (p_company_id, p_product_id, p_warehouse_id, p_date, p_kind, -p_qty, -v_cost.amount,
    p_document_id, p_adjustment_id)
  returning id into v_out;

  if private.cost_method(p_company_id) = 'fifo' then
    for r in
      select id, remaining_qty, remaining_amount from public.stock_movements
      where product_id = p_product_id and warehouse_id = p_warehouse_id and remaining_qty > 0
      order by seq for update
    loop
      exit when v_need <= 0;
      v_take := least(v_need, r.remaining_qty);
      v_amt := case when v_take = r.remaining_qty then r.remaining_amount
                    else round(r.remaining_amount * v_take / r.remaining_qty, 2) end;
      update public.stock_movements set remaining_qty = remaining_qty - v_take,
        remaining_amount = remaining_amount - v_amt where id = r.id;
      insert into public.stock_consumptions (out_movement_id, layer_movement_id, qty, amount)
      values (v_out, r.id, v_take, v_amt);
      v_need := v_need - v_take;
    end loop;
  end if;
  return v_cost.amount;
end;
$$;

create or replace function private.stock_receive(
  p_company_id uuid, p_product_id uuid, p_warehouse_id uuid, p_qty numeric, p_amount numeric,
  p_date date, p_kind text, p_document_id uuid, p_adjustment_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform 1 from public.products where id = p_product_id for update;
  insert into public.stock_movements (company_id, product_id, warehouse_id, move_date, kind, qty, amount,
    remaining_qty, remaining_amount, document_id, adjustment_id)
  values (p_company_id, p_product_id, p_warehouse_id, p_date, p_kind, p_qty, p_amount, p_qty, p_amount,
    p_document_id, p_adjustment_id);
end;
$$;

-- Value of p_qty returned from the sale document p_ref: the average cost it went out at.
create or replace function private.stock_return_cost(p_ref uuid, p_product_id uuid, p_qty numeric)
returns numeric
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(round(sum(-amount) * p_qty / nullif(sum(-qty), 0), 2), 0)
  from public.stock_movements
  where document_id = p_ref and product_id = p_product_id and kind = 'sale' and voided_at is null;
$$;

-- Called by post_document (same transaction, after the journal): write the stock movements.
create or replace function private.stock_on_post(p_document_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_doc public.documents;
  v_wh uuid;
  l record;
  v_sold numeric;
  v_back numeric;
begin
  select * into v_doc from public.documents where id = p_document_id;
  v_wh := private.default_warehouse(v_doc.company_id);
  for l in
    select dl.*, p.track_stock from public.document_lines dl
    join public.products p on p.id = dl.product_id
    where dl.document_id = v_doc.id and p.track_stock and dl.qty > 0
    order by dl.line_no
  loop
    if v_doc.type in ('bill', 'cash_purchase') then
      perform private.stock_receive(v_doc.company_id, l.product_id, v_wh, l.qty,
        l.base_amount + case when l.vat_claimable then 0 else l.vat_amount end,
        v_doc.doc_date, 'purchase', v_doc.id, null);
    elsif v_doc.type in ('invoice', 'cash_sale') then
      perform private.stock_issue(v_doc.company_id, l.product_id, v_wh, l.qty, v_doc.doc_date, 'sale', v_doc.id, null);
    elsif v_doc.type = 'credit_note' and v_doc.restock and v_doc.ref_document_id is not null then
      select coalesce(sum(-qty), 0) into v_sold from public.stock_movements
      where document_id = v_doc.ref_document_id and product_id = l.product_id and kind = 'sale' and voided_at is null;
      select coalesce(sum(m.qty), 0) into v_back from public.stock_movements m
      join public.documents n on n.id = m.document_id
      where n.ref_document_id = v_doc.ref_document_id and n.id <> v_doc.id and m.product_id = l.product_id
        and m.kind = 'return' and m.voided_at is null;
      if l.qty > v_sold - v_back then
        raise exception 'STOCK_RETURN_EXCEEDS' using errcode = 'P0001';
      end if;
      perform private.stock_receive(v_doc.company_id, l.product_id, v_wh, l.qty,
        private.stock_return_cost(v_doc.ref_document_id, l.product_id, l.qty),
        v_doc.doc_date, 'return', v_doc.id, null);
    end if;
  end loop;
end;
$$;

-- Undo the stock of a document or adjustment being voided. Goods received that have already
-- been used cannot be un-received.
create or replace function private.stock_reverse(p_document_id uuid, p_adjustment_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  m record;
  c record;
  v_onhand numeric;
begin
  for m in
    select * from public.stock_movements
    where ((p_document_id is not null and document_id = p_document_id)
        or (p_adjustment_id is not null and adjustment_id = p_adjustment_id))
      and voided_at is null and kind <> 'void'
    order by seq desc
  loop
    perform 1 from public.products where id = m.product_id for update;
    if m.qty > 0 then
      if private.cost_method(m.company_id) = 'fifo' then
        if m.remaining_qty <> m.qty then
          raise exception 'STOCK_ALREADY_USED' using errcode = 'P0001';
        end if;
      else
        select coalesce(sum(qty), 0) into v_onhand from public.stock_movements
        where product_id = m.product_id and warehouse_id = m.warehouse_id;
        if v_onhand < m.qty then
          raise exception 'STOCK_ALREADY_USED' using errcode = 'P0001';
        end if;
      end if;
      update public.stock_movements set remaining_qty = 0, remaining_amount = 0, voided_at = now() where id = m.id;
    else
      for c in select * from public.stock_consumptions where out_movement_id = m.id loop
        update public.stock_movements set remaining_qty = remaining_qty + c.qty,
          remaining_amount = remaining_amount + c.amount where id = c.layer_movement_id;
      end loop;
      update public.stock_movements set voided_at = now() where id = m.id;
    end if;
    insert into public.stock_movements (company_id, product_id, warehouse_id, move_date, kind, qty, amount,
      document_id, adjustment_id, reverses_movement_id)
    values (m.company_id, m.product_id, m.warehouse_id, m.move_date, 'void', -m.qty, -m.amount,
      m.document_id, m.adjustment_id, m.id);
  end loop;
end;
$$;

create or replace function private.stock_on_void(p_document_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  select private.stock_reverse(p_document_id, null);
$$;

-- ---------------------------------------------------------------------------
-- posting engine (D16): build_journal / document_payload / save_document / post_document /
-- void_document / simulate_posting — as before plus inventory
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
  v_qty numeric;
  v_cost record;
  v_used jsonb := '{}';
  v_shortages jsonb := '[]';
  v_wh uuid := private.default_warehouse(p_company_id);
  v_restock boolean := coalesce((p_doc ->> 'restock')::boolean, true);
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
    -- M13: stocked goods bought go to inventory instead of the expense account (D16)
    if not v_is_sale and coalesce(v_product.track_stock, false) then
      v_role := 'INVENTORY';
      v_acc_id := private.role_account(p_company_id, 'INVENTORY');
    end if;
    v_ord := v_ord + 1;
    v_lines := v_lines || row(v_ord, v_acc_id, v_role::text,
      case when v_is_sale and v_type <> 'credit_note' then 'C' else 'D' end,
      c.base_amount + case when v_claim then 0 else c.vat_amount end,
      case when v_type = 'credit_note' then 'returns' else 'line' end)::private.jline;

    -- M13: cost of goods sold for stocked goods (same costing as the stock movement written
    -- when posting); returns on a credit note go back in at the cost they went out (D16)
    v_qty := coalesce((l ->> 'qty')::numeric, 0);
    if coalesce(v_product.track_stock, false) and v_qty > 0 then
      if v_type in ('invoice', 'cash_sale') then
        select * into v_cost from private.stock_issue_cost(p_company_id, v_product.id, v_wh, v_qty,
          coalesce((v_used ->> v_product.id::text)::numeric, 0));
        v_used := v_used || jsonb_build_object(v_product.id::text,
          coalesce((v_used ->> v_product.id::text)::numeric, 0) + v_qty);
        if v_cost.short > 0 then
          v_shortages := v_shortages || jsonb_build_object('product_id', v_product.id,
            'name', v_product.name, 'short', v_cost.short, 'line', v_ord);
        end if;
        v_lines := v_lines
          || row(800 + v_ord, private.role_account(p_company_id, 'COGS'), 'COGS', 'D', v_cost.amount, 'cogs')::private.jline
          || row(850 + v_ord, private.role_account(p_company_id, 'INVENTORY'), 'INVENTORY', 'C', v_cost.amount, 'cogs')::private.jline;
      elsif v_type = 'credit_note' and v_restock and nullif(p_doc ->> 'ref_document_id', '') is not null then
        v_lines := v_lines
          || row(800 + v_ord, private.role_account(p_company_id, 'INVENTORY'), 'INVENTORY', 'D',
                 private.stock_return_cost((p_doc ->> 'ref_document_id')::uuid, v_product.id, v_qty), 'cogs')::private.jline
          || row(850 + v_ord, private.role_account(p_company_id, 'COGS'), 'COGS', 'C',
                 private.stock_return_cost((p_doc ->> 'ref_document_id')::uuid, v_product.id, v_qty), 'cogs')::private.jline;
      end if;
    end if;
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
    'stock', jsonb_build_object('shortages', v_shortages),
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
    'ref_document_id', d.ref_document_id, 'wht_condition', d.wht_condition, 'restock', d.restock,
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
      tax_invoice_no, tax_invoice_date, vat_claim_month, restock)
    values (v_company, (p_doc ->> 'type')::public.document_type,
      coalesce((p_doc ->> 'doc_date')::date, (now() at time zone 'Asia/Bangkok')::date),
      (p_doc ->> 'due_date')::date, nullif(p_doc ->> 'contact_id', '')::uuid,
      coalesce((p_doc ->> 'vat_mode')::public.vat_mode, 'exclusive'), (p_doc ->> 'vat_rate')::numeric,
      nullif(p_doc ->> 'payment_account_id', '')::uuid, nullif(p_doc ->> 'ref_document_id', '')::uuid,
      p_doc ->> 'reference', p_doc ->> 'notes',
      coalesce((p_doc ->> 'source')::public.document_source, 'manual'),
      coalesce((p_doc ->> 'wht_condition')::public.wht_condition, 'withhold'),
      v_ti_no, v_ti_date, v_claim_month, coalesce((p_doc ->> 'restock')::boolean, true))
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
      vat_claim_month = v_claim_month,
      restock = coalesce((p_doc ->> 'restock')::boolean, true)
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

  -- M13: never sell more than is in stock (D16)
  if jsonb_array_length(coalesce(v_built #> '{stock,shortages}', '[]')) > 0 then
    raise exception 'STOCK_INSUFFICIENT' using errcode = 'P0001',
      detail = (v_built #> '{stock,shortages}')::text;
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
  perform private.stock_on_post(v_doc.id);

  perform set_config('app.engine', 'off', true);
  return jsonb_build_object('number', v_number, 'entry_id', v_entry);
end;
$$;

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
  perform private.stock_on_void(v_doc.id);
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
  v_next jsonb;
  v_date date;
  v_type public.document_type;
  v_err text;
  v_detail text;
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
      v_type := (p_payload ->> 'type')::public.document_type;
      v_date := coalesce((p_payload ->> 'doc_date')::date, (now() at time zone 'Asia/Bangkok')::date);
      v_built := private.build_journal(v_company, p_payload);
      if v_type in ('quotation', 'purchase_order') then
        -- "next step" of a quotation / PO is the invoice / bill it turns into
        v_next := private.build_journal(v_company, p_payload || jsonb_build_object(
          'type', case when v_type = 'quotation' then 'invoice' else 'bill' end));
        v_next := jsonb_build_object('type', case when v_type = 'quotation' then 'invoice' else 'bill' end,
                                     'lines', v_next -> 'lines');
      elsif v_type in ('invoice', 'debit_note', 'bill') then
        v_next := jsonb_build_object('type', case when v_type = 'bill' then 'payment_paid' else 'payment_received' end,
          'lines', private.build_settlement_preview(v_company, v_type, v_built -> 'totals'));
      end if;
    end if;
  exception when sqlstate 'P0001' then
    get stacked diagnostics v_err = message_text, v_detail = pg_exception_detail;
    return jsonb_build_object('ok', false, 'error', v_err, 'detail', v_detail);
  end;

  return jsonb_build_object(
    'ok', true,
    'lines', private.enrich_lines(v_built -> 'lines', v_date),
    'totals', v_built -> 'totals',
    'stock', v_built -> 'stock',
    'line_amounts', v_built -> 'line_amounts',
    'allocations', v_built -> 'allocations',
    'next', case when v_next is null then null
                 else jsonb_build_object('type', v_next ->> 'type',
                                         'lines', private.enrich_lines(v_next -> 'lines', v_date)) end);
end;
$$;


-- ---------------------------------------------------------------------------
-- settings / adjustments
-- ---------------------------------------------------------------------------
create or replace function public.set_cost_method(p_company_id uuid, p_method text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.has_role(p_company_id, '{owner,admin}') then
    raise exception 'permission denied' using errcode = '42501';
  end if;
  if p_method not in ('fifo', 'average') then
    raise exception 'STOCK_COST_METHOD_INVALID' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.stock_movements where company_id = p_company_id) then
    raise exception 'STOCK_COST_METHOD_LOCKED' using errcode = 'P0001';
  end if;
  update public.companies set cost_method = p_method where id = p_company_id;
end;
$$;

-- payload: { company_id, adj_date, kind: opening|count|damage|other, memo,
--            lines: [{ product_id, qty (+ in / − out), unit_cost (needed for opening / when
--                      nothing is in stock yet) }] }
create or replace function public.post_stock_adjustment(p_payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_company uuid := (p_payload ->> 'company_id')::uuid;
  v_date date := coalesce((p_payload ->> 'adj_date')::date, (now() at time zone 'Asia/Bangkok')::date);
  v_kind text := coalesce(p_payload ->> 'kind', 'count');
  v_id uuid;
  v_wh uuid;
  l jsonb;
  v_p public.products;
  v_qty numeric;
  v_cost numeric;
  v_amt numeric;
  v_in numeric := 0;
  v_out numeric := 0;
  v_entry uuid;
  v_n int := 0;
  v_q numeric;
  v_v numeric;
begin
  if not private.has_role(v_company, '{owner,admin,accountant}') then
    raise exception 'permission denied' using errcode = '42501';
  end if;
  if v_kind not in ('opening', 'count', 'damage', 'other') then
    raise exception 'STOCK_ADJUSTMENT_KIND' using errcode = 'P0001';
  end if;
  if jsonb_array_length(coalesce(p_payload -> 'lines', '[]')) = 0 then
    raise exception 'STOCK_ADJUSTMENT_EMPTY' using errcode = 'P0001';
  end if;
  v_wh := private.default_warehouse(v_company);

  insert into public.stock_adjustments (company_id, number, adj_date, kind, memo)
  values (v_company, private.next_number(v_company, 'adj', v_date), v_date, v_kind, nullif(trim(p_payload ->> 'memo'), ''))
  returning id into v_id;

  for l in select value from jsonb_array_elements(p_payload -> 'lines') loop
    select * into v_p from public.products where id = (l ->> 'product_id')::uuid and company_id = v_company;
    if v_p.id is null or not v_p.track_stock then
      raise exception 'STOCK_PRODUCT_NOT_TRACKED' using errcode = 'P0001';
    end if;
    v_qty := round(coalesce((l ->> 'qty')::numeric, 0), 4);
    continue when v_qty = 0;
    v_n := v_n + 1;
    if v_qty > 0 then
      v_cost := nullif(l ->> 'unit_cost', '')::numeric;
      if v_cost is null and v_kind <> 'opening' then
        -- surplus found when counting: value it at the current average cost
        select coalesce(sum(qty), 0), coalesce(sum(amount), 0) into v_q, v_v
        from public.stock_movements where product_id = v_p.id and warehouse_id = v_wh;
        if v_q > 0 then v_cost := v_v / v_q; end if;
      end if;
      if v_cost is null or v_cost < 0 then
        raise exception 'STOCK_UNIT_COST_REQUIRED' using errcode = 'P0001';
      end if;
      if v_kind = 'opening' and v_qty < 0 then
        raise exception 'STOCK_ADJUSTMENT_KIND' using errcode = 'P0001';
      end if;
      v_amt := round(v_qty * v_cost, 2);
      perform private.stock_receive(v_company, v_p.id, v_wh, v_qty, v_amt, v_date,
        case when v_kind = 'opening' then 'opening' else 'adjust' end, null, v_id);
      v_in := v_in + v_amt;
    else
      if v_kind = 'opening' then
        raise exception 'STOCK_ADJUSTMENT_KIND' using errcode = 'P0001';
      end if;
      v_out := v_out + private.stock_issue(v_company, v_p.id, v_wh, -v_qty, v_date, 'adjust', null, v_id);
    end if;
  end loop;
  if v_n = 0 then
    raise exception 'STOCK_ADJUSTMENT_EMPTY' using errcode = 'P0001';
  end if;

  -- journal: opening → retained earnings; otherwise → shrinkage / damage account
  perform set_config('app.engine', 'on', true);
  if v_in + v_out > 0 then
    insert into public.journal_entries (company_id, entry_date, description, stock_adjustment_id)
    values (v_company, v_date, (select number from public.stock_adjustments where id = v_id), v_id)
    returning id into v_entry;
    insert into public.journal_lines (company_id, entry_id, line_no, account_id, debit, credit)
    select v_company, v_entry, row_number() over (), x.acc, x.dr, x.cr
    from (values
      (1, private.role_account(v_company, 'INVENTORY'), v_in, 0::numeric),
      (2, private.role_account(v_company, case when v_kind = 'opening' then 'RETAINED_EARNINGS'::public.account_role
                                               else 'INVENTORY_ADJUSTMENT'::public.account_role end), 0::numeric, v_in),
      (3, private.role_account(v_company, 'INVENTORY_ADJUSTMENT'), v_out, 0::numeric),
      (4, private.role_account(v_company, 'INVENTORY'), 0::numeric, v_out)
    ) as x (ord, acc, dr, cr)
    where x.dr + x.cr > 0;
  end if;
  perform set_config('app.engine', 'off', true);
  return v_id;
end;
$$;

create or replace function public.void_stock_adjustment(p_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_a public.stock_adjustments;
  v_e public.journal_entries;
  v_new uuid;
begin
  select * into v_a from public.stock_adjustments where id = p_id for update;
  if v_a.id is null or not private.has_role(v_a.company_id, '{owner,admin,accountant}') then
    raise exception 'permission denied' using errcode = '42501';
  end if;
  if v_a.status <> 'posted' then
    raise exception 'DOCUMENT_NOT_POSTED' using errcode = 'P0001';
  end if;
  if nullif(trim(p_reason), '') is null then
    raise exception 'VOID_REASON_REQUIRED' using errcode = 'P0001';
  end if;
  perform private.stock_reverse(null, v_a.id);
  perform set_config('app.engine', 'on', true);
  for v_e in select * from public.journal_entries where stock_adjustment_id = v_a.id and reverses_entry_id is null loop
    insert into public.journal_entries (company_id, entry_date, description, stock_adjustment_id, reverses_entry_id)
    values (v_a.company_id, v_e.entry_date, 'VOID ' || v_a.number, v_a.id, v_e.id) returning id into v_new;
    insert into public.journal_lines (company_id, entry_id, line_no, account_id, debit, credit)
    select company_id, v_new, line_no, account_id, credit, debit from public.journal_lines where entry_id = v_e.id;
  end loop;
  update public.stock_adjustments set status = 'voided', void_reason = p_reason, voided_at = now() where id = v_a.id;
  perform set_config('app.engine', 'off', true);
end;
$$;

-- ---------------------------------------------------------------------------
-- reports
-- ---------------------------------------------------------------------------
create or replace function public.stock_balance(p_company_id uuid, p_as_of date)
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
             'product_id', p.id, 'code', p.code, 'name', p.name, 'unit', p.unit,
             'qty', coalesce(x.qty, 0), 'value', coalesce(x.value, 0),
             'reorder_level', p.reorder_level,
             'low', p.reorder_level is not null and coalesce(x.qty, 0) <= p.reorder_level)
           order by p.code)
    from public.products p
    left join (
      select product_id, sum(qty) as qty, sum(amount) as value from public.stock_movements
      where company_id = p_company_id and move_date <= p_as_of group by product_id
    ) x on x.product_id = p.id
    where p.company_id = p_company_id and p.track_stock
  ), '[]'::jsonb);
end;
$$;

-- Stock card (รายงานสินค้าและวัตถุดิบ): opening + every movement of one product in a period.
create or replace function public.stock_card(p_product_id uuid, p_from date, p_to date)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_p public.products;
begin
  select * into v_p from public.products where id = p_product_id;
  if v_p.id is null or not private.is_member(v_p.company_id) then
    raise exception 'permission denied' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'product', jsonb_build_object('id', v_p.id, 'code', v_p.code, 'name', v_p.name, 'unit', v_p.unit),
    'opening_qty', (select coalesce(sum(qty), 0) from public.stock_movements where product_id = v_p.id and move_date < p_from),
    'opening_value', (select coalesce(sum(amount), 0) from public.stock_movements where product_id = v_p.id and move_date < p_from),
    'lines', coalesce((
      select jsonb_agg(jsonb_build_object(
               'date', m.move_date, 'kind', m.kind, 'ref', coalesce(d.number, a.number),
               'contact', c.name, 'qty', m.qty, 'amount', m.amount)
             order by m.move_date, m.seq)
      from public.stock_movements m
      left join public.documents d on d.id = m.document_id
      left join public.stock_adjustments a on a.id = m.adjustment_id
      left join public.contacts c on c.id = d.contact_id
      where m.product_id = v_p.id and m.move_date between p_from and p_to), '[]'::jsonb));
end;
$$;

revoke execute on function public.set_cost_method, public.post_stock_adjustment, public.void_stock_adjustment,
  public.stock_balance, public.stock_card from public, anon;
grant execute on function public.set_cost_method, public.post_stock_adjustment, public.void_stock_adjustment,
  public.stock_balance, public.stock_card to authenticated;
revoke execute on function private.stock_issue_cost, private.stock_issue, private.stock_receive,
  private.stock_return_cost, private.stock_on_post, private.stock_reverse, private.stock_on_void,
  private.default_warehouse, private.cost_method from public, anon;
