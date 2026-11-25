-- M6: purchases — WHT income types (D6), 50 ทวิ certificates (D7), payer-borne tax (D8), attachments.
-- Run: npm run db:test
begin;
select plan(34);

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

create function tests.pay(p_dir text, p_contact text, p_amount numeric, p_wht numeric, p_allocs jsonb,
                          p_extra jsonb default '{}')
returns uuid language plpgsql as $$
declare v_id uuid;
begin
  v_id := public.save_payment(jsonb_build_object(
    'company_id', tests.co(), 'direction', p_dir, 'pay_date', '2026-11-26',
    'contact_id', tests.contact(p_contact), 'payment_account_id', tests.acc('1120'),
    'amount', p_amount, 'wht_amount', p_wht, 'allocations', p_allocs) || p_extra);
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
insert into public.contacts (company_id, code, name, contact_type, entity_type) values
  (tests.co(), 'VENI', 'Freelancer', 'vendor', 'individual'),
  (tests.co(), 'VENJ', 'Agency Co', 'vendor', 'juristic'),
  (tests.co(), 'CUS', 'Customer', 'customer', 'juristic');

-- ---------------------------------------------------------------------------
-- Setup: new account + mapping (D8), income types (D6)
-- ---------------------------------------------------------------------------
select is((select a.code from public.account_mappings m join public.accounts a on a.id = m.account_id
           where m.company_id = tests.co() and m.role = 'WHT_BORNE_EXPENSE'), '5285',
  'new companies map WHT_BORNE_EXPENSE to 5285');
select is((select section || ' ' || default_rate from public.wht_income_types where code = 'rent'), '40(5) 5.00',
  'income types carry section and default rate');
select is(public.wht_tax(10000, 3, 'pay_always'), 309.28, 'pay_always grosses up: 10,000 × 3 ÷ 97 = 309.28');
select is(public.wht_tax(10000, 3, 'pay_once'), 300.00, 'pay_once: 10,000 × 3% = 300');

-- ---------------------------------------------------------------------------
-- D6: purchase lines with WHT need an income type
-- ---------------------------------------------------------------------------
select throws_ok(
  $$ select tests.post('bill', 'VENI', '[{"item_kind":"service","qty":1,"unit_price":100,"wht_rate":3}]') $$,
  'P0001', 'WHT_INCOME_TYPE_REQUIRED', 'bill line with WHT but no income type is rejected');
select is(public.simulate_posting('document', jsonb_build_object('company_id', tests.co(), 'type', 'bill',
    'contact_id', tests.contact('VENI'),
    'lines', '[{"item_kind":"service","qty":1,"unit_price":100,"wht_rate":3}]'::jsonb)) ->> 'error',
  'WHT_INCOME_TYPE_REQUIRED', 'simulation reports the missing income type as data');
select throws_ok(
  $$ select tests.post('cash_sale', 'CUS', '[{"qty":1,"unit_price":100,"wht_rate":3}]',
       jsonb_build_object('payment_account_id', tests.acc('1120'), 'wht_condition', 'pay_always')) $$,
  'P0001', 'WHT_CONDITION_INVALID', 'sales cannot use payer-borne tax');

-- ---------------------------------------------------------------------------
-- Bill + payment, normal withholding (D7: ภ.ง.ด.3 for an individual)
-- ---------------------------------------------------------------------------
call tests.set('bill1', tests.post('bill', 'VENI',
  '[{"item_kind":"service","qty":1,"unit_price":10000,"wht_rate":3,"wht_income_type":"service"}]'));
call tests.set('pay1', tests.pay('paid', 'VENI', 10400, 300,
  jsonb_build_array(jsonb_build_object('document_id', tests.get('bill1'), 'amount', 10700, 'wht_amount', 300))));
select results_eq($$ select * from tests.jp(tests.get('pay1')) $$,
  $$ values ('2110'::text, 10700.00, 0.00), ('1140', 700.00, 0), ('1120', 0, 10400.00), ('2130', 0, 300.00),
            ('1141', 0, 700.00) $$,
  'withhold: Dr AP 10,700 + input VAT 700 / Cr bank 10,400 + WHT payable 300 + deferred VAT 700');
select is((select row(number, cert_date, form, condition, total_income, total_tax)::text
           from public.wht_certificates where payment_id = tests.get('pay1')),
  '(WHT-2026-0001,2026-11-26,pnd3,withhold,10000.00,300.00)',
  'certificate WHT-2026-0001 on the pay date, ภ.ง.ด.3, income 10,000 tax 300');
