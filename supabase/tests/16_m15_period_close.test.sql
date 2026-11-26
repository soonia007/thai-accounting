-- M15 period close, hand-worked. Run: npm run db:test
--
-- 2025 (VAT off): 10 Mar cash sale 10,000 · 1 Apr cash sale 1,000 · 5 Jun cash purchase 4,000
-- (expense) · a draft invoice dated 20 Feb. Net profit 2025 = 7,000 → retained earnings.
begin;
select plan(19);

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
        'owner@close.test', '{}', now(), now()),
       (gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
        'acct@close.test', '{}', now(), now());

call tests.login('owner@close.test');
do $$
declare v_co uuid; v_bank uuid; v_cus uuid; v_doc uuid;
begin
  v_co := public.create_company('Close Co', 'service', null, '00000', null, null, false, 7);
  perform set_config('test.co', v_co::text, false);
  select id into v_bank from public.accounts where company_id = v_co and code = '1120';
  perform set_config('test.bank', v_bank::text, false);
  insert into public.contacts (company_id, code, name, contact_type) values (v_co, 'C', 'Cust', 'customer') returning id into v_cus;
  v_doc := public.save_document(jsonb_build_object('company_id', v_co, 'type', 'cash_sale', 'doc_date', '2025-03-10',
    'payment_account_id', v_bank, 'lines', '[{"item_kind":"service","qty":1,"unit_price":10000}]'::jsonb));
  perform public.post_document(v_doc);
  perform set_config('test.march', v_doc::text, false);
  perform public.post_document(public.save_document(jsonb_build_object('company_id', v_co, 'type', 'cash_sale',
    'doc_date', '2025-04-01', 'payment_account_id', v_bank, 'lines', '[{"item_kind":"service","qty":1,"unit_price":1000}]'::jsonb)));
  perform public.post_document(public.save_document(jsonb_build_object('company_id', v_co, 'type', 'cash_purchase',
    'doc_date', '2025-06-05', 'payment_account_id', v_bank, 'lines', '[{"item_kind":"service","qty":1,"unit_price":4000}]'::jsonb)));
  perform public.save_document(jsonb_build_object('company_id', v_co, 'type', 'invoice', 'doc_date', '2025-02-20',
    'contact_id', v_cus, 'lines', '[{"item_kind":"service","qty":1,"unit_price":500}]'::jsonb));
end $$;
-- an accountant member
reset role;
insert into public.company_members (company_id, user_id, role)
select current_setting('test.co')::uuid, id, 'accountant' from auth.users where email = 'acct@close.test';
call tests.login('owner@close.test');

create function pg_temp.co() returns uuid language sql as $$ select current_setting('test.co')::uuid $$;
create function pg_temp.locked() returns date language sql as $$ select locked_through from public.companies where id = pg_temp.co() $$;
create function pg_temp.gl(p_code text) returns numeric language sql as $$
  select coalesce(sum(l.debit - l.credit), 0) from public.journal_lines l join public.accounts a on a.id = l.account_id
  where a.company_id = pg_temp.co() and a.code = p_code $$;

select is((select (c ->> 'count')::int from jsonb_array_elements(public.period_close_checklist(pg_temp.co(), '2025-02-01')) c
           where c ->> 'key' = 'drafts'), 1, 'checklist: one draft dated in or before the month');
select lives_ok($q$ select public.close_period(pg_temp.co(), '2025-01-01') $q$, 'January closed');
select throws_ok($q$ select public.close_period(pg_temp.co(), '2025-03-01') $q$, 'P0001', 'PERIOD_CLOSE_ORDER',
  'months close in order (February first)');
select lives_ok($q$ select public.close_period(pg_temp.co(), '2025-02-01'); select public.close_period(pg_temp.co(), '2025-03-01') $q$,
  'February and March closed');
select is(pg_temp.locked(), '2025-03-31'::date, 'locked through 31 March');

