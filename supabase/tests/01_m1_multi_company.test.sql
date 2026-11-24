-- M1: multi-company isolation (RLS), onboarding, invitations, member management.
-- Run: npm run db:test
begin;
select plan(45);

-- ---------------------------------------------------------------------------
-- Helpers (temp schema, discarded with the transaction)
-- ---------------------------------------------------------------------------
create schema tests;
grant usage on schema tests to authenticated, anon;

create procedure tests.create_user(p_email text) language sql as $$
  insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at)
  values (gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
          p_email, '{}'::jsonb, now(), now());
$$;

-- Act as a signed-in user (or anon when p_email is null) for the rest of the transaction
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

call tests.create_user('a@test.com');
call tests.create_user('b@test.com');
call tests.create_user('c@test.com');
call tests.create_user('d@test.com');

-- ---------------------------------------------------------------------------
-- Templates + helpers
-- ---------------------------------------------------------------------------
select ok(public.is_valid_thai_tax_id('0105536000313'), 'valid tax id passes checksum');
select ok(not public.is_valid_thai_tax_id('0105536000314'), 'wrong check digit fails');
select ok(not public.is_valid_thai_tax_id('12345'), 'short tax id fails');

select is(
  (select count(distinct business_type)::int from public.account_templates), 4,
  'templates exist for all 4 business types');
select is(
  (select count(*)::int from public.account_templates t
   where t.parent_code is not null
     and not exists (select 1 from public.account_templates p
                     where p.business_type = t.business_type and p.code = t.parent_code and p.is_group)),
  0, 'every template parent exists and is a group account');
select is(
  (select count(*)::int from public.account_templates
   where business_type = 'trading' and mapping_role is not null),
  (select count(*)::int from unnest(enum_range(null::public.account_role))),
  'trading template maps every account role');
select is(
  (select array_agg(r order by r) from unnest(enum_range(null::public.account_role)) r
   where r not in (select mapping_role from public.account_templates
                   where business_type = 'service' and mapping_role is not null)),
  array['INVENTORY']::public.account_role[],
  'service template maps every role except INVENTORY');

-- profiles are created for new auth users
select is((select count(*)::int from public.profiles where email like '%@test.com'), 4,
  'profile row created for each new user');

-- ---------------------------------------------------------------------------
-- User A onboards
-- ---------------------------------------------------------------------------
call tests.login('a@test.com');

do $$ begin perform set_config('test.company_a',
  public.create_company('A Co', 'service', '0105536000313', '00000', null, 'Bangkok', true, 7)::text, false); end $$;

select isnt(current_setting('test.company_a'), '', 'create_company returns an id');
select is((select count(*)::int from public.companies), 1, 'A sees exactly 1 company');
select is((select role::text from public.company_members where user_id = auth.uid()), 'owner',
  'creator becomes owner');
select is(
  (select count(*)::int from public.accounts),
  (select count(*)::int from public.account_templates where business_type = 'service'),
  'service chart of accounts copied');
select is(
  (select count(*)::int from public.accounts where parent_id is null),
  5, 'only the 5 top-level groups have no parent');
select is((select count(*)::int from public.account_mappings), 12, 'service company has 12 mappings');

select throws_ok(
  $$ select public.create_company('Bad', 'service', '1111111111111') $$,
  '23514', null, 'invalid tax id rejected');

-- ---------------------------------------------------------------------------
-- User B onboards; must not see anything from A
-- ---------------------------------------------------------------------------
call tests.login('b@test.com');
do $$ begin perform set_config('test.company_b', public.create_company('B Co', 'trading')::text, false); end $$;

select is((select count(*)::int from public.companies), 1, 'B sees exactly 1 company');
select is((select name from public.companies), 'B Co', '... and it is B Co');
select is(
  (select count(*)::int from public.accounts where company_id = current_setting('test.company_a')::uuid),
  0, 'B sees none of A''s accounts');
select is(
  (select count(*)::int from public.account_mappings where company_id = current_setting('test.company_a')::uuid),
  0, 'B sees none of A''s mappings');
select is(
  (select count(*)::int from public.company_members where company_id = current_setting('test.company_a')::uuid),
  0, 'B sees none of A''s members');
select is((select count(*)::int from public.profiles where email = 'a@test.com'), 0,
  'B cannot see A''s profile');

