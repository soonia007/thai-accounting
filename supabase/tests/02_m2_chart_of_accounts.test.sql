-- M2: chart-of-accounts integrity rules + account mappings.
-- Run: npm run db:test
begin;
select plan(29);

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
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

-- Account id by code in company A
create function tests.acc(p_code text) returns uuid language sql stable as $$
  select id from public.accounts
  where company_id = current_setting('test.company')::uuid and code = p_code;
$$;
grant execute on function tests.acc(text) to authenticated;

call tests.create_user('a@test.com');
call tests.create_user('b@test.com');

call tests.login('b@test.com');
do $$ begin perform set_config('test.company_b', public.create_company('B Co', 'service')::text, false); end $$;

call tests.login('a@test.com');
do $$ begin perform set_config('test.company', public.create_company('A Co', 'trading')::text, false); end $$;

-- ---------------------------------------------------------------------------
-- Account rules
-- ---------------------------------------------------------------------------
select is(
  (select count(*)::int from unnest(enum_range(null::public.account_role)) r
   where public.account_role_type(r) is null),
  0, 'every mapping role has an expected account type');

select lives_ok(
  $$ insert into public.accounts (company_id, code, name_th, type, parent_id, is_system)
     values (current_setting('test.company')::uuid, '1180', 'เงินทดรองจ่าย', 'asset', tests.acc('1100'), true) $$,
  'can add a leaf account under a group');
select is((select is_system from public.accounts where id = tests.acc('1180')), false,
  'users cannot create system accounts');

select throws_ok(
  $$ insert into public.accounts (company_id, code, name_th, type, parent_id)
     values (current_setting('test.company')::uuid, '1111', 'x', 'asset', tests.acc('1110')) $$,
  'P0001', 'ACCOUNT_PARENT_NOT_GROUP', 'parent must be a group');
select throws_ok(
  $$ insert into public.accounts (company_id, code, name_th, type, parent_id)
     values (current_setting('test.company')::uuid, '5999', 'x', 'expense', tests.acc('1100')) $$,
  'P0001', 'ACCOUNT_PARENT_TYPE_MISMATCH', 'child type must match parent type');
select throws_ok(
  $$ insert into public.accounts (company_id, code, name_th, type)
     values (current_setting('test.company')::uuid, '1110', 'dup', 'asset') $$,
  '23505', null, 'account code is unique per company');
select throws_ok(
  $$ insert into public.accounts (company_id, code, name_th, type)
     values (current_setting('test.company')::uuid, '1990', '   ', 'asset') $$,
  'P0001', 'ACCOUNT_NAME_REQUIRED', 'name is required');

-- cycles
insert into public.accounts (company_id, code, name_th, type, parent_id, is_group)
values (current_setting('test.company')::uuid, '1300', 'G1', 'asset', tests.acc('1000'), true);
insert into public.accounts (company_id, code, name_th, type, parent_id, is_group)
values (current_setting('test.company')::uuid, '1310', 'G2', 'asset', tests.acc('1300'), true);

select throws_ok(
  $$ update public.accounts set parent_id = tests.acc('1310') where code = '1300' $$,
  'P0001', 'ACCOUNT_PARENT_CYCLE', 'cannot create a parent cycle');
select throws_ok(
  $$ update public.accounts set parent_id = id where code = '1300' $$,
  'P0001', 'ACCOUNT_PARENT_CYCLE', 'cannot be its own parent');

-- system accounts
select throws_ok(
  $$ update public.accounts set type = 'liability', parent_id = null where code = '1220' $$,
  'P0001', 'ACCOUNT_SYSTEM_TYPE_LOCKED', 'system account type is locked');
select throws_ok(
  $$ update public.accounts set is_group = true where code = '1220' $$,
  'P0001', 'ACCOUNT_SYSTEM_GROUP_LOCKED', 'system account group flag is locked');
