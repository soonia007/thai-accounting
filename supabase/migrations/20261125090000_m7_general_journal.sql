-- M7: general journal (manual / adjusting entries).
-- Draft → post (gap-free JV number, journal entry, audit) → void (reversal on the same date, D3).
-- D9: the mapped AR / AP accounts cannot be used here — receivables and payables move only
-- through documents, so the ledger always matches the per-document balances.

create table public.manual_journals (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  number text,
  status public.document_status not null default 'draft',
  entry_date date not null default (now() at time zone 'Asia/Bangkok')::date,
  memo text,
  reference text,
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  posted_at timestamptz,
  posted_by uuid references auth.users (id) on delete set null,
  voided_at timestamptz,
  voided_by uuid references auth.users (id) on delete set null,
  void_reason text,
  unique (company_id, id),
  unique (company_id, number)
);
create index manual_journals_company_date_idx on public.manual_journals (company_id, entry_date desc);

create table public.manual_journal_lines (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  journal_id uuid not null,
  line_no int not null,
  account_id uuid,
  description text,
  debit numeric(18, 2) not null default 0 check (debit >= 0),
  credit numeric(18, 2) not null default 0 check (credit >= 0),
  contact_id uuid,
  foreign key (company_id, journal_id) references public.manual_journals (company_id, id) on delete cascade,
  foreign key (company_id, account_id) references public.accounts (company_id, id),
  foreign key (company_id, contact_id) references public.contacts (company_id, id)
);
create index manual_journal_lines_journal_idx on public.manual_journal_lines (journal_id, line_no);

alter table public.journal_entries add column manual_journal_id uuid;
alter table public.journal_entries
  add constraint journal_entries_manual_journal_fk
  foreign key (company_id, manual_journal_id) references public.manual_journals (company_id, id)
  on delete restrict;

create trigger manual_journals_updated_at before update on public.manual_journals
  for each row execute function private.set_updated_at();
-- posted / voided entries are frozen (only the engine changes them)
create trigger manual_journals_guard before update or delete on public.manual_journals
  for each row execute function private.guard_posted_document();

create or replace function private.guard_manual_journal_lines()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status public.document_status;
begin
  select status into v_status from public.manual_journals
  where id = coalesce(new.journal_id, old.journal_id);
  if v_status is not null and v_status <> 'draft'
     and current_setting('app.engine', true) is distinct from 'on' then
    raise exception 'DOCUMENT_NOT_DRAFT' using errcode = 'P0001';
  end if;
  return coalesce(new, old);
end;
$$;
create trigger manual_journal_lines_guard before insert or update or delete on public.manual_journal_lines
  for each row execute function private.guard_manual_journal_lines();

create trigger manual_journals_audit after insert or update or delete on public.manual_journals
  for each row execute function private.audit();

-- RLS: members read; owner/admin/accountant prepare drafts (adjusting entries are accountant work)
alter table public.manual_journals enable row level security;
alter table public.manual_journal_lines enable row level security;
revoke all on public.manual_journals, public.manual_journal_lines from anon;
do $$
declare t text;
begin
  foreach t in array array['manual_journals', 'manual_journal_lines']
  loop
    execute format($f$
      create policy %1$s_select on public.%1$s for select to authenticated
        using (private.is_member(company_id));
      create policy %1$s_insert on public.%1$s for insert to authenticated
        with check (private.has_role(company_id, '{owner,admin,accountant}'));
      create policy %1$s_update on public.%1$s for update to authenticated
        using (private.has_role(company_id, '{owner,admin,accountant}'))
        with check (private.has_role(company_id, '{owner,admin,accountant}'));
      create policy %1$s_delete on public.%1$s for delete to authenticated
        using (private.has_role(company_id, '{owner,admin,accountant}'));
    $f$, t);
  end loop;
end;
$$;
revoke insert, update on public.manual_journals from authenticated;
grant insert (company_id, entry_date, memo, reference) on public.manual_journals to authenticated;
grant update (entry_date, memo, reference) on public.manual_journals to authenticated;

