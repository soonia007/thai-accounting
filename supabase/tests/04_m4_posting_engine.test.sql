-- M4: posting engine — every row of the posting rules (spec §2) + docs/DECISIONS.md D1–D5.
-- Run: npm run db:test
-- Company: trading, VAT registered 7%. Account codes from the template (see m1_account_templates).
begin;
select plan(63);

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create schema tests;
grant usage on schema tests to authenticated, anon;

create procedure tests.create_user(p_email text) language sql as $$
  insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at)
  values (gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
          p_email, '{}'::jsonb, now(), now());
$$;

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
grant execute on procedure tests.login(text) to authenticated;

create function tests.co() returns uuid language sql stable as $$
  select current_setting('test.company')::uuid $$;
create function tests.acc(p_code text) returns uuid language sql stable as $$
  select id from public.accounts where company_id = tests.co() and code = p_code $$;
create function tests.product(p_code text) returns uuid language sql stable as $$
  select id from public.products where company_id = tests.co() and code = p_code $$;
create function tests.contact(p_code text) returns uuid language sql stable as $$
  select id from public.contacts where company_id = tests.co() and code = p_code $$;

-- Save + post a document, return its id
create function tests.post(p_type text, p_contact text, p_lines jsonb, p_extra jsonb default '{}')
returns uuid language plpgsql as $$
declare v_id uuid;
begin
  v_id := public.save_document(jsonb_build_object(
    'company_id', tests.co(), 'type', p_type, 'doc_date', '2026-11-25',
    'contact_id', tests.contact(p_contact), 'lines', p_lines) || p_extra);
  perform public.post_document(v_id);
  return v_id;
end;
$$;

create function tests.pay(p_dir text, p_contact text, p_amount numeric, p_wht numeric, p_allocs jsonb)
returns uuid language plpgsql as $$
declare v_id uuid;
begin
  v_id := public.save_payment(jsonb_build_object(
    'company_id', tests.co(), 'direction', p_dir, 'pay_date', '2026-11-26',
    'contact_id', tests.contact(p_contact), 'payment_account_id', tests.acc('1120'),
    'amount', p_amount, 'wht_amount', p_wht, 'allocations', p_allocs));
  perform public.post_payment(v_id);
  return v_id;
end;
$$;

-- Journal of a document / payment (original entry, not the reversal) as code|debit|credit rows
create function tests.je(p_document uuid) returns table (code text, debit numeric, credit numeric)
language sql stable as $$
  select a.code, jl.debit, jl.credit
  from public.journal_entries je
  join public.journal_lines jl on jl.entry_id = je.id
  join public.accounts a on a.id = jl.account_id
  where je.document_id = p_document and je.reverses_entry_id is null
  order by jl.line_no
$$;
create function tests.jp(p_payment uuid) returns table (code text, debit numeric, credit numeric)
language sql stable as $$
  select a.code, jl.debit, jl.credit
  from public.journal_entries je
  join public.journal_lines jl on jl.entry_id = je.id
  join public.accounts a on a.id = jl.account_id
  where je.payment_id = p_payment and je.reverses_entry_id is null
  order by jl.line_no
$$;
create function tests.balance(p_code text) returns numeric language sql stable as $$
  select coalesce(sum(jl.debit - jl.credit), 0) from public.journal_lines jl
  where jl.account_id = tests.acc(p_code)
$$;
grant execute on all functions in schema tests to authenticated;

create procedure tests.set(p_key text, p_value uuid) language plpgsql as $$
begin perform set_config('test.' || p_key, p_value::text, false); end $$;
grant execute on procedure tests.set(text, uuid) to authenticated;
create function tests.get(p_key text) returns uuid language sql stable as $$
  select current_setting('test.' || p_key)::uuid $$;
grant execute on function tests.get(text) to authenticated;

call tests.create_user('owner@test.com');
call tests.create_user('staff@test.com');
call tests.create_user('viewer@test.com');

call tests.login('owner@test.com');
do $$ begin perform set_config('test.company',
  public.create_company('VAT Co', 'trading', '0105536000313', '00000', null, null, true, 7)::text, false); end $$;
