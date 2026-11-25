-- M11 withholding-tax reports against hand-calculated figures (spec Phase 2 §0.3).
-- Run: npm run db:test
--
-- November 2026, our withholding (50 ทวิ issued):
--   I1 cash purchase, individual, service 10,000 @3%                  → PND.3   300
--   I2 cash purchase, company, rent 20,000 @5% + transport 5,000 @1%   → PND.53  1,000 + 50
--   I3 bill, company, service 4,000 @3%, paid 20 Nov (cert on payment) → PND.53  120
--   I4 cash purchase, individual, service 9,700 @3% borne by us (D8: ×3/97 = 300; income 10,000) → PND.3 300
--   I5 cash purchase, company, service 1,000 @3%, voided               → not in PND.53, flagged in the register
--   PND.3: income 20,000, tax 600 · PND.53: income 29,000, tax 1,170
-- Tax withheld from us:
--   R1 cash sale service 10,000, customer withholds 3%                 → 300
--   R2 invoice service 5,000, receipt withholds 150 (cert C-777)       → 150
--   received: income 15,000, tax 450
begin;
select plan(14);

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
        'owner@wht.test', '{}', now(), now()),
       (gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
        'other@wht.test', '{}', now(), now());

call tests.login('owner@wht.test');
do $$
declare
  v_co uuid; v_ind uuid; v_jur uuid; v_cus uuid; v_bank uuid; v_doc uuid; v_pay uuid;