-- ---------------------------------------------------------------------------
-- Validation shared by simulation and posting (pure: reads master data only)
-- payload: { company_id, entry_date, memo, lines: [{account_id, description, debit, credit, contact_id}] }
-- returns { lines: [{account_id, debit, credit, role, sources}], totals: {debit, credit} }
-- ---------------------------------------------------------------------------
create or replace function private.build_manual_journal(p_company_id uuid, p_payload jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  l jsonb;
  v_acc public.accounts;
  v_dr numeric(18, 2);
  v_cr numeric(18, 2);
  v_sum_dr numeric(18, 2) := 0;
  v_sum_cr numeric(18, 2) := 0;
  v_out jsonb := '[]';
  v_n int := 0;
begin
  for l in select value from jsonb_array_elements(coalesce(p_payload -> 'lines', '[]'))
  loop
    v_dr := coalesce(nullif(l ->> 'debit', '')::numeric, 0);
    v_cr := coalesce(nullif(l ->> 'credit', '')::numeric, 0);
    -- blank rows in the form are ignored
    if nullif(l ->> 'account_id', '') is null and v_dr = 0 and v_cr = 0 then
      continue;
    end if;
    if nullif(l ->> 'account_id', '') is null then
      raise exception 'JOURNAL_LINE_ACCOUNT_REQUIRED' using errcode = 'P0001';
    end if;
    if v_dr < 0 or v_cr < 0 or round(v_dr, 2) <> v_dr or round(v_cr, 2) <> v_cr then
      raise exception 'JOURNAL_LINE_AMOUNT_INVALID' using errcode = 'P0001';
    end if;
    if (v_dr > 0) = (v_cr > 0) then
      raise exception 'JOURNAL_LINE_ONE_SIDE' using errcode = 'P0001';
    end if;
    select * into v_acc from public.accounts
    where id = (l ->> 'account_id')::uuid and company_id = p_company_id;
    if v_acc.id is null then
      raise exception 'ACCOUNT_NOT_FOUND' using errcode = 'P0001';
    end if;
    if v_acc.is_group then
      raise exception 'JOURNAL_GROUP_ACCOUNT' using errcode = 'P0001', detail = v_acc.code;
    end if;
    if not v_acc.is_active then
      raise exception 'JOURNAL_INACTIVE_ACCOUNT' using errcode = 'P0001', detail = v_acc.code;
    end if;
    if exists (select 1 from public.account_mappings m
               where m.company_id = p_company_id and m.account_id = v_acc.id and m.role in ('AR', 'AP')) then
      raise exception 'MANUAL_JOURNAL_CONTROL_ACCOUNT' using errcode = 'P0001', detail = v_acc.code; -- D9
    end if;
    v_n := v_n + 1;
    v_sum_dr := v_sum_dr + v_dr;
    v_sum_cr := v_sum_cr + v_cr;
    v_out := v_out || jsonb_build_object('account_id', v_acc.id, 'debit', v_dr, 'credit', v_cr,
      'role', null, 'sources', jsonb_build_array('manual'), 'line', v_n,
      'description', nullif(l ->> 'description', ''), 'contact_id', nullif(l ->> 'contact_id', ''));
  end loop;

  if v_n < 2 then
    raise exception 'JOURNAL_TOO_FEW_LINES' using errcode = 'P0001';
  end if;
  if v_sum_dr <> v_sum_cr then
    raise exception 'JOURNAL_NOT_BALANCED' using errcode = 'P0001',
      detail = format('debit %s, credit %s', v_sum_dr, v_sum_cr);
  end if;
  return jsonb_build_object('lines', v_out, 'totals', jsonb_build_object('debit', v_sum_dr, 'credit', v_sum_cr));
end;
$$;

-- Live preview for the form (never writes; errors come back as data)
create or replace function public.simulate_manual_journal(p_payload jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_company uuid := (p_payload ->> 'company_id')::uuid;
  v_built jsonb;
  v_err text;
  v_detail text;
begin
  if v_company is null or not private.is_member(v_company) then
    raise exception 'permission denied' using errcode = '42501';
  end if;
  begin
    v_built := private.build_manual_journal(v_company, p_payload);
  exception when sqlstate 'P0001' then
    get stacked diagnostics v_err = message_text, v_detail = pg_exception_detail;
    return jsonb_build_object('ok', false, 'error', v_err, 'detail', v_detail);
  end;
  return jsonb_build_object('ok', true,
    'lines', private.enrich_lines(v_built -> 'lines',
                                  coalesce((p_payload ->> 'entry_date')::date, (now() at time zone 'Asia/Bangkok')::date)),
    'totals', v_built -> 'totals');
end;
$$;

-- Save a draft (create or replace its lines). Incomplete drafts are allowed; posting validates.
create or replace function public.save_manual_journal(p_payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_company uuid := (p_payload ->> 'company_id')::uuid;
  v_id uuid := nullif(p_payload ->> 'id', '')::uuid;
  v_status public.document_status;
begin
  if not private.has_role(v_company, '{owner,admin,accountant}') then
    raise exception 'permission denied' using errcode = '42501';
  end if;
  if v_id is null then
    insert into public.manual_journals (company_id, entry_date, memo, reference)
    values (v_company, coalesce((p_payload ->> 'entry_date')::date, (now() at time zone 'Asia/Bangkok')::date),
            nullif(p_payload ->> 'memo', ''), nullif(p_payload ->> 'reference', ''))
    returning id into v_id;
  else
    select status into v_status from public.manual_journals where id = v_id and company_id = v_company for update;
    if v_status is null then
      raise exception 'DOCUMENT_NOT_FOUND' using errcode = 'P0001';
    end if;
    if v_status <> 'draft' then
      raise exception 'DOCUMENT_NOT_DRAFT' using errcode = 'P0001';
    end if;
    update public.manual_journals set
      entry_date = coalesce((p_payload ->> 'entry_date')::date, entry_date),
      memo = nullif(p_payload ->> 'memo', ''),
      reference = nullif(p_payload ->> 'reference', '')
    where id = v_id;
    delete from public.manual_journal_lines where journal_id = v_id;
  end if;

  insert into public.manual_journal_lines (company_id, journal_id, line_no, account_id, description, debit, credit, contact_id)
  select v_company, v_id, x.ord::int, nullif(x.l ->> 'account_id', '')::uuid, nullif(x.l ->> 'description', ''),
         coalesce(nullif(x.l ->> 'debit', '')::numeric, 0), coalesce(nullif(x.l ->> 'credit', '')::numeric, 0),
         nullif(x.l ->> 'contact_id', '')::uuid
  from jsonb_array_elements(coalesce(p_payload -> 'lines', '[]')) with ordinality as x(l, ord)
  where nullif(x.l ->> 'account_id', '') is not null
     or coalesce(nullif(x.l ->> 'debit', '')::numeric, 0) <> 0
     or coalesce(nullif(x.l ->> 'credit', '')::numeric, 0) <> 0;
  return v_id;
end;
$$;

create or replace function private.manual_journal_payload(p_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object('company_id', j.company_id, 'entry_date', j.entry_date, 'memo', j.memo,
    'lines', coalesce((select jsonb_agg(jsonb_build_object('account_id', l.account_id, 'description', l.description,
                                                          'debit', l.debit, 'credit', l.credit, 'contact_id', l.contact_id)
                                        order by l.line_no)
                       from public.manual_journal_lines l where l.journal_id = j.id), '[]'))
  from public.manual_journals j where j.id = p_id;
$$;

create or replace function public.post_manual_journal(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_j public.manual_journals;
  v_built jsonb;
  v_number text;
  v_entry uuid;
begin
  select * into v_j from public.manual_journals where id = p_id for update;
  if v_j.id is null or not private.is_member(v_j.company_id) then
    raise exception 'DOCUMENT_NOT_FOUND' using errcode = 'P0001';
  end if;
  if not private.has_role(v_j.company_id, '{owner,admin,accountant}') then
    raise exception 'permission denied' using errcode = '42501';
  end if;
  if v_j.status <> 'draft' then
    raise exception 'DOCUMENT_NOT_DRAFT' using errcode = 'P0001';
  end if;

  v_built := private.build_manual_journal(v_j.company_id, private.manual_journal_payload(v_j.id));
  v_number := private.next_number(v_j.company_id, 'manual_journal', v_j.entry_date);

  perform set_config('app.engine', 'on', true);
  insert into public.journal_entries (company_id, entry_date, manual_journal_id, description)
  values (v_j.company_id, v_j.entry_date, v_j.id, coalesce(v_number || ' ' || v_j.memo, v_number))
  returning id into v_entry;
  insert into public.journal_lines (company_id, entry_id, line_no, account_id, debit, credit, description, contact_id)
  select v_j.company_id, v_entry, (x ->> 'line')::int, (x ->> 'account_id')::uuid,
         (x ->> 'debit')::numeric, (x ->> 'credit')::numeric, x ->> 'description', nullif(x ->> 'contact_id', '')::uuid
  from jsonb_array_elements(v_built -> 'lines') x;
  update public.manual_journals set status = 'posted', number = v_number, posted_at = now(), posted_by = auth.uid()
  where id = v_j.id;
  perform set_config('app.engine', 'off', true);
  return jsonb_build_object('number', v_number, 'entry_id', v_entry);
end;
$$;

create or replace function public.void_manual_journal(p_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_j public.manual_journals;
  v_entry uuid;
  v_rev uuid;
begin
  select * into v_j from public.manual_journals where id = p_id for update;
  if v_j.id is null or not private.is_member(v_j.company_id) then
    raise exception 'DOCUMENT_NOT_FOUND' using errcode = 'P0001';
  end if;
  if not private.has_role(v_j.company_id, '{owner,admin,accountant}') then
    raise exception 'permission denied' using errcode = '42501';
  end if;
  if v_j.status <> 'posted' then
    raise exception 'DOCUMENT_NOT_POSTED' using errcode = 'P0001';
  end if;
  if nullif(trim(p_reason), '') is null then
    raise exception 'VOID_REASON_REQUIRED' using errcode = 'P0001';
  end if;

  perform set_config('app.engine', 'on', true);
  select id into v_entry from public.journal_entries where manual_journal_id = v_j.id and reverses_entry_id is null;
  -- D3: the reversal carries the original date, so the period nets to zero
  insert into public.journal_entries (company_id, entry_date, manual_journal_id, description, reverses_entry_id)
  values (v_j.company_id, v_j.entry_date, v_j.id, 'VOID ' || v_j.number, v_entry)
  returning id into v_rev;
  insert into public.journal_lines (company_id, entry_id, line_no, account_id, debit, credit, description, contact_id)
  select company_id, v_rev, line_no, account_id, credit, debit, description, contact_id
  from public.journal_lines where entry_id = v_entry;
  update public.manual_journals set status = 'voided', voided_at = now(), voided_by = auth.uid(),
    void_reason = trim(p_reason)
  where id = v_j.id;
  perform set_config('app.engine', 'off', true);
end;
$$;

revoke execute on function public.simulate_manual_journal, public.save_manual_journal,
  public.post_manual_journal, public.void_manual_journal from public, anon;
grant execute on function public.simulate_manual_journal, public.save_manual_journal,
  public.post_manual_journal, public.void_manual_journal to authenticated;
revoke execute on function private.build_manual_journal, private.manual_journal_payload,
  private.guard_manual_journal_lines from public, anon, authenticated;

-- JV number series
create or replace function private.next_number(p_company_id uuid, p_series text, p_date date)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_settings jsonb;
  v_prefix text;
  v_reset text;
  v_digits int;
  v_year int;
  v_period text;
  v_n int;
begin
  select doc_number_settings -> p_series into v_settings from public.companies where id = p_company_id;
  v_prefix := coalesce(v_settings ->> 'prefix', case p_series
    when 'quotation' then 'QT' when 'invoice' then 'INV' when 'cash_sale' then 'CS'
    when 'credit_note' then 'CN' when 'debit_note' then 'DN' when 'purchase_order' then 'PO'
    when 'bill' then 'EXP' when 'cash_purchase' then 'CP'
    when 'payment_received' then 'RV' when 'payment_paid' then 'PV'
    when 'wht_certificate' then 'WHT' when 'manual_journal' then 'JV' else upper(p_series) end);
  v_reset := coalesce(v_settings ->> 'reset', 'yearly');
  v_digits := coalesce((v_settings ->> 'digits')::int, 4);
  v_year := extract(year from p_date)::int + case when v_settings ->> 'era' = 'BE' then 543 else 0 end;
  v_period := case when v_reset = 'monthly'
                   then v_year::text || to_char(p_date, 'MM')
                   else v_year::text end;

  insert into public.doc_sequences (company_id, series, period_key, last_number)
  values (p_company_id, p_series, v_period, 0)
  on conflict do nothing;

  -- Row lock: concurrent posts in the same series wait; a rolled-back post releases its number.
  update public.doc_sequences set last_number = last_number + 1
  where company_id = p_company_id and series = p_series and period_key = v_period
  returning last_number into v_n;

  return v_prefix || '-' || v_period || '-' || lpad(v_n::text, v_digits, '0');
end;
$$;

