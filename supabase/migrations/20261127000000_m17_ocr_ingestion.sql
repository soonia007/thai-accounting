-- M17: OCR JSON contract + ingestion. The OCR program (pdfstruct) runs outside the app, on the
-- owner's computer, through a small connector (tools/ocr-connector). It talks to the Edge Function
-- `ocr-agent` with a per-company agent key; the function calls the service-role-only RPCs below.
-- OCR never posts: a result only waits for review (draft creation is M19).

create type public.ocr_job_status as enum ('queued', 'processing', 'done', 'failed', 'needs_review');
create type public.ocr_job_source as enum ('web', 'mobile', 'folder', 'api');

alter table public.companies
  add column ocr_review_threshold numeric(3, 2) not null default 0.85
    check (ocr_review_threshold between 0 and 1);

create table public.ocr_agent_keys (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 80),
  key_prefix text not null,
  key_hash text not null unique,
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);
alter table public.ocr_agent_keys enable row level security;
create policy ocr_agent_keys_select on public.ocr_agent_keys for select to authenticated
  using (private.has_role(company_id, '{owner,admin}'));
revoke insert, update, delete on public.ocr_agent_keys from authenticated;
revoke select on public.ocr_agent_keys from authenticated, anon;
grant select (id, company_id, name, key_prefix, created_by, created_at, last_used_at, revoked_at)
  on public.ocr_agent_keys to authenticated;

create table public.ocr_jobs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  status public.ocr_job_status not null default 'queued',
  source public.ocr_job_source not null,
  storage_path text not null unique check (split_part(storage_path, '/', 1) = company_id::text),
  file_name text not null,
  file_sha256 text,
  mime_type text,
  size_bytes bigint,
  raw_json jsonb,          -- exactly what the OCR program produced (kept for debugging/accuracy work)
  result jsonb,            -- the same document in contract ocr-document.v1
  error text,
  attempts int not null default 0,
  document_id uuid,
  agent_key_id uuid references public.ocr_agent_keys (id) on delete set null,
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz,
  foreign key (company_id, document_id) references public.documents (company_id, id) on delete set null (document_id)
);
create index ocr_jobs_company_created on public.ocr_jobs (company_id, created_at desc);
create index ocr_jobs_queue on public.ocr_jobs (company_id, created_at) where status = 'queued';
create index ocr_jobs_sha on public.ocr_jobs (company_id, file_sha256);
alter table public.ocr_jobs enable row level security;
create policy ocr_jobs_select on public.ocr_jobs for select to authenticated
  using (private.is_member(company_id));
revoke insert, update, delete on public.ocr_jobs from authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('ocr-files', 'ocr-files', false, 20 * 1024 * 1024,
        array['application/pdf', 'image/jpeg', 'image/png', 'image/heic', 'image/webp'])
on conflict (id) do nothing;
create policy ocr_files_select on storage.objects for select to authenticated
  using (bucket_id = 'ocr-files' and private.is_member(nullif((storage.foldername(name))[1], '')::uuid));
create policy ocr_files_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'ocr-files'
              and private.has_role(nullif((storage.foldername(name))[1], '')::uuid,
                                   '{owner,admin,accountant,staff}'));

-- ---------------------------------------------------------------------------
-- App-side RPCs
-- ---------------------------------------------------------------------------