reset role;
insert into public.company_members (company_id, user_id, role)
select tests.co(), id, 'staff' from auth.users where email = 'staff@test.com';
insert into public.company_members (company_id, user_id, role)
select tests.co(), id, 'viewer' from auth.users where email = 'viewer@test.com';

call tests.login('owner@test.com');
insert into public.contacts (company_id, code, name, contact_type) values
  (tests.co(), 'CUS', 'Customer', 'customer'),
  (tests.co(), 'CUS2', 'Customer 2', 'customer'),
  (tests.co(), 'VEN', 'Vendor', 'vendor');
insert into public.products (company_id, code, name, kind, expense_account_id)
values (tests.co(), 'GOODS', 'Goods', 'product', tests.acc('5110'));

-- ---------------------------------------------------------------------------
-- Line math (half-up per line)
-- ---------------------------------------------------------------------------
select is((select row(base_amount, vat_amount, wht_amount)::text
           from public.calc_line(1, 1.5, 0, 'exclusive', 7, 3)),
  '(1.50,0.11,0.05)', 'VAT 0.105 → 0.11 and WHT 0.045 → 0.05 (half-up)');
select is((select row(base_amount, vat_amount, wht_amount)::text
           from public.calc_line(1, 1070, 0, 'inclusive', 7, 0)),
  '(1000.00,70.00,0.00)', 'inclusive: 1,070 → base 1,000 + VAT 70');
select is((select row(base_amount, vat_amount, wht_amount)::text
           from public.calc_line(3, 33.333, 0, 'exclusive', 7, 0)),
  '(100.00,7.00,0.00)', 'qty × price rounded per line (99.999 → 100.00)');
select is((select row(base_amount, vat_amount, wht_amount)::text
           from public.calc_line(2, 500, 100, 'none', 7, 5)),
  '(900.00,0.00,45.00)', 'no VAT; discount reduces the base; WHT on base');
select throws_ok($$ select * from public.calc_line(1, 10, 20, 'exclusive', 7, 0) $$,
  'P0001', 'LINE_NEGATIVE', 'discount larger than the line is rejected');

-- ---------------------------------------------------------------------------
-- Sales: invoice (ขายเชื่อ)
-- ---------------------------------------------------------------------------
call tests.set('inv_service', tests.post('invoice', 'CUS',
  '[{"item_kind":"service","qty":1,"unit_price":10000}]'));
select results_eq($$ select * from tests.je(tests.get('inv_service')) $$,
  $$ values ('1130'::text, 10700.00, 0.00), ('4100', 0, 10000.00), ('2121', 0, 700.00) $$,
  'invoice (service): Dr AR 10,700 / Cr revenue 10,000 / Cr deferred output VAT 700 (D1)');
select is((select number from public.documents where id = tests.get('inv_service')), 'INV-2026-0001',
  'first invoice is numbered INV-2026-0001');
select is((select row(subtotal, vat_total, vat_deferred_total, total)::text
           from public.documents where id = tests.get('inv_service')),
  '(10000.00,700.00,700.00,10700.00)', 'invoice totals stored on post');

call tests.set('inv_goods', tests.post('invoice', 'CUS',
  '[{"item_kind":"product","qty":2,"unit_price":1000}]'));
select results_eq($$ select * from tests.je(tests.get('inv_goods')) $$,
  $$ values ('1130'::text, 2140.00, 0.00), ('4100', 0, 2000.00), ('2120', 0, 140.00) $$,
  'invoice (goods): output VAT immediately');

call tests.set('inv_incl', tests.post('invoice', 'CUS',
  '[{"item_kind":"product","qty":1,"unit_price":1070}]', '{"vat_mode":"inclusive"}'));
select results_eq($$ select * from tests.je(tests.get('inv_incl')) $$,
  $$ values ('1130'::text, 1070.00, 0.00), ('4100', 0, 1000.00), ('2120', 0, 70.00) $$,
  'invoice VAT-inclusive 1,070 → revenue 1,000 + VAT 70');

call tests.set('inv_mixed', tests.post('invoice', 'CUS',
  '[{"item_kind":"service","qty":1,"unit_price":500},{"item_kind":"product","qty":1,"unit_price":300}]'));
