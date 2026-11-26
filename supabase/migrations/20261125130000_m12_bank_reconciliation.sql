-- M12 bank reconciliation — additive only.
--   * statements imported from CSV/Excel (parsed in the browser, column mapping remembered per
--     bank) → bank_statements / bank_statement_lines (amount signed: + money in, − money out)
--   * a statement line is matched to one or more ledger lines on the bank's ledger account
--     (sum must equal); each ledger line matches at most once
--   * suggestions: same amount, date within 7 days, reference text bonus — the user confirms
--   * D15: a statement line with no book entry (bank charges, interest) → quick posted JV
--     bank ↔ chosen account on the statement date, matched immediately
--   * reconciliation as of a date: statement balance vs book balance + outstanding items
-- Voided documents (original + reversal, D3) are left out of matching and outstanding items.

create table public.bank_statements (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  bank_account_id uuid not null,
  file_name text,
  date_from date,
  date_to date,
  imported_at timestamptz not null default now(),
  imported_by uuid references auth.users (id) on delete set null default auth.uid(),
  unique (company_id, id),
  foreign key (company_id, bank_account_id) references public.bank_accounts (company_id, id) on delete cascade
);

create table public.bank_statement_lines (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  statement_id uuid not null,
  bank_account_id uuid not null,
  line_no int not null,
  txn_date date not null,
  description text not null default '',
  reference text,
  amount numeric(18, 2) not null check (amount <> 0),
  balance numeric(18, 2),
  matched_at timestamptz,
  matched_by uuid references auth.users (id) on delete set null,
  unique (statement_id, line_no),
  unique (company_id, id),
  foreign key (company_id, statement_id) references public.bank_statements (company_id, id) on delete cascade,
  foreign key (company_id, bank_account_id) references public.bank_accounts (company_id, id) on delete cascade
);
create index bank_statement_lines_account_idx on public.bank_statement_lines (bank_account_id, txn_date);

create table public.bank_matches (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  statement_line_id uuid not null,
  journal_line_id uuid not null unique,
  created_at timestamptz not null default now(),
  foreign key (company_id, statement_line_id) references public.bank_statement_lines (company_id, id) on delete cascade,
  foreign key (journal_line_id) references public.journal_lines (id) on delete cascade
);
create index bank_matches_line_idx on public.bank_matches (statement_line_id);

-- Column mapping remembered per bank (bank_code) and company
create table public.bank_import_mappings (
  company_id uuid not null references public.companies (id) on delete cascade,
  bank_code text not null,
  mapping jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (company_id, bank_code)
);

alter table public.bank_statements enable row level security;
alter table public.bank_statement_lines enable row level security;
alter table public.bank_matches enable row level security;
alter table public.bank_import_mappings enable row level security;
revoke all on public.bank_statements, public.bank_statement_lines, public.bank_matches,
  public.bank_import_mappings from anon;
revoke insert, update, delete on public.bank_statements, public.bank_statement_lines,
  public.bank_matches, public.bank_import_mappings from authenticated;
