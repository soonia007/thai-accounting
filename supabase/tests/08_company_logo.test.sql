-- Company logo storage. Run: npm run db:test
begin;
select plan(6);

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
select gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', e, '{}', now(), now()
from unnest(array['owner@logo.test', 'staff@logo.test']) e;

call tests.login('owner@logo.test');
do $$ begin perform set_config('test.co',
  public.create_company('Logo Co', 'service', null, '00000', null, null, false, 7)::text, false); end $$;
reset role;
insert into public.company_members (company_id, user_id, role)
select current_setting('test.co')::uuid, id, 'staff' from auth.users where email = 'staff@logo.test';

call tests.login('owner@logo.test');
select lives_ok(format($$ insert into storage.objects (bucket_id, name, owner_id)
  values ('company-logos', '%s/logo.png', auth.uid()::text) $$, current_setting('test.co')),
  'owner can upload the company logo');
select lives_ok(format($$ update public.companies set logo_path = '%s/logo.png' where id = '%s' $$,
  current_setting('test.co'), current_setting('test.co')), 'owner can set logo_path');
select throws_ok(format($$ update public.companies set logo_path = 'other/logo.png' where id = '%s' $$,
  current_setting('test.co')), '23514', null, 'logo_path must be in the company folder');
reset role;
select is((select public from storage.buckets where id = 'company-logos'), true,
  'logos are public (printed on documents sent to customers)');

call tests.login('staff@logo.test');
select throws_ok(format($$ insert into storage.objects (bucket_id, name, owner_id)
  values ('company-logos', '%s/x.png', auth.uid()::text) $$, current_setting('test.co')),
  '42501', null, 'staff cannot upload a logo');
select throws_ok($$ insert into storage.objects (bucket_id, name)
  values ('company-logos', '00000000-0000-0000-0000-000000000000/x.png') $$,
  '42501', null, 'nobody can upload into another company''s folder');

select * from finish();
rollback;
