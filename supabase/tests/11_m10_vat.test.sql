-- M10 VAT reports against hand-calculated figures (spec Phase 2 §0.3). Run: npm run db:test
--
-- October 2026, VAT 7%:
--   S1 invoice goods 10,000            → output VAT 700 (tax point: invoice)
--   S2 invoice service 5,000, paid 20th → output VAT 350 on the receipt (D1)
--   S3 cash sale zero-rated 2,000       → PP.30 zero-rated
--   S4 cash sale exempt 1,000           → PP.30 exempt
--   S5 invoice goods 3,000, voided      → not reported
--   P1 bill goods 4,000 (TX-001)        → input VAT 280
--   P2 cash purchase 1,000 claimable + 500 not claimable → input VAT 70; 35 goes to expense (D11)
--   P3 bill service 2,000, paid 25th (TX-777) → input VAT 140 on the payment (D2)
--   P4 cash purchase 3,000, claimed in November (D12) → input VAT 210 in November
-- October: output 1,050 − input 490 = 560 to pay. November: −210 → carry forward to December.
begin;
select plan(21);

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
        'owner@vat.test', '{}', now(), now()),
       (gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
        'other@vat.test', '{}', now(), now());

call tests.login('owner@vat.test');
do $$
declare
  v_co uuid; v_cus uuid; v_ven uuid; v_bank uuid; v_doc uuid; v_pay uuid;
  doc_ jsonb;
