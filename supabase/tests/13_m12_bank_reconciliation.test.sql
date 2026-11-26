-- M12 bank reconciliation, hand-worked. Run: npm run db:test
--
-- Books (bank 1120, VAT off):  +5,000 cash sale (3 Nov) · −1,200 cash purchase (5 Nov)
--                              −800 cash purchase (28 Nov, not yet on the statement)
--                              +300 cash sale (4 Nov) voided → ignored
-- Statement:  4 Nov +5,000 (bal 5,000) · 6 Nov −1,200 (3,800) · 30 Nov fee −50 (3,750)
--             30 Nov interest +12 (3,762)
-- Before adjustments: book 3,000; 3,762 + (−800) − (−38) − 3,000 = 0 → reconciles
-- After the fee / interest JVs: book 2,962; nothing left on the statement side.
begin;
select plan(15);

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
        'owner@bank.test', '{}', now(), now()),
       (gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
        'other@bank.test', '{}', now(), now());

call tests.login('owner@bank.test');
do $$
declare v_co uuid; v_acc uuid; v_bank uuid; v_doc uuid;
begin
  v_co := public.create_company('Bank Co', 'service', null, '00000', null, null, false, 7);
  perform set_config('test.co', v_co::text, false);
  select id into v_acc from public.accounts where company_id = v_co and code = '1120';
  insert into public.bank_accounts (company_id, account_id, bank_code, account_number, account_name)
    values (v_co, v_acc, 'KBANK', '123-4-56789-0', 'Bank Co') returning id into v_bank;
  perform set_config('test.bank', v_bank::text, false);

  perform public.post_document(public.save_document(jsonb_build_object('company_id', v_co, 'type', 'cash_sale',
    'doc_date', '2026-11-03', 'payment_account_id', v_acc,
    'lines', '[{"item_kind":"service","qty":1,"unit_price":5000}]'::jsonb)));
  perform public.post_document(public.save_document(jsonb_build_object('company_id', v_co, 'type', 'cash_purchase',
    'doc_date', '2026-11-05', 'payment_account_id', v_acc,
    'lines', '[{"item_kind":"service","qty":1,"unit_price":1200}]'::jsonb)));
  perform public.post_document(public.save_document(jsonb_build_object('company_id', v_co, 'type', 'cash_purchase',
    'doc_date', '2026-11-28', 'payment_account_id', v_acc,
    'lines', '[{"item_kind":"service","qty":1,"unit_price":800}]'::jsonb)));
  v_doc := public.save_document(jsonb_build_object('company_id', v_co, 'type', 'cash_sale',
    'doc_date', '2026-11-04', 'payment_account_id', v_acc,
    'lines', '[{"item_kind":"service","qty":1,"unit_price":300}]'::jsonb));
  perform public.post_document(v_doc);
  perform public.void_document(v_doc, 'test');
end $$;

create function pg_temp.bank() returns uuid language sql as $$ select current_setting('test.bank')::uuid $$;
create function pg_temp.lines() returns jsonb language sql as $$ select '[
  {"txn_date":"2026-11-04","description":"TRANSFER IN","amount":5000,"balance":5000},
  {"txn_date":"2026-11-06","description":"PAYMENT","amount":-1200,"balance":3800},
  {"txn_date":"2026-11-30","description":"FEE","amount":-50,"balance":3750},
  {"txn_date":"2026-11-30","description":"INTEREST","amount":12,"balance":3762}]'::jsonb $$;
create function pg_temp.stmt(p_desc text) returns uuid language sql as
  $$ select id from public.bank_statement_lines where bank_account_id = pg_temp.bank() and description = p_desc $$;
create function pg_temp.rec() returns jsonb language sql as
  $$ select public.bank_reconciliation(pg_temp.bank(), '2026-11-30') $$;

select is((public.import_bank_statement(pg_temp.bank(), 'nov.csv', pg_temp.lines(), '{"date":"Date"}') ->> 'inserted')::int,
  4, 'statement imported (4 lines)');
select is((public.import_bank_statement(pg_temp.bank(), 'nov.csv', pg_temp.lines()) ->> 'skipped')::int,
  4, 'importing the same lines again skips them all');
select is((select mapping ->> 'date' from public.bank_import_mappings), 'Date', 'column mapping remembered for the bank');
select is(jsonb_array_length(public.bank_reconcile_data(pg_temp.bank()) -> 'book'), 3,
  'book side: 3 unmatched lines (the voided sale and its reversal are left out)');

-- suggestions → confirm
select is(jsonb_array_length(public.bank_match_suggestions(pg_temp.bank())), 2,
  'two suggestions: +5,000 and −1,200 (same amount, within 7 days)');
select lives_ok($q$
  select public.match_bank_line((s ->> 'statement_line_id')::uuid, array[(s ->> 'journal_line_id')::uuid])
  from jsonb_array_elements(public.bank_match_suggestions(pg_temp.bank())) s $q$, 'suggestions confirmed');

-- reconciliation before adjustments
select is((pg_temp.rec() ->> 'statement_balance')::numeric, 3762.00, 'statement balance from the last line');
select is((pg_temp.rec() ->> 'book_balance')::numeric, 3000.00, 'book balance 3,000');
select is((pg_temp.rec() ->> 'book_not_on_statement_total')::numeric, -800.00, 'unpresented payment −800');
select is((pg_temp.rec() ->> 'difference')::numeric, 0.00, 'reconciles: 3,762 − 800 + 38 − 3,000 = 0');

-- wrong amount / unmatch
select throws_ok($q$ select public.match_bank_line(pg_temp.stmt('FEE'),
  array[(select (b ->> 'id')::uuid from jsonb_array_elements(public.bank_reconcile_data(pg_temp.bank()) -> 'book') b limit 1)]) $q$,
  'P0001', 'BANK_MATCH_AMOUNT_MISMATCH', 'amounts must agree');

-- D15: fee and interest → JV, matched
select lives_ok($q$ select public.create_bank_adjustment(pg_temp.stmt('FEE'),
  (select id from public.accounts where company_id = current_setting('test.co')::uuid and code = '5260'), 'Bank fee') $q$,
  'bank charge posted as a JV and matched');
select lives_ok($q$ select public.create_bank_adjustment(pg_temp.stmt('INTEREST'),
  (select id from public.accounts where company_id = current_setting('test.co')::uuid and code = '4910')) $q$,
  'interest posted as a JV and matched');
select results_eq($q$ select (pg_temp.rec() ->> 'book_balance')::numeric,
                             jsonb_array_length(pg_temp.rec() -> 'statement_not_in_book'),
                             (pg_temp.rec() ->> 'difference')::numeric $q$,
  $q$ values (2962.00::numeric, 0, 0.00::numeric) $q$,
  'after adjustments: book 2,962, nothing left only on the statement, still reconciles');

call tests.login('other@bank.test');
select throws_ok($q$ select public.bank_reconcile_data(pg_temp.bank()) $q$, 'P0001', 'BANK_ACCOUNT_NOT_FOUND',
  'non-members cannot see the bank account');

select * from finish();
rollback;