select results_eq($$ select * from tests.je(tests.get('inv_mixed')) $$,
  $$ values ('1130'::text, 856.00, 0.00), ('4100', 0, 800.00), ('2120', 0, 21.00), ('2121', 0, 35.00) $$,
  'mixed invoice: goods VAT → 2120, service VAT → 2121, revenue lines aggregated');

call tests.set('inv_novat', tests.post('invoice', 'CUS',
  '[{"item_kind":"service","qty":1,"unit_price":1000}]', '{"vat_mode":"none"}'));
select results_eq($$ select * from tests.je(tests.get('inv_novat')) $$,
  $$ values ('1130'::text, 1000.00, 0.00), ('4100', 0, 1000.00) $$,
  'invoice without VAT');

select results_eq(
  $$ select number from public.documents where company_id = tests.co() and type = 'invoice' order by number $$,
  $$ values ('INV-2026-0001'::text), ('INV-2026-0002'), ('INV-2026-0003'), ('INV-2026-0004'), ('INV-2026-0005') $$,
  'invoice numbers are consecutive with no gaps');

-- ---------------------------------------------------------------------------
-- Receipts (รับชำระ) incl. WHT and deferred VAT transfer
-- ---------------------------------------------------------------------------
call tests.set('rcv_full', tests.pay('received', 'CUS', 10400, 300,
  jsonb_build_array(jsonb_build_object('document_id', tests.get('inv_service'), 'amount', 10700, 'wht_amount', 300))));
select results_eq($$ select * from tests.jp(tests.get('rcv_full')) $$,
  $$ values ('1120'::text, 10400.00, 0.00), ('1150', 300.00, 0), ('2121', 700.00, 0),
            ('1130', 0, 10700.00), ('2120', 0, 700.00) $$,
  'receipt with WHT 3%: Dr bank 10,400 + WHT 300 / Cr AR 10,700; deferred VAT 700 → output VAT (D1)');
select is((select number from public.payments where id = tests.get('rcv_full')), 'RV-2026-0001',
  'receipt numbered RV-2026-0001');
select is((public.document_balance(tests.get('inv_service')) ->> 'outstanding')::numeric, 0.00,
  'fully paid invoice has nothing outstanding');

call tests.set('rcv_half', tests.pay('received', 'CUS', 428, 0,
  jsonb_build_array(jsonb_build_object('document_id', tests.get('inv_mixed'), 'amount', 428))));
select results_eq($$ select * from tests.jp(tests.get('rcv_half')) $$,
  $$ values ('1120'::text, 428.00, 0.00), ('2121', 17.50, 0), ('1130', 0, 428.00), ('2120', 0, 17.50) $$,
  'partial receipt realises deferred VAT pro rata: 35 × 428 / 856 = 17.50');

-- notes against a partially paid service invoice are blocked (D5)
select throws_ok(
  $$ select tests.post('credit_note', 'CUS', '[{"item_kind":"service","qty":1,"unit_price":100}]',
       jsonb_build_object('ref_document_id', tests.get('inv_mixed'))) $$,
  'P0001', 'NOTE_REF_PARTIALLY_PAID', 'credit note on a partly paid service invoice is blocked (D5)');

select throws_ok(
  $$ select tests.pay('received', 'CUS', 500, 0,
       jsonb_build_array(jsonb_build_object('document_id', tests.get('inv_mixed'), 'amount', 500))) $$,
  'P0001', 'ALLOCATION_EXCEEDS_OUTSTANDING', 'cannot receive more than is outstanding');
select throws_ok(
  $$ select tests.pay('received', 'CUS', 100, 0,
       jsonb_build_array(jsonb_build_object('document_id', tests.get('inv_mixed'), 'amount', 200))) $$,
  'P0001', 'PAYMENT_NOT_ALLOCATED', 'allocations must equal amount + WHT');
select throws_ok(
  $$ select tests.pay('received', 'CUS2', 100, 0,
       jsonb_build_array(jsonb_build_object('document_id', tests.get('inv_mixed'), 'amount', 100))) $$,
  'P0001', 'ALLOCATION_CONTACT_MISMATCH', 'cannot settle another customer''s invoice');