begin
  v_co := public.create_company('VAT Co', 'service', '1101700230708', '00000', null, null, true, 7);
  perform set_config('test.co', v_co::text, false);
  insert into public.contacts (company_id, code, name, contact_type, tax_id)
    values (v_co, 'C1', 'Customer', 'customer', '1101700230708') returning id into v_cus;
  insert into public.contacts (company_id, code, name, contact_type, tax_id)
    values (v_co, 'V1', 'Vendor', 'vendor', null) returning id into v_ven;
  select id into v_bank from public.accounts where company_id = v_co and code = '1120';

  -- S1
  perform public.post_document(public.save_document(jsonb_build_object('company_id', v_co, 'type', 'invoice',
    'doc_date', '2026-10-05', 'contact_id', v_cus,
    'lines', '[{"item_kind":"product","qty":1,"unit_price":10000}]'::jsonb)));
  -- S2 + receipt
  v_doc := public.save_document(jsonb_build_object('company_id', v_co, 'type', 'invoice',
    'doc_date', '2026-10-10', 'contact_id', v_cus,
    'lines', '[{"item_kind":"service","qty":1,"unit_price":5000}]'::jsonb));
  perform public.post_document(v_doc);
  v_pay := public.save_payment(jsonb_build_object('company_id', v_co, 'direction', 'received',
    'pay_date', '2026-10-20', 'contact_id', v_cus, 'payment_account_id', v_bank, 'amount', 5350, 'wht_amount', 0,
    'allocations', jsonb_build_array(jsonb_build_object('document_id', v_doc, 'amount', 5350))));
  perform public.post_payment(v_pay);
  perform set_config('test.s2pay', v_pay::text, false);
  -- S3, S4
  perform public.post_document(public.save_document(jsonb_build_object('company_id', v_co, 'type', 'cash_sale',
    'doc_date', '2026-10-12', 'contact_id', v_cus, 'payment_account_id', v_bank,
    'lines', '[{"item_kind":"product","qty":1,"unit_price":2000,"vat_type":"zero"}]'::jsonb)));
  perform public.post_document(public.save_document(jsonb_build_object('company_id', v_co, 'type', 'cash_sale',
    'doc_date', '2026-10-13', 'contact_id', v_cus, 'payment_account_id', v_bank,
    'lines', '[{"item_kind":"product","qty":1,"unit_price":1000,"vat_type":"exempt"}]'::jsonb)));
  -- S5 voided
  v_doc := public.save_document(jsonb_build_object('company_id', v_co, 'type', 'invoice',
    'doc_date', '2026-10-15', 'contact_id', v_cus,
    'lines', '[{"item_kind":"product","qty":1,"unit_price":3000}]'::jsonb));
  perform public.post_document(v_doc);
  perform public.void_document(v_doc, 'wrong customer');

  -- P1
  v_doc := public.save_document(jsonb_build_object('company_id', v_co, 'type', 'bill',
    'doc_date', '2026-10-06', 'contact_id', v_ven, 'tax_invoice_no', 'TX-001', 'tax_invoice_date', '2026-10-06',
    'lines', '[{"item_kind":"product","qty":1,"unit_price":4000}]'::jsonb));
  perform public.post_document(v_doc);
  perform set_config('test.p1', v_doc::text, false);
  -- P2 (second line not claimable)
  v_doc := public.save_document(jsonb_build_object('company_id', v_co, 'type', 'cash_purchase',
    'doc_date', '2026-10-08', 'contact_id', v_ven, 'payment_account_id', v_bank,
    'lines', '[{"item_kind":"product","qty":1,"unit_price":1000},
               {"item_kind":"product","qty":1,"unit_price":500,"vat_claimable":false}]'::jsonb));
  perform public.post_document(v_doc);
  perform set_config('test.p2', v_doc::text, false);
  -- P3 + payment with the vendor's tax invoice
  v_doc := public.save_document(jsonb_build_object('company_id', v_co, 'type', 'bill',
    'doc_date', '2026-10-09', 'contact_id', v_ven,
    'lines', '[{"item_kind":"service","qty":1,"unit_price":2000}]'::jsonb));
  perform public.post_document(v_doc);
  v_pay := public.save_payment(jsonb_build_object('company_id', v_co, 'direction', 'paid',
    'pay_date', '2026-10-25', 'contact_id', v_ven, 'payment_account_id', v_bank, 'amount', 2140, 'wht_amount', 0,
    'allocations', jsonb_build_array(jsonb_build_object('document_id', v_doc, 'amount', 2140))));
  perform public.post_payment(v_pay);
  perform public.set_vat_claim(null, v_pay, 'TX-777', '2026-10-25', null);
  -- P4 claimed in November
  perform public.post_document(public.save_document(jsonb_build_object('company_id', v_co, 'type', 'cash_purchase',
    'doc_date', '2026-10-11', 'contact_id', v_ven, 'payment_account_id', v_bank,
    'tax_invoice_no', 'TX-900', 'tax_invoice_date', '2026-10-11', 'vat_claim_month', '2026-11-01',
    'lines', '[{"item_kind":"product","qty":1,"unit_price":3000}]'::jsonb)));
end $$;

create function pg_temp.co() returns uuid language sql as $$ select current_setting('test.co')::uuid $$;
create function pg_temp.total(p jsonb, k text) returns numeric language sql as
  $$ select coalesce(sum((r ->> k)::numeric), 0) from jsonb_array_elements(p) r $$;

-- output VAT
select is(jsonb_array_length(public.report_vat_sales(pg_temp.co(), '2026-10-01')), 2,
  'sales VAT report: invoice of goods + receipt of the service (zero-rated, exempt and voided excluded)');
select is(pg_temp.total(public.report_vat_sales(pg_temp.co(), '2026-10-01'), 'vat'), 1050.00, 'output VAT = 1,050');
select is(pg_temp.total(public.report_vat_sales(pg_temp.co(), '2026-10-01'), 'base'), 15000.00, 'taxable sales = 15,000');
select is((select r ->> 'number' from jsonb_array_elements(public.report_vat_sales(pg_temp.co(), '2026-10-01')) r
           where r ->> 'kind' = 'payment'),
          (select number from public.payments where id = current_setting('test.s2pay')::uuid),
  'service VAT is reported on the receipt (D1)');

-- input VAT
select is(jsonb_array_length(public.report_vat_purchases(pg_temp.co(), '2026-10-01')), 3,
  'purchase VAT report (October): P1, P2, P3 — P4 moved to November');
select is(pg_temp.total(public.report_vat_purchases(pg_temp.co(), '2026-10-01'), 'vat'), 490.00, 'input VAT = 280 + 70 + 140');
select is((select r ->> 'number' from jsonb_array_elements(public.report_vat_purchases(pg_temp.co(), '2026-10-01')) r
           where (r ->> 'vat')::numeric = 140), 'TX-777', 'the vendor''s tax invoice number from the payment (D2, D12)');
select is((select r ->> 'number' from jsonb_array_elements(public.report_vat_purchases(pg_temp.co(), '2026-10-01')) r
           where (r ->> 'vat')::numeric = 280), 'TX-001', 'the vendor''s tax invoice number from the bill');
select is((public.report_vat_purchases(pg_temp.co(), '2026-11-01') -> 0 ->> 'vat')::numeric, 210.00,
  'November claims P4 (210)');
select is((public.report_vat_purchases(pg_temp.co(), '2026-11-01') -> 0 ->> 'late')::boolean, true,
  'and marks it as claimed late');

-- D11: non-claimable VAT goes to the expense
select is((select total from public.documents where id = current_setting('test.p2')::uuid), 1605.00,
  'P2 total still includes all VAT (1,500 + 105)');
select is((select sum(l.debit) from public.journal_lines l join public.journal_entries e on e.id = l.entry_id
           join public.accounts a on a.id = l.account_id
           where e.document_id = current_setting('test.p2')::uuid and a.type = 'expense'), 1535.00,
  'P2 expense = 1,000 + 500 + 35 non-claimable VAT');

-- PP.30 summary
select is((public.vat_return_summary(pg_temp.co(), '2026-10-01') ->> 'zero_rated')::numeric, 2000.00, 'zero-rated sales 2,000');
select is((public.vat_return_summary(pg_temp.co(), '2026-10-01') ->> 'sales_total')::numeric, 18000.00,
  'total sales = 15,000 + 2,000 + 1,000');
select is((public.vat_return_summary(pg_temp.co(), '2026-10-01') ->> 'net')::numeric, 560.00, 'October: 560 to pay');

-- claim month must be within 6 months
select throws_ok(format($q$select public.set_vat_claim(%L, null, 'TX-001', '2026-10-06', '2027-05-01')$q$,
  current_setting('test.p1')), 'P0001', 'VAT_CLAIM_MONTH_INVALID', 'claim month beyond 6 months is refused');

-- filing + carry forward
select lives_ok($q$select public.file_vat_return(current_setting('test.co')::uuid, '2026-10-01')$q$,
  'October PP.30 filed');
select throws_ok($q$select public.file_vat_return(current_setting('test.co')::uuid, '2026-11-01')$q$,
  'P0001', 'VAT_EXCESS_CHOICE_REQUIRED', 'an overpaid month needs refund / carry');
select lives_ok($q$select public.file_vat_return(current_setting('test.co')::uuid, '2026-11-01', 'carry')$q$,
  'November filed with carry forward');
select is((public.vat_return_summary(pg_temp.co(), '2026-12-01') ->> 'carried_in')::numeric, 210.00,
  'December starts with the 210 credit carried from November');
select throws_ok(format($q$select public.set_vat_claim(%L, null, 'TX-001', '2026-10-06', '2026-11-01')$q$,
  current_setting('test.p1')), 'P0001', 'VAT_MONTH_FILED', 'claims cannot move out of a filed month');

select * from finish();
rollback;