select is((select string_agg(income_type || ':' || wht_rate || ':' || income_amount || ':' || tax_amount, ',')
           from public.wht_certificate_lines l join public.wht_certificates w on w.id = l.certificate_id
           where w.payment_id = tests.get('pay1')),
  'service:3.00:10000.00:300.00', 'certificate line carries the income type');

-- ---------------------------------------------------------------------------
-- D8: payer bears the tax — always (gross-up), ภ.ง.ด.53 for a company
-- ---------------------------------------------------------------------------
call tests.set('bill2', tests.post('bill', 'VENJ',
  '[{"item_kind":"service","qty":1,"unit_price":10000,"wht_rate":3,"wht_income_type":"service"}]'));
select throws_ok(
  format($$ select tests.pay('paid', 'VENJ', 10400, 309.28,
    '[{"document_id":"%s","amount":10700,"wht_amount":309.28}]', '{"wht_condition":"pay_always"}') $$,
    tests.get('bill2')),
  'P0001', 'PAYMENT_NOT_ALLOCATED', 'borne tax: the vendor is paid the full amount (no deduction)');
call tests.set('pay2', tests.pay('paid', 'VENJ', 10700, 309.28,
  jsonb_build_array(jsonb_build_object('document_id', tests.get('bill2'), 'amount', 10700, 'wht_amount', 309.28)),
  '{"wht_condition":"pay_always"}'));
select results_eq($$ select * from tests.jp(tests.get('pay2')) $$,
  $$ values ('2110'::text, 10700.00, 0.00), ('1140', 700.00, 0), ('5285', 309.28, 0),
            ('1120', 0, 10700.00), ('2130', 0, 309.28), ('1141', 0, 700.00) $$,
  'pay_always: Dr AP 10,700 + borne tax 309.28 / Cr bank 10,700 + WHT payable 309.28');
select is((select row(number, form, condition, total_income, total_tax)::text
           from public.wht_certificates where payment_id = tests.get('pay2')),
  '(WHT-2026-0002,pnd53,pay_always,10309.28,309.28)',
  'pay_always certificate: ภ.ง.ด.53, income includes the borne tax (10,309.28)');
select is((public.document_balance(tests.get('bill2')) ->> 'outstanding')::numeric, 0.00,
  'bill fully settled by the borne-tax payment');

-- pay_once
call tests.set('bill3', tests.post('bill', 'VENJ',
  '[{"item_kind":"service","qty":1,"unit_price":10000,"wht_rate":3,"wht_income_type":"advertising"}]'));
call tests.set('pay3', tests.pay('paid', 'VENJ', 10700, 300,
  jsonb_build_array(jsonb_build_object('document_id', tests.get('bill3'), 'amount', 10700, 'wht_amount', 300)),
  '{"wht_condition":"pay_once"}'));
select is((select row(condition, total_income, total_tax)::text
           from public.wht_certificates where payment_id = tests.get('pay3')),
  '(pay_once,10000.00,300.00)', 'pay_once certificate: income 10,000, tax 300');
select is(tests.balance('5285'), 609.28, 'borne tax expense = 309.28 + 300');

-- ---------------------------------------------------------------------------
-- Cash purchase, pay_always (certificate dated the document date)
-- ---------------------------------------------------------------------------
call tests.set('cp', tests.post('cash_purchase', 'VENI',
  '[{"item_kind":"service","qty":1,"unit_price":5000,"wht_rate":5,"wht_income_type":"rent"}]',
  jsonb_build_object('payment_account_id', tests.acc('1120'), 'wht_condition', 'pay_always')));
select results_eq($$ select * from tests.je(tests.get('cp')) $$,
  $$ values ('5290'::text, 5000.00, 0.00), ('1140', 350.00, 0), ('5285', 263.16, 0),
            ('1120', 0, 5350.00), ('2130', 0, 263.16) $$,
  'cash purchase pay_always: Dr expense + VAT + borne 263.16 / Cr bank 5,350 + WHT payable 263.16');
select is((select row(wht_total, net_total)::text from public.documents where id = tests.get('cp')),
  '(263.16,5350.00)', 'document totals: tax 263.16, paid in full 5,350');
select is((select row(cert_date, form, total_income, total_tax)::text
           from public.wht_certificates where document_id = tests.get('cp')),
  '(2026-11-25,pnd3,5263.16,263.16)', 'cash purchase certificate on the document date');