call tests.set('rcv_rest', tests.pay('received', 'CUS', 428, 0,
  jsonb_build_array(jsonb_build_object('document_id', tests.get('inv_mixed'), 'amount', 428))));
select results_eq($$ select * from tests.jp(tests.get('rcv_rest')) $$,
  $$ values ('1120'::text, 428.00, 0.00), ('2121', 17.50, 0), ('1130', 0, 428.00), ('2120', 0, 17.50) $$,
  'final receipt takes the remaining deferred VAT');
select is((public.document_balance(tests.get('inv_mixed')) ->> 'deferred_vat_remaining')::numeric, 0.00,
  'no deferred VAT left after full payment');

-- ---------------------------------------------------------------------------
-- Cash sale (ขายเงินสด)
-- ---------------------------------------------------------------------------
call tests.set('cash_sale', tests.post('cash_sale', 'CUS',
  '[{"item_kind":"service","qty":1,"unit_price":1000,"wht_rate":3}]',
  jsonb_build_object('payment_account_id', tests.acc('1120'))));
select results_eq($$ select * from tests.je(tests.get('cash_sale')) $$,
  $$ values ('1120'::text, 1040.00, 0.00), ('1150', 30.00, 0), ('4100', 0, 1000.00), ('2120', 0, 70.00) $$,
  'cash sale: Dr bank 1,040 + WHT 30 / Cr revenue 1,000 + output VAT 70 (paid → no deferral)');
select is((select number from public.documents where id = tests.get('cash_sale')), 'CS-2026-0001',
  'cash sale has its own number series');
select throws_ok(
  $$ select tests.post('cash_sale', 'CUS', '[{"qty":1,"unit_price":10}]') $$,
  'P0001', 'PAYMENT_ACCOUNT_REQUIRED', 'cash sale needs a cash/bank account');

-- ---------------------------------------------------------------------------
-- Credit / debit notes (D4, D5)
-- ---------------------------------------------------------------------------
call tests.set('inv_open', tests.post('invoice', 'CUS', '[{"item_kind":"service","qty":1,"unit_price":2000}]'));

call tests.set('cn_unpaid', tests.post('credit_note', 'CUS', '[{"item_kind":"service","qty":1,"unit_price":500}]',
  jsonb_build_object('ref_document_id', tests.get('inv_open'))));
select results_eq($$ select * from tests.je(tests.get('cn_unpaid')) $$,
  $$ values ('4110'::text, 500.00, 0.00), ('2121', 35.00, 0), ('1130', 0, 535.00) $$,
  'credit note on unpaid service invoice: Dr sales returns (D4) + deferred VAT (D5) / Cr AR');
select is((public.document_balance(tests.get('inv_open')) ->> 'outstanding')::numeric, 1605.00,
  'credit note reduces what the customer owes (2,140 − 535)');
select is((public.document_balance(tests.get('inv_open')) ->> 'deferred_vat_remaining')::numeric, 105.00,
  'and the deferred VAT still to realise (140 − 35)');

call tests.set('cn_paid', tests.post('credit_note', 'CUS', '[{"item_kind":"service","qty":1,"unit_price":1000}]',
  jsonb_build_object('ref_document_id', tests.get('inv_service'))));
select results_eq($$ select * from tests.je(tests.get('cn_paid')) $$,
  $$ values ('4110'::text, 1000.00, 0.00), ('2120', 70.00, 0), ('1130', 0, 1070.00) $$,
  'credit note on fully paid service invoice adjusts output VAT (D5)');

select throws_ok(
  $$ select tests.post('credit_note', 'CUS', '[{"item_kind":"service","qty":1,"unit_price":10000}]',
       jsonb_build_object('ref_document_id', tests.get('inv_service'))) $$,
  'P0001', 'CREDIT_NOTE_EXCEEDS', 'cannot credit more than the invoice minus earlier credit notes');
select throws_ok(
  $$ select tests.post('credit_note', 'CUS', '[{"qty":1,"unit_price":10}]') $$,
  'P0001', 'NOTE_REF_REQUIRED', 'credit note must reference an invoice');