begin
  v_co := public.create_company('WHT Co', 'service', null, '00000', null, null, true, 7);
  perform set_config('test.co', v_co::text, false);
  insert into public.contacts (company_id, code, name, contact_type, entity_type)
    values (v_co, 'V1', 'Somchai', 'vendor', 'individual') returning id into v_ind;
  insert into public.contacts (company_id, code, name, contact_type, entity_type)
    values (v_co, 'V2', 'Vendor Co', 'vendor', 'juristic') returning id into v_jur;
  insert into public.contacts (company_id, code, name, contact_type)
    values (v_co, 'C1', 'Customer Co', 'customer') returning id into v_cus;
  select id into v_bank from public.accounts where company_id = v_co and code = '1120';

  -- I1
  perform public.post_document(public.save_document(jsonb_build_object('company_id', v_co,
    'type', 'cash_purchase', 'doc_date', '2026-11-03', 'contact_id', v_ind, 'payment_account_id', v_bank,
    'vat_mode', 'none',
    'lines', '[{"item_kind":"service","qty":1,"unit_price":10000,"wht_rate":3,"wht_income_type":"service"}]'::jsonb)));
  -- I2
  perform public.post_document(public.save_document(jsonb_build_object('company_id', v_co,
    'type', 'cash_purchase', 'doc_date', '2026-11-05', 'contact_id', v_jur, 'payment_account_id', v_bank,
    'vat_mode', 'none',
    'lines', '[{"item_kind":"service","qty":1,"unit_price":20000,"wht_rate":5,"wht_income_type":"rent"},
               {"item_kind":"service","qty":1,"unit_price":5000,"wht_rate":1,"wht_income_type":"transport"}]'::jsonb)));
  -- I3 bill + payment
  v_doc := public.save_document(jsonb_build_object('company_id', v_co, 'type', 'bill',
    'doc_date', '2026-11-06', 'contact_id', v_jur, 'vat_mode', 'none',
    'lines', '[{"item_kind":"service","qty":1,"unit_price":4000,"wht_rate":3,"wht_income_type":"service"}]'::jsonb));
  perform public.post_document(v_doc);
  v_pay := public.save_payment(jsonb_build_object('company_id', v_co, 'direction', 'paid',
    'pay_date', '2026-11-20', 'contact_id', v_jur, 'payment_account_id', v_bank, 'amount', 3880, 'wht_amount', 120,
    'allocations', jsonb_build_array(jsonb_build_object('document_id', v_doc, 'amount', 4000, 'wht_amount', 120))));
  perform public.post_payment(v_pay);
  -- I4 borne by us
  perform public.post_document(public.save_document(jsonb_build_object('company_id', v_co,
    'type', 'cash_purchase', 'doc_date', '2026-11-10', 'contact_id', v_ind, 'payment_account_id', v_bank,
    'vat_mode', 'none', 'wht_condition', 'pay_always',
    'lines', '[{"item_kind":"service","qty":1,"unit_price":9700,"wht_rate":3,"wht_income_type":"service"}]'::jsonb)));
  -- I5 voided
  v_doc := public.save_document(jsonb_build_object('company_id', v_co,
    'type', 'cash_purchase', 'doc_date', '2026-11-12', 'contact_id', v_jur, 'payment_account_id', v_bank,
    'vat_mode', 'none',
    'lines', '[{"item_kind":"service","qty":1,"unit_price":1000,"wht_rate":3,"wht_income_type":"service"}]'::jsonb));
  perform public.post_document(v_doc);
  perform public.void_document(v_doc, 'duplicate');

  -- R1
  v_doc := public.save_document(jsonb_build_object('company_id', v_co, 'type', 'cash_sale',
    'doc_date', '2026-11-07', 'contact_id', v_cus, 'payment_account_id', v_bank,
    'lines', '[{"item_kind":"service","qty":1,"unit_price":10000,"wht_rate":3}]'::jsonb));
  perform public.post_document(v_doc);
  perform set_config('test.r1', v_doc::text, false);
  -- R2 invoice + receipt with WHT
  v_doc := public.save_document(jsonb_build_object('company_id', v_co, 'type', 'invoice',
    'doc_date', '2026-11-08', 'contact_id', v_cus,
    'lines', '[{"item_kind":"service","qty":1,"unit_price":5000,"wht_rate":3}]'::jsonb));
  perform public.post_document(v_doc);
  v_pay := public.save_payment(jsonb_build_object('company_id', v_co, 'direction', 'received',
    'pay_date', '2026-11-25', 'contact_id', v_cus, 'payment_account_id', v_bank, 'amount', 5200, 'wht_amount', 150,
    'allocations', jsonb_build_array(jsonb_build_object('document_id', v_doc, 'amount', 5350, 'wht_amount', 150))));
  perform public.post_payment(v_pay);
  perform set_config('test.r2pay', v_pay::text, false);
end $$;

create function pg_temp.co() returns uuid language sql as $$ select current_setting('test.co')::uuid $$;
create function pg_temp.total(p jsonb, k text) returns numeric language sql as
  $$ select coalesce(sum((r ->> k)::numeric), 0) from jsonb_array_elements(p) r $$;
create function pg_temp.pnd(f public.wht_form) returns jsonb language sql as
  $$ select public.report_wht_pnd(pg_temp.co(), '2026-11-01', '2026-11-30', f) $$;

-- PND.3
select is(jsonb_array_length(pg_temp.pnd('pnd3')), 2, 'PND.3 attachment: I1 and I4');
select is(pg_temp.total(pg_temp.pnd('pnd3'), 'income'), 20000.00, 'PND.3 income 20,000 (borne tax grossed up)');
select is(pg_temp.total(pg_temp.pnd('pnd3'), 'tax'), 600.00, 'PND.3 tax 600');
select is((select count(*)::int from jsonb_array_elements(pg_temp.pnd('pnd3')) r where r ->> 'condition' = 'pay_always'), 1,
  'the borne-tax line carries its condition (column "เงื่อนไข")');
-- PND.53
select is(jsonb_array_length(pg_temp.pnd('pnd53')), 3, 'PND.53 attachment: rent + transport + the bill payment (voided excluded)');
select is(pg_temp.total(pg_temp.pnd('pnd53'), 'income'), 29000.00, 'PND.53 income 29,000');
select is(pg_temp.total(pg_temp.pnd('pnd53'), 'tax'), 1170.00, 'PND.53 tax 1,170');
select is((select string_agg(r ->> 'section', ',' order by r ->> 'section')
           from jsonb_array_elements(pg_temp.pnd('pnd53')) r), '40(5),40(8),40(8)',
  'income types keep their section 40 references');

-- issued register
select is(jsonb_array_length(public.report_wht_certificates(pg_temp.co(), '2026-11-01', '2026-11-30')), 5,
  'register lists all five certificates');
select is((select count(*)::int from jsonb_array_elements(public.report_wht_certificates(pg_temp.co(), '2026-11-01', '2026-11-30')) r
           where (r ->> 'voided')::boolean), 1, 'and flags the voided one');

-- received
select lives_ok($q$select public.set_received_wht_cert(null, current_setting('test.r2pay')::uuid, 'C-777', '2026-11-26')$q$,
  'the customer''s certificate number can be recorded on a posted receipt');
select is(pg_temp.total(public.report_wht_received(pg_temp.co(), '2026-11-01', '2026-11-30'), 'tax'), 450.00,
  'tax withheld from us: 300 + 150');
select is(pg_temp.total(public.report_wht_received(pg_temp.co(), '2026-11-01', '2026-11-30'), 'income'), 15000.00,
  'income subject to that withholding: 10,000 + 5,000');

call tests.login('other@wht.test');
select throws_ok(format('select public.report_wht_pnd(%L::uuid, %L, %L, %L)', current_setting('test.co'),
  '2026-11-01', '2026-11-30', 'pnd3'), '42501', null, 'non-members cannot read the reports');

select * from finish();
rollback;
