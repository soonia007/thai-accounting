-- Dashboard summary: figures come from the ledger. Run: npm run db:test
begin;
select plan(7);

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
        'owner@dash.test', '{}', now(), now()),
       (gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
        'other@dash.test', '{}', now(), now());

call tests.login('owner@dash.test');
do $$
declare v_co uuid; v_cus uuid; v_inv uuid; v_old uuid; v_bank uuid; v_pay uuid;
begin
  v_co := public.create_company('Dash Co', 'service', null, '00000', null, null, true, 7);
  perform set_config('test.co', v_co::text, false);
  insert into public.contacts (company_id, code, name, contact_type) values (v_co, 'C', 'Cust', 'customer')
    returning id into v_cus;
  select id into v_bank from public.accounts where company_id = v_co and code = '1120';
  -- this month: invoice 1,000 + VAT 70, paid in full
  v_inv := public.save_document(jsonb_build_object('company_id', v_co, 'type', 'invoice',
    'doc_date', (now() at time zone 'Asia/Bangkok')::date, 'contact_id', v_cus,
    'lines', '[{"item_kind":"service","qty":1,"unit_price":1000}]'::jsonb));
  perform public.post_document(v_inv);
  v_pay := public.save_payment(jsonb_build_object('company_id', v_co, 'direction', 'received',
    'pay_date', (now() at time zone 'Asia/Bangkok')::date, 'contact_id', v_cus, 'payment_account_id', v_bank,
    'amount', 1070, 'wht_amount', 0,
    'allocations', jsonb_build_array(jsonb_build_object('document_id', v_inv, 'amount', 1070))));
  perform public.post_payment(v_pay);
  -- last month: invoice 500 + VAT 35, due long ago, unpaid → overdue
  v_old := public.save_document(jsonb_build_object('company_id', v_co, 'type', 'invoice',
    'doc_date', ((now() at time zone 'Asia/Bangkok')::date - 35), 'due_date', ((now() at time zone 'Asia/Bangkok')::date - 5),
    'contact_id', v_cus, 'lines', '[{"item_kind":"service","qty":1,"unit_price":500}]'::jsonb));
  perform public.post_document(v_old);
  -- cash expense this month 200 + VAT 14
  perform public.post_document(public.save_document(jsonb_build_object('company_id', v_co,
    'type', 'cash_purchase', 'doc_date', (now() at time zone 'Asia/Bangkok')::date, 'payment_account_id', v_bank,
    'lines', '[{"item_kind":"product","qty":1,"unit_price":200}]'::jsonb)));
end $$;

select is(jsonb_array_length(public.dashboard_summary(current_setting('test.co')::uuid, 6) -> 'months'), 6,
  'one row per month');
select is((public.dashboard_summary(current_setting('test.co')::uuid) #>> '{months,11,revenue}')::numeric, 1000.00,
  'this month revenue = 1,000 (from the ledger, VAT excluded)');
select is((public.dashboard_summary(current_setting('test.co')::uuid) #>> '{months,11,expenses}')::numeric, 200.00,
  'this month expenses = 200');
select is((public.dashboard_summary(current_setting('test.co')::uuid) ->> 'cash')::numeric, 856.00,
  'money in bank = 1,070 received − 214 paid');
select is((public.dashboard_summary(current_setting('test.co')::uuid) ->> 'receivables')::numeric, 535.00,
  'receivables = the unpaid invoice');
select is(public.dashboard_summary(current_setting('test.co')::uuid) -> 'overdue',
  '{"count": 1, "amount": 535.00}'::jsonb, 'one overdue invoice of 535');

call tests.login('other@dash.test');
select throws_ok(format('select public.dashboard_summary(%L)', current_setting('test.co')),
  '42501', null, 'non-members cannot read the dashboard');

select * from finish();
rollback;