call tests.set('dn', tests.post('debit_note', 'CUS', '[{"item_kind":"service","qty":1,"unit_price":100}]',
  jsonb_build_object('ref_document_id', tests.get('inv_open'))));
select results_eq($$ select * from tests.je(tests.get('dn')) $$,
  $$ values ('1130'::text, 107.00, 0.00), ('4100', 0, 100.00), ('2121', 0, 7.00) $$,
  'debit note on unpaid service invoice: Dr AR / Cr revenue + deferred VAT (D5)');

-- ---------------------------------------------------------------------------
-- Purchases: bill (ซื้อเชื่อ), payment (จ่ายชำระ), cash purchase (ซื้อเงินสด)
-- ---------------------------------------------------------------------------
call tests.set('bill_service', tests.post('bill', 'VEN', '[{"item_kind":"service","qty":1,"unit_price":5000}]'));
select results_eq($$ select * from tests.je(tests.get('bill_service')) $$,
  $$ values ('5290'::text, 5000.00, 0.00), ('1141', 350.00, 0), ('2110', 0, 5350.00) $$,
  'bill (service): Dr default expense + deferred input VAT (D2) / Cr AP');
select is((select number from public.documents where id = tests.get('bill_service')), 'EXP-2026-0001',
  'bill numbered EXP-2026-0001');

call tests.set('bill_goods', tests.post('bill', 'VEN',
  jsonb_build_array(jsonb_build_object('product_id', tests.product('GOODS'),
                                       'qty', 1, 'unit_price', 1000))));
select results_eq($$ select * from tests.je(tests.get('bill_goods')) $$,
  $$ values ('5110'::text, 1000.00, 0.00), ('1140', 70.00, 0), ('2110', 0, 1070.00) $$,
  'bill (goods via product): product expense account + input VAT immediately');

call tests.set('pay_bill', tests.pay('paid', 'VEN', 5200, 150,
  jsonb_build_array(jsonb_build_object('document_id', tests.get('bill_service'), 'amount', 5350, 'wht_amount', 150))));
select results_eq($$ select * from tests.jp(tests.get('pay_bill')) $$,
  $$ values ('2110'::text, 5350.00, 0.00), ('1140', 350.00, 0), ('1120', 0, 5200.00),
            ('2130', 0, 150.00), ('1141', 0, 350.00) $$,
  'payment with WHT 3%: Dr AP 5,350 / Cr bank 5,200 + WHT payable 150; deferred input VAT → input VAT (D2)');
select is((select number from public.payments where id = tests.get('pay_bill')), 'PV-2026-0001',
  'payment voucher numbered PV-2026-0001');

call tests.set('cash_purchase', tests.post('cash_purchase', 'VEN',
  '[{"item_kind":"product","qty":1,"unit_price":2000,"wht_rate":1}]',
  jsonb_build_object('payment_account_id', tests.acc('1120'))));
select results_eq($$ select * from tests.je(tests.get('cash_purchase')) $$,
  $$ values ('5290'::text, 2000.00, 0.00), ('1140', 140.00, 0), ('1120', 0, 2120.00), ('2130', 0, 20.00) $$,
  'cash purchase with WHT 1%: Dr expense + input VAT / Cr bank + WHT payable');

-- ---------------------------------------------------------------------------
-- Documents that do not post
-- ---------------------------------------------------------------------------
call tests.set('quote', tests.post('quotation', 'CUS', '[{"qty":1,"unit_price":100}]'));
select is((select row(status, number)::text from public.documents where id = tests.get('quote')),
  '(posted,QT-2026-0001)', 'quotation gets a number when issued');
select is((select count(*)::int from public.journal_entries where document_id = tests.get('quote')), 0,
  'quotation creates no journal entry');

-- ---------------------------------------------------------------------------
-- Simulation = posting (docs/DESIGN_SIMULATION.md)
-- ---------------------------------------------------------------------------
do $$ begin perform set_config('test.sim', public.simulate_posting('document', jsonb_build_object(
  'company_id', tests.co(), 'type', 'invoice', 'doc_date', '2026-11-25', 'contact_id', tests.contact('CUS2'),
  'lines', '[{"item_kind":"service","qty":3,"unit_price":333.33,"discount":10},{"item_kind":"product","qty":1,"unit_price":99.99}]'::jsonb))::text,
  false); end $$;
