-- M13 perpetual inventory, hand-worked. Run: npm run db:test
--
-- FIFO company (VAT off), product A tracked:
--   1 Nov opening +10 @100 = 1,000         (Dr Inventory / Cr Retained earnings)
--   2 Nov bill     +10 @120 = 1,200         (Dr Inventory / Cr AP)
--   3 Nov invoice  −15                       COGS = 10×100 + 5×120 = 1,600
--   4 Nov credit note returns 3              back in at 1,600 ÷ 15 × 3 = 320
--   5 Nov count: 8 on hand, 7 counted → −1   from the 120 layer = 120 (shrinkage)
--   on hand 7, value 600 − 120 + 320 = 800 = Inventory account balance
-- Average company: opening 10 @100, buy 10 @130 → avg 115; sell 5 → COGS 575
begin;
select plan(17);

create schema tests;
create procedure tests.login(p_email text) language plpgsql as $$
declare v_id uuid;
begin
  reset role;
  select id into v_id from auth.users where email = p_email;
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_id, 'email', p_email, 'role', 'authenticated')::text, true);
  set local role authenticated;
end;
$$;
grant usage on schema tests to authenticated;
grant execute on procedure tests.login(text) to authenticated;

insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at)
values (gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
        'owner@stock.test', '{}', now(), now());

call tests.login('owner@stock.test');
do $$
declare v_co uuid; v_a uuid; v_cus uuid; v_ven uuid; v_doc uuid; v_inv uuid; v_cn uuid; v_co2 uuid; v_b uuid; v_bank uuid;
begin
  v_co := public.create_company('Stock Co', 'trading', null, '00000', null, null, false, 7);
  perform set_config('test.co', v_co::text, false);
  insert into public.products (company_id, code, name, kind, track_stock, reorder_level)
    values (v_co, 'A', 'Widget', 'product', true, 8) returning id into v_a;
  perform set_config('test.a', v_a::text, false);
  insert into public.contacts (company_id, code, name, contact_type) values (v_co, 'C', 'Cust', 'customer') returning id into v_cus;
  insert into public.contacts (company_id, code, name, contact_type) values (v_co, 'V', 'Vend', 'vendor') returning id into v_ven;

  perform public.post_stock_adjustment(jsonb_build_object('company_id', v_co, 'adj_date', '2026-11-01', 'kind', 'opening',
    'lines', jsonb_build_array(jsonb_build_object('product_id', v_a, 'qty', 10, 'unit_cost', 100))));
  v_doc := public.save_document(jsonb_build_object('company_id', v_co, 'type', 'bill', 'doc_date', '2026-11-02',
    'contact_id', v_ven, 'vat_mode', 'none',
    'lines', jsonb_build_array(jsonb_build_object('product_id', v_a, 'item_kind', 'product', 'qty', 10, 'unit_price', 120))));
  perform public.post_document(v_doc);
  perform set_config('test.bill', v_doc::text, false);
  v_inv := public.save_document(jsonb_build_object('company_id', v_co, 'type', 'invoice', 'doc_date', '2026-11-03',
    'contact_id', v_cus, 'vat_mode', 'none',
    'lines', jsonb_build_array(jsonb_build_object('product_id', v_a, 'item_kind', 'product', 'qty', 15, 'unit_price', 200))));
  perform public.post_document(v_inv);
  perform set_config('test.inv', v_inv::text, false);
  v_cn := public.save_document(jsonb_build_object('company_id', v_co, 'type', 'credit_note', 'doc_date', '2026-11-04',
    'contact_id', v_cus, 'vat_mode', 'none', 'ref_document_id', v_inv,
    'lines', jsonb_build_array(jsonb_build_object('product_id', v_a, 'item_kind', 'product', 'qty', 3, 'unit_price', 200))));
  perform public.post_document(v_cn);
  perform set_config('test.adj', public.post_stock_adjustment(jsonb_build_object('company_id', v_co,
    'adj_date', '2026-11-05', 'kind', 'count',
    'lines', jsonb_build_array(jsonb_build_object('product_id', v_a, 'qty', -1))))::text, false);

  -- average-cost company
  v_co2 := public.create_company('Avg Co', 'trading', null, '00000', null, null, false, 7);
  perform set_config('test.co2', v_co2::text, false);
  perform public.set_cost_method(v_co2, 'average');
  insert into public.products (company_id, code, name, kind, track_stock) values (v_co2, 'B', 'Bolt', 'product', true)
    returning id into v_b;
  select id into v_bank from public.accounts where company_id = v_co2 and code = '1120';
  perform public.post_stock_adjustment(jsonb_build_object('company_id', v_co2, 'adj_date', '2026-11-01', 'kind', 'opening',
    'lines', jsonb_build_array(jsonb_build_object('product_id', v_b, 'qty', 10, 'unit_cost', 100))));
  perform public.post_document(public.save_document(jsonb_build_object('company_id', v_co2, 'type', 'cash_purchase',
    'doc_date', '2026-11-02', 'payment_account_id', v_bank, 'vat_mode', 'none',
    'lines', jsonb_build_array(jsonb_build_object('product_id', v_b, 'item_kind', 'product', 'qty', 10, 'unit_price', 130)))));
  v_doc := public.save_document(jsonb_build_object('company_id', v_co2, 'type', 'cash_sale',
    'doc_date', '2026-11-03', 'payment_account_id', v_bank, 'vat_mode', 'none',
    'lines', jsonb_build_array(jsonb_build_object('product_id', v_b, 'item_kind', 'product', 'qty', 5, 'unit_price', 200))));
  perform public.post_document(v_doc);
  perform set_config('test.avgsale', v_doc::text, false);
