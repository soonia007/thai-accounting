-- M3: contacts, products, bank accounts.
-- Run: npm run db:test
begin;
select plan(30);

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

create function tests.acc(p_code text) returns uuid language sql stable as $$
  select id from public.accounts
  where company_id = current_setting('test.company')::uuid and code = p_code;
$$;
grant execute on function tests.acc(text) to authenticated;

-- Add a member directly (bypasses invitations; we test those in 01)
create procedure tests.add_member(p_email text, p_role public.member_role) language sql as $$
  insert into public.company_members (company_id, user_id, role)
  select current_setting('test.company')::uuid, id, p_role from auth.users where email = p_email;
$$;

call tests.create_user('owner@test.com');
call tests.create_user('staff@test.com');
call tests.create_user('viewer@test.com');
call tests.create_user('other@test.com');

call tests.login('other@test.com');
do $$ begin perform set_config('test.company_other', public.create_company('Other Co', 'service')::text, false); end $$;

call tests.login('owner@test.com');
do $$ begin perform set_config('test.company', public.create_company('A Co', 'trading')::text, false); end $$;
reset role;
call tests.add_member('staff@test.com', 'staff');
call tests.add_member('viewer@test.com', 'viewer');
do $$ begin perform set_config('test.other_acc', (select id::text from public.accounts where company_id = current_setting('test.company_other')::uuid and code = '4100'), false); end $$;

-- ---------------------------------------------------------------------------
-- contacts
-- ---------------------------------------------------------------------------
call tests.login('staff@test.com');

select lives_ok(
  $$ insert into public.contacts (company_id, code, name, contact_type, tax_id)
     values (current_setting('test.company')::uuid, '', 'ลูกค้า หนึ่ง', 'customer', '0-1055-36000-31-3') $$,
  'staff can add a contact');
select is((select code from public.contacts where name = 'ลูกค้า หนึ่ง'), 'C0001',
  'empty code is auto-assigned C0001');
select is((select tax_id from public.contacts where name = 'ลูกค้า หนึ่ง'), '0105536000313',
  'tax id dashes are stripped');
insert into public.contacts (company_id, code, name) values (current_setting('test.company')::uuid, null, 'สอง');
select is((select code from public.contacts where name = 'สอง'), 'C0002', 'next auto code is C0002');
insert into public.contacts (company_id, code, name) values (current_setting('test.company')::uuid, 'VIP-1', 'สาม');
insert into public.contacts (company_id, code, name) values (current_setting('test.company')::uuid, null, 'สี่');
select is((select code from public.contacts where name = 'สี่'), 'C0003',
  'custom codes do not break auto numbering');

select throws_ok(
  $$ insert into public.contacts (company_id, code, name, tax_id)
     values (current_setting('test.company')::uuid, null, 'x', '0105536000314') $$,
  '23514', null, 'invalid tax id rejected');
select throws_ok(
  $$ insert into public.contacts (company_id, code, name, tax_id)
     values (current_setting('test.company')::uuid, null, 'dup', '0105536000313') $$,
  '23505', null, 'same tax id + branch cannot be added twice');
select lives_ok(
  $$ insert into public.contacts (company_id, code, name, tax_id, branch_code)
     values (current_setting('test.company')::uuid, null, 'สาขา 1', '0105536000313', '00001') $$,
  'same tax id with a different branch is allowed');
select throws_ok(
  $$ insert into public.contacts (company_id, code, name) values (current_setting('test.company')::uuid, 'C0001', 'x') $$,
  '23505', null, 'contact code is unique per company');
select throws_ok(
  $$ insert into public.contacts (company_id, code, name, branch_code)
     values (current_setting('test.company')::uuid, null, 'x', '1') $$,
  '23514', null, 'branch code must be 5 digits');

delete from public.contacts where code = 'C0002';
select is((select count(*)::int from public.contacts where code = 'C0002'), 1, 'staff cannot delete contacts');

call tests.login('viewer@test.com');
select is((select count(*)::int from public.contacts), 5, 'viewer can read contacts');
select throws_ok(
  $$ insert into public.contacts (company_id, code, name) values (current_setting('test.company')::uuid, null, 'x') $$,
  '42501', null, 'viewer cannot add contacts');

call tests.login('other@test.com');
select is((select count(*)::int from public.contacts), 0, 'other company sees no contacts');
select throws_ok(
  $$ insert into public.contacts (company_id, code, name) values (current_setting('test.company')::uuid, null, 'x') $$,
  '42501', null, 'non-member cannot add contacts');