do $$
declare t text;
begin
  foreach t in array array['bank_statements', 'bank_statement_lines', 'bank_matches', 'bank_import_mappings']
  loop
    execute format('create policy %1$s_select on public.%1$s for select to authenticated
                    using (private.is_member(company_id))', t);
  end loop;
end;
$$;
create trigger bank_statements_audit after insert or update or delete on public.bank_statements
  for each row execute function private.audit();

-- ---------------------------------------------------------------------------
-- helpers
-- ---------------------------------------------------------------------------
create or replace function private.bank_account_of(p_bank_account_id uuid)
returns public.bank_accounts
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v public.bank_accounts;
begin
  select * into v from public.bank_accounts where id = p_bank_account_id;
  if v.id is null or not private.is_member(v.company_id) then
    raise exception 'BANK_ACCOUNT_NOT_FOUND' using errcode = 'P0001';
  end if;
  return v;
end;
$$;

-- Ledger lines on the bank's account that take part in reconciliation (voided pairs excluded).
create or replace function private.bank_book_lines(p_bank_account_id uuid)
returns table (
  journal_line_id uuid, entry_date date, amount numeric, ref text, description text,
  contact text, statement_line_id uuid)
language sql
stable
security definer
set search_path = ''
as $$
  select l.id, e.entry_date, l.debit - l.credit,
         coalesce(d.number, p.number, mj.number), coalesce(l.description, e.description),
         c.name, m.statement_line_id
  from public.bank_accounts b
  join public.journal_lines l on l.account_id = b.account_id and l.company_id = b.company_id
  join public.journal_entries e on e.id = l.entry_id
  left join public.documents d on d.id = e.document_id
  left join public.payments p on p.id = e.payment_id
  left join public.manual_journals mj on mj.id = e.manual_journal_id
  left join public.contacts c on c.id = l.contact_id
  left join public.bank_matches m on m.journal_line_id = l.id
  where b.id = p_bank_account_id
    and e.reverses_entry_id is null
    and not exists (select 1 from public.journal_entries r where r.reverses_entry_id = e.id);
$$;

-- ---------------------------------------------------------------------------
-- import
-- ---------------------------------------------------------------------------
-- p_lines: [{txn_date, description, reference, amount, balance}] (already parsed and signed)
-- Lines identical to ones already imported for this bank account (date + amount + description
-- + balance) are skipped so overlapping statements can be imported safely.
create or replace function public.import_bank_statement(
  p_bank_account_id uuid, p_file_name text, p_lines jsonb, p_mapping jsonb default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_bank public.bank_accounts := private.bank_account_of(p_bank_account_id);
  v_id uuid;
  v_inserted int;
  v_total int := jsonb_array_length(coalesce(p_lines, '[]'));
begin
  if not private.has_role(v_bank.company_id, '{owner,admin,accountant}') then
    raise exception 'permission denied' using errcode = '42501';
  end if;
  if v_total = 0 then
    raise exception 'BANK_STATEMENT_EMPTY' using errcode = 'P0001';
  end if;
  if exists (select 1 from jsonb_array_elements(p_lines) x
             where nullif(x ->> 'txn_date', '') is null or coalesce((x ->> 'amount')::numeric, 0) = 0
                or (x ->> 'amount')::numeric <> round((x ->> 'amount')::numeric, 2)) then
    raise exception 'BANK_STATEMENT_LINE_INVALID' using errcode = 'P0001';
  end if;

  insert into public.bank_statements (company_id, bank_account_id, file_name, date_from, date_to)
  select v_bank.company_id, v_bank.id, p_file_name, min((x ->> 'txn_date')::date), max((x ->> 'txn_date')::date)
  from jsonb_array_elements(p_lines) x
  returning id into v_id;

  insert into public.bank_statement_lines (company_id, statement_id, bank_account_id, line_no,
    txn_date, description, reference, amount, balance)
  select v_bank.company_id, v_id, v_bank.id, x.ord::int, (x.l ->> 'txn_date')::date,
         coalesce(trim(x.l ->> 'description'), ''), nullif(trim(x.l ->> 'reference'), ''),
         (x.l ->> 'amount')::numeric, nullif(x.l ->> 'balance', '')::numeric
  from jsonb_array_elements(p_lines) with ordinality as x(l, ord)
  where not exists (
    select 1 from public.bank_statement_lines o
    where o.bank_account_id = v_bank.id and o.txn_date = (x.l ->> 'txn_date')::date
      and o.amount = (x.l ->> 'amount')::numeric
      and o.description = coalesce(trim(x.l ->> 'description'), '')
      and o.balance is not distinct from nullif(x.l ->> 'balance', '')::numeric);
  get diagnostics v_inserted = row_count;

  if v_inserted = 0 then
    delete from public.bank_statements where id = v_id;
    v_id := null;
  end if;
  if p_mapping is not null then
    insert into public.bank_import_mappings (company_id, bank_code, mapping)
    values (v_bank.company_id, v_bank.bank_code, p_mapping)
    on conflict (company_id, bank_code) do update set mapping = excluded.mapping, updated_at = now();
  end if;
  return jsonb_build_object('statement_id', v_id, 'inserted', v_inserted, 'skipped', v_total - v_inserted);
end;
$$;

-- ---------------------------------------------------------------------------
-- working view: unmatched / matched statement lines + unmatched book lines
-- ---------------------------------------------------------------------------
create or replace function public.bank_reconcile_data(p_bank_account_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_bank public.bank_accounts := private.bank_account_of(p_bank_account_id);
begin
  return jsonb_build_object(
    'statement', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', s.id, 'txn_date', s.txn_date, 'description', s.description,
               'reference', s.reference, 'amount', s.amount, 'balance', s.balance,
               'matched', s.matched_at is not null,
               'book', (select coalesce(jsonb_agg(jsonb_build_object(
                          'ref', b.ref, 'entry_date', b.entry_date, 'amount', b.amount)), '[]'::jsonb)
                        from private.bank_book_lines(v_bank.id) b where b.statement_line_id = s.id))
             order by s.txn_date, s.line_no)
      from public.bank_statement_lines s where s.bank_account_id = v_bank.id), '[]'::jsonb),
    'book', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', b.journal_line_id, 'entry_date', b.entry_date, 'amount', b.amount,
               'ref', b.ref, 'description', b.description, 'contact', b.contact)
             order by b.entry_date, b.ref)
      from private.bank_book_lines(v_bank.id) b where b.statement_line_id is null), '[]'::jsonb),
    'mapping', (select mapping from public.bank_import_mappings
                where company_id = v_bank.company_id and bank_code = v_bank.bank_code));
