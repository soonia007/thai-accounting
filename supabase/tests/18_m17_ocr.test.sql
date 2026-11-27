-- M17 OCR ingestion. Run: npm run db:test
--
-- 2025 (VAT off): 10 Mar cash sale 10,000 · 1 Apr cash sale 1,000 · 5 Jun cash purchase 4,000
-- (expense) · a draft invoice dated 20 Feb. Net profit 2025 = 7,000 → retained earnings.
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
        'owner@ocr.test', '{}', now(), now()),
       (gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
        'other@ocr.test', '{}', now(), now());

call tests.login('owner@ocr.test');
do $$
declare v_co uuid; v_key text;
begin
  v_co := public.create_company('OCR Co', 'service', null, '00000', null, null, false, 7);
  perform set_config('test.co', v_co::text, false);
  v_key := public.create_ocr_agent_key(v_co, 'Office PC');
  perform set_config('test.key', v_key, false);
  perform set_config('test.web', public.create_ocr_job(v_co, v_co || '/a.pdf', 'a.pdf', 'application/pdf', 100)::text, false);
end;
$$;

select ok(current_setting('test.key') like 'fin_ocr_%', 'plain key returned once');
select is((select count(*)::int from public.ocr_agent_keys where key_prefix = left(current_setting('test.key'), 14)), 1,
  'only the prefix is visible');
select throws_ok($$ select key_hash from public.ocr_agent_keys $$, '42501', null, 'hash column is not readable');
select is((select status::text from public.ocr_jobs where id = current_setting('test.web')::uuid), 'queued', 'web upload queued');
select throws_ok($$ select public.ocr_agent_auth('x') $$, '42501', null, 'agent RPCs are service-role only');

-- as the Edge Function (service role)
reset role;
set local role service_role;
create temp table k on commit drop as select (public.ocr_agent_auth(current_setting('test.key')) ->> 'key_id')::uuid as id;
select throws_ok($$ select public.ocr_agent_auth('fin_ocr_wrong') $$, 'P0001', 'OCR_KEY_INVALID', 'wrong key refused');
select is(jsonb_array_length(public.ocr_agent_claim((select id from k), 5)), 1, 'claim hands out the queued job');
select is(jsonb_array_length(public.ocr_agent_claim((select id from k), 5)), 0, 'not handed out twice');
select is((public.ocr_agent_create_job((select id from k), current_setting('test.co') || '/b.pdf', 'b.pdf',
  'application/pdf', 10, 'abc') ->> 'duplicate')::boolean, false, 'folder file creates a job');
select throws_ok($$ select public.ocr_agent_submit((select id from k), current_setting('test.web')::uuid, '{}',
  '{"schema_version":"2"}', null) $$, 'P0001', 'OCR_RESULT_INVALID', 'wrong contract version refused');
select is(public.ocr_agent_submit((select id from k), current_setting('test.web')::uuid, '{"fields":{}}',
  '{"schema_version":"1","total":10}', null) ->> 'status', 'needs_review', 'result waits for review (never posted)');
select throws_ok($$ select public.ocr_agent_submit((select id from k), current_setting('test.web')::uuid, null,
  '{"schema_version":"1"}', null) $$, 'P0001', 'OCR_JOB_DONE', 'a reviewed job is not overwritten');
create temp table b on commit drop as select id from public.ocr_jobs where file_name = 'b.pdf';
select is((public.ocr_agent_create_job((select id from k), current_setting('test.co') || '/c.pdf', 'b.pdf',
  'application/pdf', 10, 'abc') ->> 'id')::uuid, (select id from b), 'unfinished duplicate is resumed, not skipped');
select ok(public.ocr_agent_submit((select id from k), (select id from b), null, null, 'unreadable') ->> 'status' = 'failed',
  'error recorded');

reset role;
call tests.login('owner@ocr.test');
select is((public.ocr_overview(current_setting('test.co')::uuid) ->> 'month_count')::int, 2, 'jobs counted per month');
call tests.login('other@ocr.test');
select is((select count(*)::int from public.ocr_jobs), 0, 'other users see no jobs');

select * from finish();
rollback;
