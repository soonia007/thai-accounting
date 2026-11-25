-- M8 reports: figures come from the ledger; combined = sum by account code; RLS-style scope.
-- Run: npm run db:test
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
        'owner@rep.test', '{}', now(), now()),
       (gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
        'other@rep.test', '{}', now(), now());

call tests.login('owner@rep.test');
do $$
declare
  v_a uuid; v_b uuid; v_cus uuid; v_cus_b uuid; v_inv uuid; v_bank uuid; v_bank_b uuid; v_pay uuid;
  v_today date := (now() at time zone 'Asia/Bangkok')::date;
begin
  v_a := public.create_company('Rep A', 'service', null, '00000', null, null, true, 7);
  v_b := public.create_company('Rep B', 'service', null, '00000', null, null, true, 7);
  perform set_config('test.a', v_a::text, false);
  perform set_config('test.b', v_b::text, false);
  insert into public.contacts (company_id, code, name, contact_type) values (v_a, 'C', 'Cust A', 'customer')
    returning id into v_cus;
  insert into public.contacts (company_id, code, name, contact_type) values (v_b, 'C', 'Cust B', 'customer')
    returning id into v_cus_b;
  select id into v_bank from public.accounts where company_id = v_a and code = '1120';
  select id into v_bank_b from public.accounts where company_id = v_b and code = '1120';
  -- A: invoice 1,000 (+VAT 70, deferred), paid in full
  v_inv := public.save_document(jsonb_build_object('company_id', v_a, 'type', 'invoice',
    'doc_date', v_today, 'contact_id', v_cus,
    'lines', '[{"item_kind":"service","qty":1,"unit_price":1000}]'::jsonb));
  perform public.post_document(v_inv);
  v_pay := public.save_payment(jsonb_build_object('company_id', v_a, 'direction', 'received',
    'pay_date', v_today, 'contact_id', v_cus, 'payment_account_id', v_bank, 'amount', 1070,
    'wht_amount', 0,
    'allocations', jsonb_build_array(jsonb_build_object('document_id', v_inv, 'amount', 1070))));
  perform public.post_payment(v_pay);
  -- A: second invoice 500 (+35) left unpaid
  perform public.post_document(public.save_document(jsonb_build_object('company_id', v_a,
    'type', 'invoice', 'doc_date', v_today, 'contact_id', v_cus,
    'lines', '[{"item_kind":"service","qty":1,"unit_price":500}]'::jsonb)));
  -- A: cash purchase 200 (+14)
  perform public.post_document(public.save_document(jsonb_build_object('company_id', v_a,
    'type', 'cash_purchase', 'doc_date', v_today, 'payment_account_id', v_bank,
    'lines', '[{"item_kind":"product","qty":1,"unit_price":200}]'::jsonb)));
  -- B: cash sale 100 (+7)
  perform public.post_document(public.save_document(jsonb_build_object('company_id', v_b,
    'type', 'cash_sale', 'doc_date', v_today, 'contact_id', v_cus_b, 'payment_account_id', v_bank_b,
    'lines', '[{"item_kind":"product","qty":1,"unit_price":100}]'::jsonb)));
end $$;

create function pg_temp.a() returns uuid[] language sql as $$ select array[current_setting('test.a')::uuid] $$;
create function pg_temp.ab() returns uuid[] language sql as
  $$ select array[current_setting('test.a')::uuid, current_setting('test.b')::uuid] $$;
create function pg_temp.today() returns date language sql as
  $$ select (now() at time zone 'Asia/Bangkok')::date $$;
create function pg_temp.sum_where(p_rows jsonb, p_key text, p_type text) returns numeric language sql as $$
  select coalesce(sum((r ->> p_key)::numeric), 0) from jsonb_array_elements(p_rows) r
  where p_type is null or r ->> 'type' = p_type $$;

-- trial balance
select is(pg_temp.sum_where(public.report_trial_balance(pg_temp.a(), pg_temp.today(), pg_temp.today()), 'debit', null),
  pg_temp.sum_where(public.report_trial_balance(pg_temp.a(), pg_temp.today(), pg_temp.today()), 'credit', null),
  'trial balance: total debit = total credit');
select is(pg_temp.sum_where(public.report_trial_balance(pg_temp.a(), pg_temp.today(), pg_temp.today()), 'closing', null),
  0.00, 'trial balance: closing balances sum to zero');
select is(pg_temp.sum_where(public.report_trial_balance(pg_temp.a(), pg_temp.today() + 1, pg_temp.today() + 1), 'debit', null),
  0.00, 'a period after all activity has no movement');
select ok(pg_temp.sum_where(public.report_trial_balance(pg_temp.a(), pg_temp.today() + 1, pg_temp.today() + 1), 'opening', 'asset') > 0,
  'but the earlier balances come through as opening');

-- income statement
select is(pg_temp.sum_where(public.report_income_statement(pg_temp.a(), pg_temp.today(), pg_temp.today()), 'amount', 'revenue'),
  1500.00, 'income statement: revenue 1,500 (VAT excluded)');
select is(pg_temp.sum_where(public.report_income_statement(pg_temp.a(), pg_temp.today(), pg_temp.today()), 'amount', 'expense'),
  200.00, 'income statement: expenses 200');
select is(pg_temp.sum_where(public.report_income_statement(pg_temp.a(), pg_temp.today() + 1, pg_temp.today() + 1), 'amount', null),
  0.00, 'income statement: nothing in an empty period');

-- balance sheet: assets = liabilities + equity + unclosed profit
select is(
  (select pg_temp.sum_where(b -> 'rows', 'amount', 'asset') from (select public.report_balance_sheet(pg_temp.a(), pg_temp.today()) b) x),
  (select pg_temp.sum_where(b -> 'rows', 'amount', 'liability') + pg_temp.sum_where(b -> 'rows', 'amount', 'equity')
          + (b ->> 'unclosed_profit')::numeric
   from (select public.report_balance_sheet(pg_temp.a(), pg_temp.today()) b) x),
  'balance sheet balances: assets = liabilities + equity + unclosed profit');
select is((public.report_balance_sheet(pg_temp.a(), pg_temp.today()) ->> 'unclosed_profit')::numeric, 1300.00,
  'unclosed profit = revenue − expenses');

-- receivables: paid invoice nets to zero, the unpaid one remains, per contact
select is(public.report_receivable_payable(pg_temp.a(), pg_temp.today(), 'ar') -> 0 ->> 'balance', '535.00'::text,
  'receivables: 535 outstanding for the customer');
select is(jsonb_array_length(public.report_receivable_payable(pg_temp.a(), pg_temp.today(), 'ar')), 1,
  'receivables: settled customers do not appear');

-- general ledger
select is(jsonb_array_length(public.report_general_ledger(pg_temp.a(), pg_temp.today(), pg_temp.today(), '1120') -> 0 -> 'lines'), 2,
  'general ledger: two bank lines (receipt + purchase)');

-- combined = sum by account code
select is(pg_temp.sum_where(public.report_income_statement(pg_temp.ab(), pg_temp.today(), pg_temp.today()), 'amount', 'revenue'),
  1600.00, 'combined income statement sums both companies by account code');

-- scope
call tests.login('other@rep.test');
select throws_ok(format('select public.report_trial_balance(array[%L::uuid], current_date, current_date)', current_setting('test.a')),
  '42501', null, 'a non-member cannot read another company''s reports');

select * from finish();
rollback;