-- ---------------------------------------------------------------------------
-- Partial payment, two income types: certificate covers the settled share
-- ---------------------------------------------------------------------------
call tests.set('bill4', tests.post('bill', 'VENJ',
  '[{"item_kind":"service","qty":1,"unit_price":6000,"wht_rate":3,"wht_income_type":"service"},
    {"item_kind":"service","qty":1,"unit_price":4000,"wht_rate":1,"wht_income_type":"transport"}]'));
call tests.set('pay4', tests.pay('paid', 'VENJ', 5240, 110,
  jsonb_build_array(jsonb_build_object('document_id', tests.get('bill4'), 'amount', 5350, 'wht_amount', 110))));
select results_eq(
  $$ select l.income_type, l.income_amount, l.tax_amount from public.wht_certificate_lines l
     join public.wht_certificates w on w.id = l.certificate_id
     where w.payment_id = tests.get('pay4') order by l.line_no $$,
  $$ values ('service'::text, 3000.00, 90.00), ('transport', 2000.00, 20.00) $$,
  'half payment: service 3,000 / tax 90 + transport 2,000 / tax 20');

-- Payment without WHT → no certificate
call tests.set('bill5', tests.post('bill', 'VENJ', '[{"item_kind":"product","qty":1,"unit_price":100}]'));
call tests.set('pay5', tests.pay('paid', 'VENJ', 107, 0,
  jsonb_build_array(jsonb_build_object('document_id', tests.get('bill5'), 'amount', 107))));
select is((select count(*)::int from public.wht_certificates where payment_id = tests.get('pay5')), 0,
  'no WHT → no certificate');

-- ---------------------------------------------------------------------------
-- Void → certificate voided (number kept)
-- ---------------------------------------------------------------------------
select lives_ok(format($$ select public.void_payment('%s', 'wrong amount') $$, tests.get('pay1')),
  'void the first payment');
select isnt((select voided_at from public.wht_certificates where payment_id = tests.get('pay1')), null,
  'its certificate is voided');
select is((select count(*)::int from public.wht_certificates where company_id = tests.co()), 5,
  'voided certificate is kept (numbers never reused)');

-- ---------------------------------------------------------------------------
-- Print data
-- ---------------------------------------------------------------------------
select is((select public.print_wht_certificate(id) #>> '{lines,0,section}'
           from public.wht_certificates where payment_id = tests.get('pay2')), '40(8)',
  'print data includes the section');
select is((select public.print_wht_certificate(id) #>> '{payee,name}'
           from public.wht_certificates where payment_id = tests.get('pay2')), 'Agency Co',
  'print data includes the payee');

-- ---------------------------------------------------------------------------
-- Permissions
-- ---------------------------------------------------------------------------
call tests.login('viewer@test.com');
select is((select count(*)::int from public.wht_certificates), 5, 'viewer can read certificates');
select throws_ok(
  format($$ insert into public.wht_certificates (company_id, number, cert_date, contact_id, form, condition,
    document_id, total_income, total_tax) values ('%s', 'X', '2026-01-01', '%s', 'pnd3', 'withhold', '%s', 0, 0) $$,
    tests.co(), tests.contact('VENI'), tests.get('bill1')),
  '42501', null, 'clients cannot write certificates');
select throws_ok(
  format($$ insert into public.attachments (company_id, document_id, storage_path, file_name)
            values ('%s', '%s', '%s/a.jpg', 'a.jpg') $$, tests.co(), tests.get('bill1'), tests.co()),
  '42501', null, 'viewer cannot attach files');

call tests.login('staff@test.com');
select lives_ok(
  format($$ insert into public.attachments (company_id, document_id, storage_path, file_name, mime_type)
            values ('%s', '%s', '%s/receipt.jpg', 'receipt.jpg', 'image/jpeg') $$,
         tests.co(), tests.get('bill1'), tests.co()),
  'staff can attach a file to a posted bill');
select throws_ok(
  format($$ insert into public.attachments (company_id, document_id, storage_path, file_name)
            values ('%s', '%s', 'other/b.jpg', 'b.jpg') $$, tests.co(), tests.get('bill1')),
  '23514', null, 'storage path must start with the company id');
select lives_ok(
  format($$ insert into storage.objects (bucket_id, name, owner_id) values ('attachments', '%s/x.jpg', auth.uid()::text) $$,
         tests.co()),
  'staff can upload into the company folder');
select throws_ok(
  $$ insert into storage.objects (bucket_id, name) values ('attachments', '00000000-0000-0000-0000-000000000000/x.jpg') $$,
  '42501', null, 'cannot upload into another company''s folder');

reset role;
set local role anon;
select throws_ok($$ select count(*) from public.wht_income_types $$, '42501', null, 'anon cannot read income types');

select * from finish();
rollback;