select throws_ok(
  format($$ insert into public.accounts (company_id, code, name_th, type)
            values (%L, '9999', 'hack', 'asset') $$, current_setting('test.company_a')),
  '42501', null, 'B cannot insert accounts into A');
select throws_ok(
  format($$ insert into public.company_invitations (company_id, email, role)
            values (%L, 'b2@test.com', 'admin') $$, current_setting('test.company_a')),
  '42501', null, 'B cannot invite into A');
select throws_ok(
  format($$ select public.update_member_role(%L, auth.uid(), 'owner') $$, current_setting('test.company_a')),
  '42501', null, 'B cannot change roles in A');

do $$ begin
  update public.companies set name = 'hacked' where id = current_setting('test.company_a')::uuid;
  delete from public.accounts where company_id = current_setting('test.company_a')::uuid;
end $$;

-- ---------------------------------------------------------------------------
-- A invites C as accountant
-- ---------------------------------------------------------------------------
call tests.login('a@test.com');
select is((select name from public.companies where id = current_setting('test.company_a')::uuid), 'A Co',
  'B''s update on A had no effect');
select is(
  (select count(*)::int from public.accounts),
  (select count(*)::int from public.account_templates where business_type = 'service'),
  'B''s delete on A''s accounts had no effect');

select lives_ok(
  format($$ insert into public.company_invitations (company_id, email, role)
            values (%L, 'C@test.com', 'accountant') $$, current_setting('test.company_a')),
  'owner can invite');
select lives_ok(
  format($$ insert into public.company_invitations (company_id, email, role)
            values (%L, 'd@test.com', 'viewer') $$, current_setting('test.company_a')),
  'owner can invite a second person');

-- B cannot accept an invitation addressed to someone else
call tests.login('b@test.com');
select is((select count(*)::int from public.company_invitations), 0, 'B sees no invitations');
select is((select count(*)::int from public.my_invitations()), 0, 'my_invitations is empty for B');
select throws_ok(
  $$ select public.accept_invitation((select id from public.company_invitations limit 1)) $$,
  'P0002', null, 'accept with unknown/foreign invitation fails');

-- C accepts
call tests.login('c@test.com');
select is((select count(*)::int from public.companies), 0, 'C sees no company before accepting');
select is((select count(*)::int from public.company_invitations), 1, 'C sees own invitation (email case-insensitive)');
select is((select company_name from public.my_invitations()), 'A Co', 'my_invitations shows company name');
select is(public.accept_invitation((select id from public.company_invitations))::text,
  current_setting('test.company_a'), 'C accepts invitation');
select is((select count(*)::int from public.companies), 1, 'C now sees company A');
select lives_ok(
  format($$ insert into public.accounts (company_id, code, name_th, type)
            values (%L, '5299', 'test', 'expense') $$, current_setting('test.company_a')),
  'accountant can add accounts');
select throws_ok(
  format($$ insert into public.company_invitations (company_id, email, role)
            values (%L, 'x@test.com', 'admin') $$, current_setting('test.company_a')),
  '42501', null, 'accountant cannot invite');

-- ---------------------------------------------------------------------------
-- Member management guards
-- ---------------------------------------------------------------------------
call tests.login('a@test.com');
select throws_ok(
  format($$ select public.update_member_role(%L, auth.uid(), 'admin') $$, current_setting('test.company_a')),
  'P0001', null, 'last owner cannot demote themselves');
select throws_ok(
  format($$ select public.remove_member(%L, auth.uid()) $$, current_setting('test.company_a')),
  'P0001', null, 'last owner cannot leave');
select lives_ok(
  format($$ select public.update_member_role(%L, (select id from public.profiles where email = 'c@test.com'), 'viewer') $$,
         current_setting('test.company_a')),
  'owner can change a member''s role');

call tests.login('c@test.com');
select throws_ok(
  format($$ insert into public.accounts (company_id, code, name_th, type)
            values (%L, '5298', 'test', 'expense') $$, current_setting('test.company_a')),
  '42501', null, 'viewer cannot add accounts');
select lives_ok(
  format($$ select public.remove_member(%L, auth.uid()) $$, current_setting('test.company_a')),
  'non-admin member can leave');
select is((select count(*)::int from public.companies), 0, 'C sees nothing after leaving');

-- ---------------------------------------------------------------------------
-- Anonymous
-- ---------------------------------------------------------------------------
call tests.login(null);
select throws_ok($$ select * from public.companies $$, '42501', null, 'anon cannot read companies');

select * from finish();
rollback;