-- ---------------------------------------------------------------------------
-- products
-- ---------------------------------------------------------------------------
call tests.login('staff@test.com');

select lives_ok(
  $$ insert into public.products (company_id, code, name, kind, sale_price, income_account_id, expense_account_id)
     values (current_setting('test.company')::uuid, null, 'สินค้า ก', 'product', 100.50, tests.acc('4100'), tests.acc('5110')) $$,
  'staff can add a product with default accounts');
select is((select code from public.products where name = 'สินค้า ก'), 'P0001', 'product code auto-assigned');
select throws_ok(
  $$ insert into public.products (company_id, code, name, income_account_id)
     values (current_setting('test.company')::uuid, null, 'x', tests.acc('5110')) $$,
  'P0001', 'PRODUCT_INCOME_ACCOUNT_TYPE', 'income account must be revenue');
select throws_ok(
  $$ insert into public.products (company_id, code, name, expense_account_id)
     values (current_setting('test.company')::uuid, null, 'x', tests.acc('4100')) $$,
  'P0001', 'PRODUCT_EXPENSE_ACCOUNT_TYPE', 'expense account must be expense or asset');
select lives_ok(
  $$ insert into public.products (company_id, code, name, expense_account_id)
     values (current_setting('test.company')::uuid, null, 'อุปกรณ์', tests.acc('1210')) $$,
  'expense account may be an asset (e.g. equipment)');
select throws_ok(
  $$ insert into public.products (company_id, code, name, income_account_id)
     values (current_setting('test.company')::uuid, null, 'x', tests.acc('4000')) $$,
  'P0001', 'PRODUCT_ACCOUNT_NOT_POSTABLE', 'cannot use a group account');
select throws_ok(
  $$ insert into public.products (company_id, code, name, sale_price)
     values (current_setting('test.company')::uuid, null, 'x', -1) $$,
  '23514', null, 'price cannot be negative');
select throws_ok(
  format($$ insert into public.products (company_id, code, name, income_account_id)
            values (current_setting('test.company')::uuid, null, 'x', %L) $$,
    current_setting('test.other_acc')),
  '23503', null, 'cannot use another company''s account');

-- ---------------------------------------------------------------------------
-- bank accounts
-- ---------------------------------------------------------------------------
select throws_ok(
  $$ insert into public.bank_accounts (company_id, account_id, bank_code, account_number, account_name)
     values (current_setting('test.company')::uuid, tests.acc('1120'), 'KBANK', '123-4-56789-0', 'A Co') $$,
  '42501', null, 'staff cannot add bank accounts');

call tests.login('owner@test.com');
select lives_ok(
  $$ insert into public.bank_accounts (company_id, account_id, bank_code, account_number, account_name)
     values (current_setting('test.company')::uuid, tests.acc('1120'), 'KBANK', '123-4-56789-0', 'A Co') $$,
  'owner can link a bank account to an existing ledger account');
select throws_ok(
  $$ insert into public.bank_accounts (company_id, account_id, bank_code, account_number, account_name)
     values (current_setting('test.company')::uuid, tests.acc('2110'), 'SCB', '1', 'A Co') $$,
  'P0001', 'BANK_ACCOUNT_LEDGER_TYPE', 'ledger account must be an asset');
select throws_ok(
  $$ insert into public.bank_accounts (company_id, account_id, bank_code, account_number, account_name)
     values (current_setting('test.company')::uuid, tests.acc('1120'), 'SCB', '2', 'A Co') $$,
  '23505', null, 'one bank account per ledger account');

select isnt(
  public.create_bank_account_with_ledger(current_setting('test.company')::uuid, '1121',
    'ธนาคารไทยพาณิชย์ ออมทรัพย์', 'SCB', '987-6-54321-0', 'A Co', null, 'savings'),
  null, 'create_bank_account_with_ledger creates both rows');
select is(
  (select parent_id from public.accounts where code = '1121'),
  tests.acc('1100'), 'new ledger account sits under the BANK account''s group');

call tests.login('staff@test.com');
select throws_ok(
  $$ select public.create_bank_account_with_ledger(current_setting('test.company')::uuid, '1122', 'x', 'BBL', '1', 'A Co') $$,
  '42501', null, 'staff cannot create bank accounts via RPC either');

select * from finish();
rollback;
