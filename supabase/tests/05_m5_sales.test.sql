-- M5: sales lists, "next step" preview, share links.
-- Run: npm run db:test
begin;
select plan(18);

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
  if p_email is null then
    perform set_config('request.jwt.claims', '{"role":"anon"}', true);
    set local role anon;
    return;
  end if;
  select id into v_id from auth.users where email = p_email;
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_id, 'email', p_email, 'role', 'authenticated')::text, true);
  set local role authenticated;
end;
$$;
grant execute on procedure tests.login(text) to authenticated, anon;

create function tests.co() returns uuid language sql stable as $$ select current_setting('test.company')::uuid $$;
create function tests.acc(p_code text) returns uuid language sql stable as $$
  select id from public.accounts where company_id = tests.co() and code = p_code $$;
create function tests.contact() returns uuid language sql stable as $$
  select id from public.contacts where company_id = tests.co() and code = 'CUS' $$;
create function tests.post(p_type text, p_lines jsonb, p_extra jsonb default '{}') returns uuid
language plpgsql as $$
declare v_id uuid;
begin
  v_id := public.save_document(jsonb_build_object('company_id', tests.co(), 'type', p_type,
    'doc_date', '2026-11-25', 'contact_id', tests.contact(), 'lines', p_lines) || p_extra);
  perform public.post_document(v_id);
  return v_id;
end $$;
create function tests.status(p_id uuid) returns text language sql stable as $$
  select payment_status from public.list_documents(tests.co(), array['invoice']::public.document_type[])
  where id = p_id $$;
create procedure tests.set(p_key text, p_value text) language plpgsql as $$
begin perform set_config('test.' || p_key, p_value, false); end $$;
grant execute on all functions in schema tests to authenticated, anon;
grant execute on procedure tests.set(text, text) to authenticated, anon;

call tests.create_user('owner@test.com');
call tests.create_user('other@test.com');
call tests.login('owner@test.com');
do $$ begin perform set_config('test.company',
  public.create_company('VAT Co', 'service', '0105536000313', '00000', null, null, true, 7)::text, false); end $$;
insert into public.contacts (company_id, code, name, contact_type) values (tests.co(), 'CUS', 'Customer', 'customer');

-- ---------------------------------------------------------------------------
-- Next-step preview
-- ---------------------------------------------------------------------------
do $$ begin perform set_config('test.sim', public.simulate_posting('document', jsonb_build_object(
  'company_id', tests.co(), 'type', 'invoice', 'contact_id', tests.contact(),
  'lines', '[{"item_kind":"service","qty":1,"unit_price":10000,"wht_rate":3}]'::jsonb))::text, false); end $$;
select is(current_setting('test.sim')::jsonb #>> '{next,type}', 'payment_received',
  'invoice preview includes the receipt that follows');