end $$;

create function pg_temp.co() returns uuid language sql as $$ select current_setting('test.co')::uuid $$;
create function pg_temp.gl(p_co uuid, p_code text) returns numeric language sql as $$
  select coalesce(sum(l.debit - l.credit), 0) from public.journal_lines l join public.accounts a on a.id = l.account_id
  where a.company_id = p_co and a.code = p_code $$;
create function pg_temp.bal() returns jsonb language sql as $$ select public.stock_balance(pg_temp.co(), '2026-12-31') -> 0 $$;
create function pg_temp.doc_gl(p_doc text, p_code text) returns numeric language sql as $$
  select coalesce(sum(l.debit - l.credit), 0) from public.journal_lines l join public.journal_entries e on e.id = l.entry_id
  join public.accounts a on a.id = l.account_id where e.document_id = current_setting(p_doc)::uuid and a.code = p_code $$;

select is(pg_temp.doc_gl('test.bill', '1160'), 1200.00, 'buying stocked goods debits Inventory, not an expense');
select is(pg_temp.doc_gl('test.inv', '5101'), 1600.00, 'FIFO COGS on the invoice = 10×100 + 5×120');
select is(pg_temp.doc_gl('test.inv', '1160'), -1600.00, 'and Inventory is credited by the same amount');
select is((select sum(m.amount) from public.stock_movements m join public.documents d on d.id = m.document_id
           where d.type = 'credit_note' and d.company_id = pg_temp.co()), 320.00,
  'credit note returns 3 at the cost they went out (1,600 ÷ 15 × 3)');
select is((pg_temp.bal() ->> 'qty')::numeric, 7.0000, 'on hand: 10 + 10 − 15 + 3 − 1 = 7');
select is((pg_temp.bal() ->> 'value')::numeric, 800.00, 'stock value 800');
select is(pg_temp.gl(pg_temp.co(), '1160'), 800.00, 'Inventory account = stock value (800)');
select is(pg_temp.gl(pg_temp.co(), '5102'), 120.00, 'count shortage of 1 costs 120 (FIFO layer)');
select is((pg_temp.bal() ->> 'low')::boolean, true, 'below the reorder level of 8 → flagged');

-- no negative stock
select is((public.simulate_posting('document', jsonb_build_object('company_id', pg_temp.co(), 'type', 'invoice',
  'doc_date', '2026-11-06', 'vat_mode', 'none', 'lines', jsonb_build_array(jsonb_build_object(
    'product_id', current_setting('test.a'), 'item_kind', 'product', 'qty', 8, 'unit_price', 200))))
  #>> '{stock,shortages,0,short}')::numeric, 1.0000, 'the simulation warns: 1 short');
select throws_ok(format($q$select public.post_document(public.save_document(jsonb_build_object('company_id', %L,
  'type', 'invoice', 'doc_date', '2026-11-06', 'contact_id', (select id from public.contacts where code = 'C' and company_id = %L),
  'vat_mode', 'none', 'lines', jsonb_build_array(jsonb_build_object('product_id', %L, 'item_kind', 'product',
  'qty', 8, 'unit_price', 200)))))$q$, pg_temp.co(), pg_temp.co(), current_setting('test.a')),
  'P0001', 'STOCK_INSUFFICIENT', 'selling more than on hand is refused');

-- voids
select throws_ok(format($q$select public.void_document(%L, 'x')$q$, current_setting('test.bill')),
  'P0001', 'STOCK_ALREADY_USED', 'a purchase whose goods were sold cannot be voided');
select lives_ok(format($q$select public.void_stock_adjustment(%L, 'recount')$q$, current_setting('test.adj')),
  'the count adjustment can be voided');
select results_eq($q$ select (pg_temp.bal() ->> 'qty')::numeric, (pg_temp.bal() ->> 'value')::numeric,
                             pg_temp.gl(pg_temp.co(), '1160') $q$,
  $q$ values (8.0000::numeric, 920.00::numeric, 920.00::numeric) $q$,
  'after the void: 8 on hand worth 920, still equal to the Inventory account');

-- average cost
select is((select sum(l.debit) from public.journal_lines l join public.journal_entries e on e.id = l.entry_id
           join public.accounts a on a.id = l.account_id
           where e.document_id = current_setting('test.avgsale')::uuid and a.code = '5101'), 575.00,
  'weighted average: (1,000 + 1,300) ÷ 20 × 5 = 575');
select throws_ok($q$select public.set_cost_method(current_setting('test.co2')::uuid, 'fifo')$q$,
  'P0001', 'STOCK_COST_METHOD_LOCKED', 'the cost method is fixed once stock has moved');
select is(pg_temp.gl(current_setting('test.co2')::uuid, '1160'),
  (select sum(amount) from public.stock_movements where company_id = current_setting('test.co2')::uuid),
  'average company: Inventory account = stock value');

select * from finish();
rollback;
