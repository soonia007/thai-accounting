-- M14 fixed assets, hand-worked. Run: npm run db:test
--
-- A: computer bought on a bill 16 Mar 2026, 36,000, 36 months, no salvage → 1,000 / month
--    March (16 of 31 days) 516.13; April 1,000; May skipped → June catches up 2,000
--    sold 15 Jul for 30,000 + VAT 2,100: top-up to 15 Jul = 4,000 − 3,516.13 = 483.87,
--    book value 32,000 → loss 2,000
-- B: vehicle brought in as opening balance: cost 60,000, 24,000 depreciated, 60 months
--    (1,000 / month from 1 Jan 2024)
-- Runs: Jan 1,000 (B) · Mar 2,516.13 (A 516.13 + B 2,000 incl. Feb) · Apr 2,000 · Jun 4,000
begin;
select plan(16);

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
        'owner@fa.test', '{}', now(), now());

call tests.login('owner@fa.test');
do $$
declare v_co uuid; v_ven uuid; v_bill uuid; v_line uuid; v_office uuid; v_veh uuid; v_a uuid; v_b uuid;
begin
  v_co := public.create_company('FA Co', 'service', '1101700230708', '00000', null, null, true, 7);
  perform set_config('test.co', v_co::text, false);
  perform public.init_asset_categories(v_co);
  select id into v_office from public.asset_categories where company_id = v_co and name = 'คอมพิวเตอร์และอุปกรณ์';
  select id into v_veh from public.asset_categories where company_id = v_co and name = 'ยานพาหนะ';
  insert into public.contacts (company_id, code, name, contact_type) values (v_co, 'V', 'Vendor', 'vendor') returning id into v_ven;
  v_bill := public.save_document(jsonb_build_object('company_id', v_co, 'type', 'bill', 'doc_date', '2026-03-16',
    'contact_id', v_ven, 'lines', jsonb_build_array(jsonb_build_object('description', 'Laptop', 'item_kind', 'product',
      'qty', 1, 'unit_price', 36000, 'account_id', (select id from public.accounts where company_id = v_co and code = '1210')))));
  perform public.post_document(v_bill);
  select id into v_line from public.document_lines where document_id = v_bill;
  perform set_config('test.line', v_line::text, false);
  v_a := public.register_fixed_asset(jsonb_build_object('company_id', v_co, 'name', 'Laptop', 'category_id', v_office,
    'source', 'document', 'source_line_id', v_line));
  perform set_config('test.a', v_a::text, false);
  v_b := public.register_fixed_asset(jsonb_build_object('company_id', v_co, 'name', 'Van', 'category_id', v_veh,
    'source', 'opening', 'acquired_on', '2024-01-01', 'cost', 60000, 'life_months', 60,
    'opening_accum', 24000, 'opening_date', '2025-12-31'));
  perform set_config('test.b', v_b::text, false);
end $$;

create function pg_temp.co() returns uuid language sql as $$ select current_setting('test.co')::uuid $$;
create function pg_temp.gl(p_code text) returns numeric language sql as $$
  select coalesce(sum(l.debit - l.credit), 0) from public.journal_lines l join public.accounts a on a.id = l.account_id
  where a.company_id = pg_temp.co() and a.code = p_code $$;
create function pg_temp.run(p_month date) returns numeric language plpgsql as $$
declare v uuid;
begin
  v := public.run_depreciation(pg_temp.co(), p_month);
  return (select total from public.depreciation_runs where id = v);
end $$;

select is((select cost from public.fixed_assets where id = current_setting('test.a')::uuid), 36000.00,
  'registered from the bill line: cost and date taken from the line');
select is(jsonb_array_length(public.unregistered_asset_lines(pg_temp.co())), 0, 'the bill line is no longer offered for registration');
select is(pg_temp.gl('1221'), -24000.00, 'opening asset: accumulated depreciation brought in (24,000)');

select is(pg_temp.run('2026-01-01'), 1000.00, 'January: the van, 1,000');
select is(pg_temp.run('2026-03-01'), 2516.13, 'March: laptop 16/31 × 1,000 = 516.13 + van 2,000 (Feb caught up)');
select is(pg_temp.run('2026-04-01'), 2000.00, 'April: 1,000 + 1,000');
select is(pg_temp.run('2026-06-01'), 4000.00, 'June catches up May: 2,000 + 2,000');
select throws_ok($q$ select public.run_depreciation(current_setting('test.co')::uuid, '2026-05-01') $q$,
  'P0001', 'DEPRECIATION_MONTH_DONE', 'an earlier month cannot be posted after a later one');
select throws_ok($q$ select public.void_depreciation_run((select id from public.depreciation_runs
  where company_id = current_setting('test.co')::uuid and month = '2026-04-01')) $q$,
  'P0001', 'DEPRECIATION_NOT_LATEST', 'only the latest run can be undone');
select lives_ok($q$ select public.void_depreciation_run((select id from public.depreciation_runs
  where company_id = current_setting('test.co')::uuid and month = '2026-06-01' and status = 'posted')) $q$,
  'the latest run can be undone');
select is(pg_temp.run('2026-06-01'), 4000.00, 'and posted again with the same result');

-- disposal
select is((public.disposal_preview(current_setting('test.a')::uuid, '2026-07-15', 30000) ->> 'gain')::numeric, -2000.00,
  'preview: book value 32,000 vs 30,000 → loss 2,000');
select lives_ok(format($q$ select public.dispose_fixed_asset(jsonb_build_object('asset_id', %L, 'disposed_on', '2026-07-15',
  'proceeds', 30000, 'payment_account_id', (select id from public.accounts where company_id = %L and code = '1120'))) $q$,
  current_setting('test.a'), current_setting('test.co')), 'sold');
select results_eq($q$ select pg_temp.gl('1210'), pg_temp.gl('1211'), pg_temp.gl('5280'), pg_temp.gl('4920') $q$,
  $q$ values (0.00::numeric, 0.00::numeric, 2000.00::numeric, 0.00::numeric) $q$,
  'cost and accumulated depreciation cleared; loss 2,000; nothing left on the gain account');
select is((select sum((r ->> 'vat')::numeric) from jsonb_array_elements(public.report_vat_sales(pg_temp.co(), '2026-07-01')) r),
  2100.00, 'the sale is a cash sale: output VAT 2,100 is in July''s VAT report');
select is((select r ->> 'accum' from jsonb_array_elements(public.fixed_asset_register(pg_temp.co(), '2026-12-31')) r
           where r ->> 'id' = current_setting('test.a')), '4000.00', 'register: 4,000 depreciated at disposal');

select * from finish();
rollback;
