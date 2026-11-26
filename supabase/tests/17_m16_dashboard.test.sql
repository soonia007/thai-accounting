-- M16 dashboard_full. Run: npm run db:test
--
-- 2025 (VAT off): 10 Mar cash sale 10,000 · 1 Apr cash sale 1,000 · 5 Jun cash purchase 4,000
-- (expense) · a draft invoice dated 20 Feb. Net profit 2025 = 7,000 → retained earnings.
begin;
select plan(8);

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

-- Co A: cash sale 10,000 today. Co B: invoice 3,000 due 45 days ago (aging 31–60) + bill 500 not yet due.
call tests.login('owner@dash.test');
do $$
declare v_a uuid; v_b uuid; v_bank uuid; v_cus uuid; v_ven uuid; v_doc uuid;
  v_today date := (now() at time zone 'Asia/Bangkok')::date;
begin
  v_a := public.create_company('Dash A', 'service', null, '00000', null, null, false, 7);
  v_b := public.create_company('Dash B', 'service', null, '00000', null, null, false, 7);
  perform set_config('test.a', v_a::text, false);
  perform set_config('test.b', v_b::text, false);
  select id into v_bank from public.accounts where company_id = v_a and code = '1120';
  v_doc := public.save_document(jsonb_build_object('company_id', v_a, 'type', 'cash_sale', 'doc_date', v_today,
    'payment_account_id', v_bank, 'lines', '[{"item_kind":"service","qty":1,"unit_price":10000}]'::jsonb));
  perform public.post_document(v_doc);
  insert into public.contacts (company_id, code, name, contact_type) values (v_b, 'C', 'Cust', 'customer') returning id into v_cus;
  insert into public.contacts (company_id, code, name, contact_type) values (v_b, 'V', 'Vend', 'vendor') returning id into v_ven;
  v_doc := public.save_document(jsonb_build_object('company_id', v_b, 'type', 'invoice', 'doc_date', v_today - 75,
    'due_date', v_today - 45, 'contact_id', v_cus,
    'lines', '[{"item_kind":"service","qty":1,"unit_price":3000}]'::jsonb));
  perform public.post_document(v_doc);
  v_doc := public.save_document(jsonb_build_object('company_id', v_b, 'type', 'bill', 'doc_date', v_today,
    'due_date', v_today + 30, 'contact_id', v_ven,
    'lines', '[{"item_kind":"service","qty":1,"unit_price":500}]'::jsonb));
  perform public.post_document(v_doc);
end;
$$;

reset role;
create function tests.dash() returns jsonb language sql as $$
  select public.dashboard_full(array[current_setting('test.a')::uuid, current_setting('test.b')::uuid], 3) $$;
grant execute on function tests.dash() to authenticated;
call tests.login('owner@dash.test');

select is(jsonb_array_length(tests.dash() -> 'months'), 3, 'three months of trend');
select is((tests.dash() -> 'months' -> 2 ->> 'revenue')::numeric, 10000.00, 'this month revenue (A) — B invoice is older');
select is((tests.dash() -> 'months' -> 2 ->> 'cash_in')::numeric, 10000.00, 'cash in from the cash sale');
select is((tests.dash() ->> 'receivables')::numeric, 3000.00, 'receivables summed across companies');
select is((tests.dash() -> 'aging' -> 'ar' ->> 'd60')::numeric, 3000.00, 'invoice 45 days overdue → 31–60');
select is((tests.dash() -> 'aging' -> 'ap' ->> 'current')::numeric, 500.00, 'bill not yet due → current');
select is((tests.dash() ->> 'company_count')::int, 2, 'both companies counted');

call tests.login('other@dash.test');
select throws_ok($$ select tests.dash() $$, '42501', null, 'non-member is refused');

select * from finish();
rollback;