call tests.set('inv_sim', tests.post('invoice', 'CUS2',
  '[{"item_kind":"service","qty":3,"unit_price":333.33,"discount":10},{"item_kind":"product","qty":1,"unit_price":99.99}]'));
select results_eq(
  $$ select x ->> 'code', (x ->> 'debit')::numeric, (x ->> 'credit')::numeric
     from jsonb_array_elements(current_setting('test.sim')::jsonb -> 'lines') x $$,
  $$ select * from tests.je(tests.get('inv_sim')) $$,
  'simulate_posting returns exactly the journal that post_document writes');
select is((current_setting('test.sim')::jsonb #>> '{lines,0,opening_balance}')::numeric,
  (select sum(jl.debit - jl.credit) from public.journal_lines jl
   join public.journal_entries je on je.id = jl.entry_id
   where jl.account_id = tests.acc('1130') and je.entry_date <= '2026-11-25'
     and je.document_id is distinct from tests.get('inv_sim') and je.reverses_entry_id is null),
  'simulation reports each account''s balance before the document (AR as of the document date)');
select is((public.simulate_posting('document', jsonb_build_object('company_id', tests.co(), 'type', 'cash_sale',
  'lines', '[{"qty":1,"unit_price":10}]'::jsonb)) ->> 'error'), 'PAYMENT_ACCOUNT_REQUIRED',
  'simulation returns rule errors as data instead of failing');
reset role; -- count as superuser (doc_sequences is not readable by users); JWT claims still identify the owner
do $$ begin
  perform set_config('test.counts_before', (select (select count(*) from public.journal_entries)
    + (select count(*) from public.documents) + (select count(*) from public.doc_sequences
       where last_number > 0))::text, false);
  perform public.simulate_posting('document', jsonb_build_object('company_id', tests.co(), 'type', 'invoice',
    'contact_id', tests.contact('CUS'), 'lines', '[{"qty":1,"unit_price":100}]'::jsonb));
  perform public.simulate_posting('payment', jsonb_build_object('company_id', tests.co(), 'direction', 'received',
    'contact_id', tests.contact('CUS'), 'payment_account_id', tests.acc('1120'), 'amount', 10,
    'allocations', jsonb_build_array(jsonb_build_object('document_id', tests.get('inv_open'), 'amount', 10))));
end $$;
select is((select (select count(*) from public.journal_entries) + (select count(*) from public.documents)
                  + (select count(*) from public.doc_sequences where last_number > 0))::text,
  current_setting('test.counts_before'),
  'simulation writes nothing (no journal, document or number used)');
call tests.login('owner@test.com');

do $$ begin perform set_config('test.novat_co', public.create_company('No VAT Co', 'service')::text, false); end $$;
select is(
  (public.simulate_posting('document', jsonb_build_object('company_id', current_setting('test.novat_co')::uuid,
     'type', 'invoice', 'vat_mode', 'exclusive', 'lines', '[{"qty":1,"unit_price":1000}]'::jsonb)) -> 'totals')::text,
  '{"total": 1000.00, "subtotal": 1000.00, "net_total": 1000.00, "vat_total": 0.00, "wht_total": 0.00, "vat_deferred_total": 0.00}',
  'a company that is not VAT registered never charges VAT, whatever the document says');

-- ---------------------------------------------------------------------------
-- Void (D3) and immutability
-- ---------------------------------------------------------------------------
select throws_ok($$ select public.void_document(tests.get('inv_service'), 'oops') $$,
  'P0001', 'DOCUMENT_HAS_PAYMENTS', 'cannot void an invoice that has payments');

call tests.login('staff@test.com');
select throws_ok($$ select public.void_document(tests.get('inv_goods'), 'x') $$,
  '42501', null, 'staff cannot void');
call tests.login('viewer@test.com');
select throws_ok(
  $$ select public.save_document(jsonb_build_object('company_id', tests.co(), 'type', 'invoice', 'lines', '[]'::jsonb)) $$,
  '42501', null, 'viewer cannot create documents');
call tests.login('owner@test.com');

select lives_ok($$ select public.void_document(tests.get('inv_goods'), 'ลูกค้ายกเลิก') $$, 'owner can void');
select results_eq(
  $$ select a.code, jl.debit, jl.credit, je.entry_date from public.journal_entries je
     join public.journal_lines jl on jl.entry_id = je.id join public.accounts a on a.id = jl.account_id
     where je.document_id = tests.get('inv_goods') and je.reverses_entry_id is not null order by jl.line_no $$,
  $$ values ('1130'::text, 0.00, 2140.00, '2026-11-25'::date), ('4100', 2000.00, 0, '2026-11-25'),
            ('2120', 140.00, 0, '2026-11-25') $$,
  'void writes a reversing entry on the original date (D3)');
select is((select status::text from public.documents where id = tests.get('inv_goods')), 'voided',
  'document is marked voided');

select lives_ok($$ select public.void_payment(tests.get('rcv_rest'), 'ผิดบัญชี') $$, 'payment can be voided');
select is((public.document_balance(tests.get('inv_mixed')) ->> 'outstanding')::numeric, 428.00,
  'voided payment no longer counts toward the invoice');

select throws_ok($$ update public.documents set notes = 'x' where id = tests.get('inv_novat') $$,
  'P0001', 'DOCUMENT_NOT_DRAFT', 'posted documents cannot be edited');
select throws_ok($$ delete from public.documents where id = tests.get('inv_novat') $$,
  'P0001', 'DOCUMENT_NOT_DRAFT', 'posted documents cannot be deleted');
select throws_ok($$ update public.document_lines set qty = 9 where document_id = tests.get('inv_novat') $$,
  'P0001', 'DOCUMENT_NOT_DRAFT', 'lines of posted documents cannot be edited');

reset role;
select throws_ok($$ update public.journal_lines set debit = debit where true $$,
  'P0001', 'IMMUTABLE_RECORD', 'journal lines are append-only');
create function tests.unbalanced() returns void language plpgsql as $$
declare v_entry uuid;
begin
  insert into public.journal_entries (company_id, entry_date) values (tests.co(), '2026-11-25') returning id into v_entry;
  insert into public.journal_lines (company_id, entry_id, line_no, account_id, debit, credit)
  values (tests.co(), v_entry, 1, tests.acc('1110'), 100, 0), (tests.co(), v_entry, 2, tests.acc('4100'), 0, 90);
  set constraints public.journal_lines_balanced immediate;
end $$;
select throws_ok($$ select tests.unbalanced() $$, 'P0001', 'JOURNAL_NOT_BALANCED',
  'an unbalanced entry is rejected by the database');
select throws_ok(
  $$ insert into public.journal_lines (company_id, entry_id, line_no, account_id, debit)
     select tests.co(), id, 99, tests.acc('1000'), 1 from public.journal_entries where company_id = tests.co() limit 1 $$,
  'P0001', 'JOURNAL_GROUP_ACCOUNT', 'cannot post to a group account');

-- ---------------------------------------------------------------------------
-- Whole-ledger checks
-- ---------------------------------------------------------------------------
select is((select sum(debit) - sum(credit) from public.journal_lines where company_id = tests.co()), 0.00,
  'the ledger balances overall');
select is(tests.balance('1130'),
  (select sum(o) from (select (public.document_balance(id) ->> 'outstanding')::numeric as o
                       from public.documents where company_id = tests.co()
                         and type in ('invoice', 'debit_note') and status = 'posted') s),
  'AR in the ledger equals the sum of open invoices and debit notes');
select is((select count(*)::int from public.audit_logs
           where company_id = tests.co() and table_name = 'documents' and action in ('post', 'void')),
  (select count(*)::int from public.documents where company_id = tests.co() and status <> 'draft')
  + (select count(*)::int from public.documents where company_id = tests.co() and status = 'voided'),
  'every post and void is in the audit log');

select * from finish();
rollback;