select lives_ok(
  $$ update public.accounts set name_th = 'รถยนต์', is_system = false where code = '1220' $$,
  'system account can be renamed');
select is((select is_system from public.accounts where code = '1220'), true,
  'users cannot clear is_system');

-- deactivation
select throws_ok(
  $$ update public.accounts set is_active = false where code = '1130' $$,
  'P0001', 'ACCOUNT_IS_MAPPED', 'mapped account cannot be deactivated');
select lives_ok(
  $$ update public.accounts set is_active = false where code = '1220' $$,
  'unmapped leaf can be deactivated');
select throws_ok(
  $$ update public.accounts set is_active = false where code = '1200' $$,
  'P0001', 'ACCOUNT_HAS_ACTIVE_CHILDREN', 'group with active children cannot be deactivated');
update public.accounts set is_active = false where code = '1310';
select throws_ok(
  $$ insert into public.accounts (company_id, code, name_th, type, parent_id)
     values (current_setting('test.company')::uuid, '1311', 'x', 'asset', tests.acc('1310')) $$,
  'P0001', 'ACCOUNT_PARENT_INACTIVE', 'cannot add an active account under an inactive group');
select throws_ok(
  $$ update public.accounts set is_group = false where code = '1300' $$,
  'P0001', 'ACCOUNT_HAS_CHILDREN', 'group with children cannot become a leaf');

-- deletes
delete from public.accounts where code = '1220';
select is((select count(*)::int from public.accounts where code = '1220'), 1,
  'system account cannot be deleted');
select throws_ok(
  $$ delete from public.accounts where code = '1300' $$,
  '23503', null, 'account with children cannot be deleted');
select lives_ok($$ delete from public.accounts where code = '1180' $$, 'non-system leaf can be deleted');

-- ---------------------------------------------------------------------------
-- Mapping rules
-- ---------------------------------------------------------------------------
insert into public.accounts (company_id, code, name_th, type, parent_id)
values (current_setting('test.company')::uuid, '1135', 'ลูกหนี้การค้า - ใหม่', 'asset', tests.acc('1100'));
insert into public.accounts (company_id, code, name_th, type, parent_id, is_active)
values (current_setting('test.company')::uuid, '1136', 'ปิดใช้งาน', 'asset', tests.acc('1100'), false);

select throws_ok(
  $$ update public.account_mappings set account_id = tests.acc('1100') where role = 'AR' $$,
  'P0001', 'MAPPING_ACCOUNT_IS_GROUP', 'cannot map to a group account');
select throws_ok(
  $$ update public.account_mappings set account_id = tests.acc('2110') where role = 'AR' $$,
  'P0001', 'MAPPING_ACCOUNT_TYPE_MISMATCH', 'AR must map to an asset account');
select throws_ok(
  $$ update public.account_mappings set account_id = tests.acc('1136') where role = 'AR' $$,
  'P0001', 'MAPPING_ACCOUNT_INACTIVE', 'cannot map to an inactive account');
select throws_ok(
  format($$ update public.account_mappings set account_id = %L where role = 'AR' $$,
    (select id from public.accounts a where a.company_id = current_setting('test.company_b')::uuid limit 1)),
  'P0001', 'MAPPING_ACCOUNT_NOT_FOUND', 'cannot map to another company''s account');
select lives_ok(
  $$ update public.account_mappings set account_id = tests.acc('1135') where role = 'AR' $$,
  'can remap AR to another asset account');
select lives_ok(
  $$ update public.accounts set is_active = false where code = '1130' $$,
  'old AR account can be deactivated once unmapped');
select throws_ok(
  $$ update public.accounts set is_group = true where code = '1135' $$,
  'P0001', 'ACCOUNT_IS_MAPPED', 'mapped account cannot become a group');
select lives_ok(
  $$ update public.accounts set type = 'expense', parent_id = tests.acc('5200') where code = '1136' $$,
  'non-system unmapped leaf can change type (with a matching parent)');

select * from finish();
rollback;