-- Owner/admin: new agent key. The plain key is returned once and only its hash is stored.
create or replace function public.create_ocr_agent_key(p_company_id uuid, p_name text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_key text := 'fin_ocr_' || encode(extensions.gen_random_bytes(24), 'hex');
begin
  if not private.has_role(p_company_id, '{owner,admin}') then
    raise exception 'permission denied' using errcode = '42501';
  end if;
  insert into public.ocr_agent_keys (company_id, name, key_prefix, key_hash)
  values (p_company_id, trim(coalesce(p_name, '')), left(v_key, 14),
          encode(extensions.digest(v_key, 'sha256'), 'hex'));
  return v_key;
end;
$$;

create or replace function public.revoke_ocr_agent_key(p_key_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_co uuid;
begin
  select company_id into v_co from public.ocr_agent_keys where id = p_key_id;
  if v_co is null or not private.has_role(v_co, '{owner,admin}') then
    raise exception 'permission denied' using errcode = '42501';
  end if;
  update public.ocr_agent_keys set revoked_at = coalesce(revoked_at, now()) where id = p_key_id;
end;
$$;

-- A file the user uploaded (web/mobile, M18) joins the queue; the connector picks it up.
create or replace function public.create_ocr_job(
  p_company_id uuid, p_storage_path text, p_file_name text, p_mime text, p_size bigint,
  p_sha256 text default null, p_source public.ocr_job_source default 'web')
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare v_id uuid;
begin
  if not private.has_role(p_company_id, '{owner,admin,accountant,staff}') then
    raise exception 'permission denied' using errcode = '42501';
  end if;
  if p_source not in ('web', 'mobile') then
    raise exception 'OCR_SOURCE_INVALID' using errcode = 'P0001';
  end if;
  insert into public.ocr_jobs (company_id, source, storage_path, file_name, mime_type, size_bytes, file_sha256)
  values (p_company_id, p_source, p_storage_path, p_file_name, p_mime, p_size, p_sha256)
  returning id into v_id;
  return v_id;
end;
$$;

-- Put a failed job back in the queue.
create or replace function public.retry_ocr_job(p_job_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_job public.ocr_jobs;
begin
  select * into v_job from public.ocr_jobs where id = p_job_id;
  if v_job.id is null or not private.has_role(v_job.company_id, '{owner,admin,accountant,staff}') then
    raise exception 'permission denied' using errcode = '42501';
  end if;
  if v_job.status <> 'failed' then
    raise exception 'OCR_JOB_NOT_FAILED' using errcode = 'P0001';
  end if;
  update public.ocr_jobs set status = 'queued', error = null, started_at = null, finished_at = null
  where id = p_job_id;
end;
$$;

-- Owner/admin: fields read with lower confidence than this are flagged for checking (M20).
create or replace function public.set_ocr_threshold(p_company_id uuid, p_threshold numeric)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.has_role(p_company_id, '{owner,admin}') then
    raise exception 'permission denied' using errcode = '42501';
  end if;
  if p_threshold is null or p_threshold < 0.5 or p_threshold > 1 then
    raise exception 'OCR_THRESHOLD_INVALID' using errcode = 'P0001';
  end if;
  update public.companies set ocr_review_threshold = round(p_threshold, 2) where id = p_company_id;
end;
$$;

-- Jobs per month (for future plan quotas) and the agent's last contact.
create or replace function public.ocr_overview(p_company_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare v_month date := date_trunc('month', (now() at time zone 'Asia/Bangkok'))::date;
begin
  if not private.is_member(p_company_id) then
    raise exception 'permission denied' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'month_count', (select count(*) from public.ocr_jobs where company_id = p_company_id
                      and (created_at at time zone 'Asia/Bangkok')::date >= v_month),
    'by_status', coalesce((select jsonb_object_agg(status, n) from (
        select status, count(*) as n from public.ocr_jobs where company_id = p_company_id group by status) s),
      '{}'::jsonb),
    'agent_last_seen', (select max(last_used_at) from public.ocr_agent_keys
                         where company_id = p_company_id and revoked_at is null),
    'threshold', (select ocr_review_threshold from public.companies where id = p_company_id));
end;
$$;

-- ---------------------------------------------------------------------------
-- Agent RPCs: service_role only (called by the Edge Function after it checks the key)
-- ---------------------------------------------------------------------------

create or replace function public.ocr_agent_auth(p_key text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_row public.ocr_agent_keys;
begin
  update public.ocr_agent_keys set last_used_at = now()
  where key_hash = encode(extensions.digest(coalesce(p_key, ''), 'sha256'), 'hex') and revoked_at is null
  returning * into v_row;
  if v_row.id is null then
    raise exception 'OCR_KEY_INVALID' using errcode = 'P0001';
  end if;
  return jsonb_build_object('key_id', v_row.id, 'company_id', v_row.company_id,
    'company', (select name from public.companies where id = v_row.company_id));
end;
$$;

-- Hand the oldest queued jobs to the agent (skip locked: several agents may poll).
-- Jobs stuck in processing for 15 minutes are handed out again (max 3 attempts).
create or replace function public.ocr_agent_claim(p_key_id uuid, p_limit int default 5)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_co uuid := (select company_id from public.ocr_agent_keys where id = p_key_id and revoked_at is null);
  v_out jsonb;
begin
  if v_co is null then
    raise exception 'OCR_KEY_INVALID' using errcode = 'P0001';
  end if;
  update public.ocr_jobs set status = 'failed', error = 'too many attempts', finished_at = now()
  where company_id = v_co and status = 'processing' and started_at < now() - interval '15 minutes'
    and attempts >= 3;
  with picked as (
    select id from public.ocr_jobs
    where company_id = v_co
      and (status = 'queued' or (status = 'processing' and started_at < now() - interval '15 minutes'))
    order by created_at
    limit least(greatest(coalesce(p_limit, 5), 1), 20)
    for update skip locked
  ), upd as (
    update public.ocr_jobs j set status = 'processing', started_at = now(), attempts = attempts + 1,
      agent_key_id = p_key_id
    from picked where j.id = picked.id
    returning j.*
  )
  select coalesce(jsonb_agg(jsonb_build_object('id', id, 'storage_path', storage_path, 'file_name', file_name,
           'mime_type', mime_type, 'sha256', file_sha256) order by created_at), '[]'::jsonb)
    into v_out
  from upd;
  return v_out;
end;
$$;

-- A file found by the agent itself (watched folder). Same file twice → the existing job.
create or replace function public.ocr_agent_create_job(
  p_key_id uuid, p_storage_path text, p_file_name text, p_mime text, p_size bigint, p_sha256 text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_co uuid := (select company_id from public.ocr_agent_keys where id = p_key_id and revoked_at is null);
  v_job public.ocr_jobs;
begin
  if v_co is null then
    raise exception 'OCR_KEY_INVALID' using errcode = 'P0001';
  end if;
  select * into v_job from public.ocr_jobs
  where company_id = v_co and file_sha256 = p_sha256 and status <> 'failed'
  order by created_at limit 1;
  if v_job.id is not null then
    if v_job.status in ('queued', 'processing') then
      -- sent before but never finished (e.g. the computer was switched off): finish it now
      update public.ocr_jobs set status = 'processing', started_at = now(), attempts = attempts + 1,
        agent_key_id = p_key_id where id = v_job.id;
      return jsonb_build_object('id', v_job.id, 'duplicate', false, 'status', 'processing');
    end if;
    return jsonb_build_object('id', v_job.id, 'duplicate', true, 'status', v_job.status);
  end if;
  insert into public.ocr_jobs (company_id, status, source, storage_path, file_name, mime_type, size_bytes,
                               file_sha256, agent_key_id, created_by, started_at, attempts)
  values (v_co, 'processing', 'folder', p_storage_path, p_file_name, p_mime, p_size, p_sha256, p_key_id,
          (select created_by from public.ocr_agent_keys where id = p_key_id), now(), 1)
  returning * into v_job;
  return jsonb_build_object('id', v_job.id, 'duplicate', false, 'status', v_job.status);
end;
$$;

-- Result (already schema-checked by the Edge Function) or an error for a job.
create or replace function public.ocr_agent_submit(
  p_key_id uuid, p_job_id uuid, p_raw jsonb, p_result jsonb, p_error text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_co uuid := (select company_id from public.ocr_agent_keys where id = p_key_id and revoked_at is null);
  v_job public.ocr_jobs;
begin
  if v_co is null then
    raise exception 'OCR_KEY_INVALID' using errcode = 'P0001';
  end if;
  select * into v_job from public.ocr_jobs where id = p_job_id and company_id = v_co for update;
  if v_job.id is null then
    raise exception 'OCR_JOB_NOT_FOUND' using errcode = 'P0001';
  end if;
  if v_job.status not in ('queued', 'processing', 'failed') then
    raise exception 'OCR_JOB_DONE' using errcode = 'P0001';
  end if;
  if p_error is null and (p_result is null or p_result ->> 'schema_version' is distinct from '1') then
    raise exception 'OCR_RESULT_INVALID' using errcode = 'P0001';
  end if;
  update public.ocr_jobs set
    status = case when p_error is null then 'needs_review' else 'failed' end::public.ocr_job_status,
    raw_json = p_raw, result = p_result, error = left(p_error, 2000), finished_at = now()
  where id = p_job_id
  returning * into v_job;
  return jsonb_build_object('id', v_job.id, 'status', v_job.status);
end;
$$;

revoke execute on function public.create_ocr_agent_key, public.revoke_ocr_agent_key, public.create_ocr_job,
  public.retry_ocr_job, public.ocr_overview, public.set_ocr_threshold from public, anon;
revoke execute on function public.ocr_agent_auth, public.ocr_agent_claim, public.ocr_agent_create_job,
  public.ocr_agent_submit from public, anon, authenticated;
grant execute on function public.ocr_agent_auth, public.ocr_agent_claim, public.ocr_agent_create_job,
  public.ocr_agent_submit to service_role;
