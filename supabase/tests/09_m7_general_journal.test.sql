-- M7: general journal — balance check, gap-free JV numbers, void by reversal (D3), no AR/AP (D9).
-- Run: npm run db:test
begin;
select plan(20);

create schema tests;
grant usage on schema tests to authenticated, anon;
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
create function tests.co() returns uuid language sql stable as $$ select current_setting('test.co')::uuid $$;
create function tests.acc(p_code text) returns uuid language sql stable as $$
  select id from public.accounts where company_id = tests.co() and code = p_code $$;
create function tests.jv(p_lines jsonb, p_date date default '2026-11-30', p_memo text default 'Accrual')
returns jsonb language sql as $$
  select jsonb_build_object('company_id', tests.co(), 'entry_date', p_date, 'memo', p_memo, 'lines', p_lines) $$;
create function tests.line(p_code text, p_dr numeric, p_cr numeric) returns jsonb language sql stable as $$
  select jsonb_build_object('account_id', tests.acc(p_code), 'debit', p_dr, 'credit', p_cr) $$;
create function tests.balance(p_code text) returns numeric language sql stable as $$
  select coalesce(sum(debit - credit), 0) from public.journal_lines where account_id = tests.acc(p_code) $$;
grant execute on all functions in schema tests to authenticated;

insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at)
select gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', e, '{}', now(), now()
from unnest(array['owner@jv.test', 'staff@jv.test', 'viewer@jv.test']) e;

call tests.login('owner@jv.test');
do $$ begin perform set_config('test.co',
  public.create_company('JV Co', 'trading', null, '00000', null, null, true, 7)::text, false); end $$;
reset role;
insert into public.company_members (company_id, user_id, role)
select tests.co(), id, r from auth.users u
join (values ('staff@jv.test', 'staff'::public.member_role), ('viewer@jv.test', 'viewer')) v(e, r) on v.e = u.email;

call tests.login('owner@jv.test');

-- Simulation: errors are data, OK returns enriched lines
select is(public.simulate_manual_journal(tests.jv(jsonb_build_array(
    tests.line('5230', 1000, 0), tests.line('2140', 0, 900)))) ->> 'error',
  'JOURNAL_NOT_BALANCED', 'unbalanced entry is reported by the simulation');
select is(public.simulate_manual_journal(tests.jv(jsonb_build_array(tests.line('5230', 1000, 0)))) ->> 'error',
  'JOURNAL_TOO_FEW_LINES', 'a journal needs at least two lines');
select is(public.simulate_manual_journal(tests.jv(jsonb_build_array(
    tests.line('5230', 1000, 1000), tests.line('2140', 0, 0)))) ->> 'error',
  'JOURNAL_LINE_ONE_SIDE', 'a line is either a debit or a credit');
select is(public.simulate_manual_journal(tests.jv(jsonb_build_array(
    tests.line('1000', 1000, 0), tests.line('2140', 0, 1000)))) ->> 'error',
  'JOURNAL_GROUP_ACCOUNT', 'group accounts cannot be used');
select is(public.simulate_manual_journal(tests.jv(jsonb_build_array(
    tests.line('1130', 1000, 0), tests.line('4100', 0, 1000)))) ->> 'error',
  'MANUAL_JOURNAL_CONTROL_ACCOUNT', 'D9: receivables cannot be posted by hand');
select is(public.simulate_manual_journal(tests.jv(jsonb_build_array(
    tests.line('5290', 500, 0), tests.line('2110', 0, 500)))) ->> 'error',
  'MANUAL_JOURNAL_CONTROL_ACCOUNT', 'D9: payables cannot be posted by hand');
select is(jsonb_array_length(public.simulate_manual_journal(tests.jv(jsonb_build_array(
    tests.line('5230', 1000, 0), tests.line('2140', 0, 1000), '{"account_id":"","debit":0,"credit":0}'::jsonb))) -> 'lines'),
  2, 'blank rows are ignored; a valid entry previews two lines');

-- Draft → post
do $$ begin perform set_config('test.jv1', public.save_manual_journal(tests.jv(jsonb_build_array(
  tests.line('5230', 1000, 0), tests.line('2140', 0, 1000))))::text, false); end $$;
select is((select status::text from public.manual_journals where id = current_setting('test.jv1')::uuid), 'draft',
  'saved as a draft');
select is((select count(*)::int from public.journal_entries where manual_journal_id = current_setting('test.jv1')::uuid), 0,
  'a draft does not touch the ledger');
select is(public.post_manual_journal(current_setting('test.jv1')::uuid) ->> 'number', 'JV-2026-0001',
  'posting assigns JV-2026-0001');
select is(tests.balance('5230'), 1000.00, 'expense debited 1,000');
select is(tests.balance('2140'), -1000.00, 'accrued expenses credited 1,000');
select throws_ok(format($$ update public.manual_journals set memo = 'x' where id = '%s' $$, current_setting('test.jv1')),
  'P0001', 'DOCUMENT_NOT_DRAFT', 'a posted journal cannot be edited');

-- Second entry, numbering continues
do $$ begin perform set_config('test.jv2', public.save_manual_journal(tests.jv(jsonb_build_array(
  tests.line('5270', 300, 0), tests.line('1211', 0, 300)), '2026-11-30', 'Depreciation'))::text, false); end $$;
select is(public.post_manual_journal(current_setting('test.jv2')::uuid) ->> 'number', 'JV-2026-0002',
  'numbers are gap-free');

-- Unbalanced draft cannot be posted
do $$ begin perform set_config('test.jv3', public.save_manual_journal(tests.jv(jsonb_build_array(
  tests.line('5230', 10, 0), tests.line('2140', 0, 9))))::text, false); end $$;
select throws_ok(format($$ select public.post_manual_journal('%s') $$, current_setting('test.jv3')),
  'P0001', 'JOURNAL_NOT_BALANCED', 'an unbalanced draft cannot be posted');

-- Void: reversal on the same date, ledger back to zero
select lives_ok(format($$ select public.void_manual_journal('%s', 'posted twice') $$, current_setting('test.jv1')),
  'void a posted journal');
select is(tests.balance('5230'), 0.00, 'void reverses the entry');
select is((select entry_date from public.journal_entries
           where manual_journal_id = current_setting('test.jv1')::uuid and reverses_entry_id is not null),
  '2026-11-30'::date, 'D3: the reversal keeps the original date');

-- Permissions
call tests.login('staff@jv.test');
select throws_ok(format($$ select public.save_manual_journal(%L::jsonb) $$, tests.jv(jsonb_build_array(
    tests.line('5230', 1, 0), tests.line('2140', 0, 1)))),
  '42501', null, 'staff cannot create journal entries');
call tests.login('viewer@jv.test');
select is((select count(*)::int from public.manual_journals), 3, 'viewers can read journals');

select * from finish();
rollback;