end;
$$;

-- Suggested 1:1 pairs: same amount, within 7 days; best score wins, each side used once.
create or replace function public.bank_match_suggestions(p_bank_account_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_bank public.bank_accounts := private.bank_account_of(p_bank_account_id);
  v_out jsonb := '[]';
  v_used_s uuid[] := '{}';
  v_used_b uuid[] := '{}';
  r record;
begin
  for r in
    select s.id as sid, b.journal_line_id as bid,
           100 - abs(s.txn_date - b.entry_date) * 10
             + case when b.ref is not null and (s.description ilike '%' || b.ref || '%'
                                                or coalesce(s.reference, '') ilike '%' || b.ref || '%')
                    then 50 else 0 end
             + case when b.contact is not null and s.description ilike '%' || b.contact || '%' then 20 else 0 end
             as score
    from public.bank_statement_lines s
    join private.bank_book_lines(v_bank.id) b
      on b.statement_line_id is null and b.amount = s.amount and abs(s.txn_date - b.entry_date) <= 7
    where s.bank_account_id = v_bank.id and s.matched_at is null
    order by score desc, s.txn_date, b.entry_date
  loop
    continue when r.sid = any (v_used_s) or r.bid = any (v_used_b);
    v_used_s := v_used_s || r.sid;
    v_used_b := v_used_b || r.bid;
    v_out := v_out || jsonb_build_object('statement_line_id', r.sid, 'journal_line_id', r.bid, 'score', r.score);
  end loop;
  return v_out;
end;
$$;

create or replace function public.match_bank_line(p_statement_line_id uuid, p_journal_line_ids uuid[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_s public.bank_statement_lines;
  v_sum numeric;
  v_n int;
begin
  select * into v_s from public.bank_statement_lines where id = p_statement_line_id for update;
  if v_s.id is null or not private.is_member(v_s.company_id) then
    raise exception 'BANK_LINE_NOT_FOUND' using errcode = 'P0001';
  end if;
  if not private.has_role(v_s.company_id, '{owner,admin,accountant}') then
    raise exception 'permission denied' using errcode = '42501';
  end if;
  if v_s.matched_at is not null then
    raise exception 'BANK_LINE_ALREADY_MATCHED' using errcode = 'P0001';
  end if;
  select count(*), coalesce(sum(b.amount), 0) into v_n, v_sum
  from private.bank_book_lines(v_s.bank_account_id) b
  where b.journal_line_id = any (p_journal_line_ids) and b.statement_line_id is null;
  if v_n = 0 or v_n <> cardinality(p_journal_line_ids) then
    raise exception 'BANK_BOOK_LINE_INVALID' using errcode = 'P0001';
  end if;
  if v_sum <> v_s.amount then
    raise exception 'BANK_MATCH_AMOUNT_MISMATCH' using errcode = 'P0001';
  end if;
  insert into public.bank_matches (company_id, statement_line_id, journal_line_id)
  select v_s.company_id, v_s.id, unnest(p_journal_line_ids);
  update public.bank_statement_lines set matched_at = now(), matched_by = auth.uid() where id = v_s.id;
end;
$$;

create or replace function public.unmatch_bank_line(p_statement_line_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_s public.bank_statement_lines;
begin
  select * into v_s from public.bank_statement_lines where id = p_statement_line_id for update;
  if v_s.id is null or not private.is_member(v_s.company_id) then
    raise exception 'BANK_LINE_NOT_FOUND' using errcode = 'P0001';
  end if;
  if not private.has_role(v_s.company_id, '{owner,admin,accountant}') then
    raise exception 'permission denied' using errcode = '42501';
  end if;
  delete from public.bank_matches where statement_line_id = v_s.id;
  update public.bank_statement_lines set matched_at = null, matched_by = null where id = v_s.id;
end;
$$;

-- D15: bank charges / interest etc. — post a JV (bank ↔ p_account_id) and match it.
create or replace function public.create_bank_adjustment(
  p_statement_line_id uuid, p_account_id uuid, p_memo text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_s public.bank_statement_lines;
  v_bank public.bank_accounts;
  v_jv uuid;
  v_amt numeric(18, 2);
  v_line uuid;
begin
  select * into v_s from public.bank_statement_lines where id = p_statement_line_id;
  if v_s.id is null or not private.is_member(v_s.company_id) then
    raise exception 'BANK_LINE_NOT_FOUND' using errcode = 'P0001';
  end if;
  if v_s.matched_at is not null then
    raise exception 'BANK_LINE_ALREADY_MATCHED' using errcode = 'P0001';
  end if;
  select * into v_bank from public.bank_accounts where id = v_s.bank_account_id;
  if p_account_id = v_bank.account_id then
    raise exception 'BANK_ADJUSTMENT_ACCOUNT' using errcode = 'P0001';
  end if;
  v_amt := abs(v_s.amount);
  -- save + post go through the M7 rules (roles, account checks, D9: no AR/AP)
  v_jv := public.save_manual_journal(jsonb_build_object(
    'company_id', v_s.company_id, 'entry_date', v_s.txn_date,
    'memo', coalesce(nullif(trim(p_memo), ''), v_s.description),
    'reference', v_s.reference,
    'lines', jsonb_build_array(
      jsonb_build_object('account_id', v_bank.account_id, 'description', v_s.description,
        'debit', case when v_s.amount > 0 then v_amt else 0 end,
        'credit', case when v_s.amount < 0 then v_amt else 0 end),
      jsonb_build_object('account_id', p_account_id, 'description', v_s.description,
        'debit', case when v_s.amount < 0 then v_amt else 0 end,
        'credit', case when v_s.amount > 0 then v_amt else 0 end))));
  perform public.post_manual_journal(v_jv);

  select l.id into v_line
  from public.journal_entries e join public.journal_lines l on l.entry_id = e.id
  where e.manual_journal_id = v_jv and l.account_id = v_bank.account_id;
  perform public.match_bank_line(v_s.id, array[v_line]);
  return v_jv;
end;
$$;

-- Reconciliation as of a date. Statement balance: the last imported balance on or before the
-- date (or p_statement_balance when given / no balance column was imported).
create or replace function public.bank_reconciliation(
  p_bank_account_id uuid, p_as_of date, p_statement_balance numeric default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_bank public.bank_accounts := private.bank_account_of(p_bank_account_id);
  v_book numeric(18, 2);
  v_stmt numeric(18, 2);
  v_book_open jsonb;
  v_stmt_open jsonb;
  v_book_out numeric(18, 2);
  v_stmt_out numeric(18, 2);
begin
  select coalesce(sum(l.debit - l.credit), 0) into v_book
  from public.journal_lines l join public.journal_entries e on e.id = l.entry_id
  where l.account_id = v_bank.account_id and e.entry_date <= p_as_of;

  v_stmt := p_statement_balance;
  if v_stmt is null then
    select s.balance into v_stmt from public.bank_statement_lines s
    where s.bank_account_id = v_bank.id and s.txn_date <= p_as_of and s.balance is not null
    order by s.txn_date desc, s.statement_id desc, s.line_no desc limit 1;
  end if;

  -- in the books, not (yet) on the statement: deposits in transit (+) / unpresented payments (−)
  select coalesce(jsonb_agg(jsonb_build_object('date', b.entry_date, 'ref', b.ref,
           'description', b.description, 'contact', b.contact, 'amount', b.amount)
           order by b.entry_date, b.ref), '[]'::jsonb),
         coalesce(sum(b.amount), 0)
    into v_book_open, v_book_out
  from private.bank_book_lines(v_bank.id) b
  where b.entry_date <= p_as_of
    and (b.statement_line_id is null
         or (select s.txn_date from public.bank_statement_lines s where s.id = b.statement_line_id) > p_as_of);

  -- on the statement, not in the books: charges / interest / unknown receipts
  select coalesce(jsonb_agg(jsonb_build_object('date', s.txn_date, 'ref', s.reference,
           'description', s.description, 'amount', s.amount) order by s.txn_date, s.line_no), '[]'::jsonb),
         coalesce(sum(s.amount), 0)
    into v_stmt_open, v_stmt_out
  from public.bank_statement_lines s
  where s.bank_account_id = v_bank.id and s.txn_date <= p_as_of
    and (s.matched_at is null
         or not exists (select 1 from public.bank_matches m join public.journal_lines l on l.id = m.journal_line_id
                        join public.journal_entries e on e.id = l.entry_id
                        where m.statement_line_id = s.id and e.entry_date <= p_as_of));

  return jsonb_build_object(
    'as_of', p_as_of,
    'book_balance', v_book,
    'statement_balance', v_stmt,
    'book_not_on_statement', v_book_open,
    'book_not_on_statement_total', v_book_out,
    'statement_not_in_book', v_stmt_open,
    'statement_not_in_book_total', v_stmt_out,
    -- statement + items only in the books − items only on the statement = books
    'difference', case when v_stmt is null then null else v_stmt + v_book_out - v_stmt_out - v_book end);
end;
$$;

revoke execute on function public.import_bank_statement, public.bank_reconcile_data,
  public.bank_match_suggestions, public.match_bank_line, public.unmatch_bank_line,
  public.create_bank_adjustment, public.bank_reconciliation from public, anon;
grant execute on function public.import_bank_statement, public.bank_reconcile_data,
  public.bank_match_suggestions, public.match_bank_line, public.unmatch_bank_line,
  public.create_bank_adjustment, public.bank_reconciliation to authenticated;
revoke execute on function private.bank_account_of, private.bank_book_lines from public, anon;