-- the lock bites on every kind of posting
select throws_ok(format($q$ select public.post_document(public.save_document(jsonb_build_object('company_id', %L,
  'type', 'cash_sale', 'doc_date', '2025-03-15', 'payment_account_id', %L,
  'lines', '[{"item_kind":"service","qty":1,"unit_price":100}]'::jsonb))) $q$, pg_temp.co(), current_setting('test.bank')),
  'P0001', 'PERIOD_LOCKED', 'no posting into a closed month');
select throws_ok(format($q$ select public.void_document(%L, 'oops') $q$, current_setting('test.march')),
  'P0001', 'PERIOD_LOCKED', 'no voiding a document of a closed month (the reversal would land there)');
select throws_ok(format($q$ select public.post_manual_journal(public.save_manual_journal(jsonb_build_object('company_id', %L,
  'entry_date', '2025-02-28', 'lines', jsonb_build_array(
    jsonb_build_object('account_id', (select id from public.accounts where company_id = %L and code = '5290'), 'debit', 10),
    jsonb_build_object('account_id', %L, 'credit', 10))))) $q$, pg_temp.co(), pg_temp.co(), current_setting('test.bank')),
  'P0001', 'PERIOD_LOCKED', 'no journal entry into a closed month');
select lives_ok(format($q$ select public.post_document(public.save_document(jsonb_build_object('company_id', %L,
  'type', 'cash_sale', 'doc_date', '2025-04-15', 'payment_account_id', %L,
  'lines', '[{"item_kind":"service","qty":1,"unit_price":0.01}]'::jsonb))) $q$, pg_temp.co(), current_setting('test.bank')),
  'April is still open');

-- reopening: owner only, with a reason
call tests.login('acct@close.test');
select throws_ok($q$ select public.reopen_period(current_setting('test.co')::uuid, '2025-03-01', 'fix') $q$,
  'P0001', 'PERIOD_REOPEN_OWNER_ONLY', 'an accountant cannot reopen');
call tests.login('owner@close.test');
select lives_ok($q$ select public.reopen_period(pg_temp.co(), '2025-03-01', 'late invoice') $q$, 'the owner reopens March');
select is(pg_temp.locked(), '2025-02-28'::date, 'lock moves back to 28 February');
select is((select reopen_reason from public.period_closes where company_id = pg_temp.co() and month = '2025-03-01'),
  'late invoice', 'the reason is kept');

-- year end
select throws_ok($q$ select public.close_fiscal_year(pg_temp.co(), '2025-12-31') $q$, 'P0001', 'FISCAL_YEAR_MONTHS_OPEN',
  'the year closes only when all its months are closed');
do $$ declare m date; begin
  for m in select generate_series('2025-03-01'::date, '2025-12-01'::date, interval '1 month')::date loop
    perform public.close_period(current_setting('test.co')::uuid, m);
  end loop;
end $$;
select lives_ok($q$ select public.close_fiscal_year(pg_temp.co(), '2025-12-31') $q$, '2025 closed');
select is((select coalesce(sum(l.debit - l.credit), 0) from public.journal_lines l
           join public.account_mappings m on m.account_id = l.account_id and m.role = 'RETAINED_EARNINGS'
           where l.company_id = pg_temp.co()),
  -7000.01, 'retained earnings credited with the 2025 profit (10,000 + 1,000 + 0.01 − 4,000)');
select is((select sum((r ->> 'amount')::numeric) from jsonb_array_elements(
             public.report_income_statement(array[pg_temp.co()], '2025-01-01', '2025-12-31')) r where r ->> 'type' = 'revenue'),
  11000.01, 'the 2025 P&L still shows the revenue (closing entry hidden)');
select is((public.report_balance_sheet(array[pg_temp.co()], '2025-12-31') ->> 'unclosed_profit')::numeric, 0.00,
  'balance sheet: nothing left as "not yet closed" for 2025');
select throws_ok($q$ select public.reopen_period(pg_temp.co(), '2025-06-01', 'x') $q$, 'P0001', 'PERIOD_IN_CLOSED_YEAR',
  'a month of a closed year cannot be reopened before the year');

select * from finish();
rollback;