select results_eq(
  $$ select x ->> 'code', (x ->> 'debit')::numeric, (x ->> 'credit')::numeric
     from jsonb_array_elements(current_setting('test.sim')::jsonb #> '{next,lines}') x $$,
  $$ values ('1120'::text, 10400.00, 0.00), ('1150', 300.00, 0), ('2121', 700.00, 0),
            ('1130', 0, 10700.00), ('2120', 0, 700.00) $$,
  'next step = full receipt with WHT 3% and deferred VAT realised (same as post_payment)');

select is((public.simulate_posting('document', jsonb_build_object(
  'company_id', tests.co(), 'type', 'quotation',
  'lines', '[{"qty":1,"unit_price":100}]'::jsonb)) #>> '{next,type}'), 'invoice',
  'quotation preview shows the invoice it would become');
select is(jsonb_array_length(public.simulate_posting('document', jsonb_build_object(
  'company_id', tests.co(), 'type', 'quotation', 'lines', '[{"qty":1,"unit_price":100}]'::jsonb)) -> 'lines'), 0,
  'quotation itself posts nothing');
select is((public.simulate_posting('document', jsonb_build_object(
  'company_id', tests.co(), 'type', 'cash_sale', 'payment_account_id', tests.acc('1120'),
  'lines', '[{"qty":1,"unit_price":100}]'::jsonb)) -> 'next'), 'null'::jsonb,
  'cash sale has no next step');

-- ---------------------------------------------------------------------------
-- Lists and payment status
-- ---------------------------------------------------------------------------
do $$ begin
  perform set_config('test.unpaid', tests.post('invoice', '[{"qty":1,"unit_price":1000}]',
    '{"due_date":"2999-12-31"}')::text, false);
  perform set_config('test.overdue', tests.post('invoice', '[{"qty":1,"unit_price":1000}]',
    '{"due_date":"2020-01-01"}')::text, false);
  perform set_config('test.partial', tests.post('invoice', '[{"qty":1,"unit_price":1000}]',
    '{"due_date":"2999-12-31"}')::text, false);
  perform set_config('test.paid', tests.post('invoice', '[{"qty":1,"unit_price":1000}]')::text, false);
  perform public.post_payment(public.save_payment(jsonb_build_object('company_id', tests.co(),
    'direction', 'received', 'contact_id', tests.contact(), 'payment_account_id', tests.acc('1120'),
    'amount', 1070 + 500, 'allocations', jsonb_build_array(
      jsonb_build_object('document_id', current_setting('test.paid')::uuid, 'amount', 1070),
      jsonb_build_object('document_id', current_setting('test.partial')::uuid, 'amount', 500)))));
end $$;
select is(tests.status(current_setting('test.unpaid')::uuid), 'unpaid', 'unpaid invoice');
select is(tests.status(current_setting('test.overdue')::uuid), 'overdue', 'past-due invoice is overdue');
select is(tests.status(current_setting('test.partial')::uuid), 'partial', 'partly paid invoice');
select is(tests.status(current_setting('test.paid')::uuid), 'paid', 'paid invoice');
select is((select outstanding from public.list_documents(tests.co(), array['invoice']::public.document_type[])
           where id = current_setting('test.partial')::uuid), 570.00, 'list shows the outstanding amount');
select is((select count(*)::int from public.open_documents(tests.co(), tests.contact(), 'received')), 3,
  'open_documents lists only invoices with something outstanding');
select is((select count(*)::int from public.list_payments(tests.co(), 'received')), 1, 'receipts list');

-- ---------------------------------------------------------------------------
-- Share links (docs/DECISIONS.md P2)
-- ---------------------------------------------------------------------------
do $$ begin perform set_config('test.token',
  public.create_share_link(current_setting('test.paid')::uuid)::text, false); end $$;
select is(length(current_setting('test.token')), 64, 'share token is 64 random hex characters');

do $$ begin perform set_config('test.draft', public.save_document(jsonb_build_object(
  'company_id', tests.co(), 'type', 'invoice', 'contact_id', tests.contact(),
  'lines', '[{"qty":1,"unit_price":5}]'::jsonb))::text, false); end $$;
select throws_ok($$ select public.create_share_link(current_setting('test.draft')::uuid) $$,
  'P0001', 'SHARE_NOT_POSTED', 'drafts cannot be shared');

do $$ begin perform set_config('test.paid_number',
  (select number from public.documents where id = current_setting('test.paid')::uuid), false); end $$;
call tests.login(null);
select is((public.get_shared_document(current_setting('test.token')) #>> '{document,number}'),
  current_setting('test.paid_number'),
  'anyone with the token can read the document (no sign-in)');
select throws_ok($$ select count(*) from public.documents $$, '42501', null,
  'anonymous users still cannot read the documents table');

call tests.login('other@test.com');
select throws_ok($$ select public.print_document(current_setting('test.paid')::uuid) $$,
  'P0001', 'DOCUMENT_NOT_FOUND', 'non-members cannot print another company''s document');

call tests.login('owner@test.com');
select public.revoke_share_link(current_setting('test.token'));
call tests.login(null);
select is(public.get_shared_document(current_setting('test.token')), null,
  'revoked link no longer works');

select * from finish();
rollback;
