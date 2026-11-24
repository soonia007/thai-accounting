-- M5: sales — lists with payment status, "next step" preview, public share links.

-- ---------------------------------------------------------------------------
-- Shared aggregation of engine lines (same shape as build_journal output)
-- ---------------------------------------------------------------------------
create or replace function private.aggregate_jlines(p_lines private.jline[])
returns jsonb
language sql
immutable
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'account_id', account_id, 'role', role,
           'debit', case when side = 'D' then amount else 0 end,
           'credit', case when side = 'C' then amount else 0 end, 'sources', sources)
         order by side desc, first_ord), '[]'::jsonb)
  from (
    select account_id, side, min(role) as role, sum(amount) as amount, min(ord) as first_ord,
           jsonb_agg(distinct source) as sources
    from unnest(p_lines) x
    where amount <> 0 and account_id is not null
    group by account_id, side
  ) g;
$$;

-- Preview of the settlement that would follow a credit document (docs/DESIGN_SIMULATION.md §1.4):
-- invoice / debit_note → full receipt into the default bank; bill → full payment from it.
-- Uses the same accounts and deferred-VAT rule (D1/D2) as build_payment_journal.
create or replace function private.build_settlement_preview(p_company_id uuid, p_type public.document_type,
                                                            p_totals jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_total numeric(18, 2) := (p_totals ->> 'total')::numeric;
  v_wht numeric(18, 2) := (p_totals ->> 'wht_total')::numeric;
  v_def numeric(18, 2) := (p_totals ->> 'vat_deferred_total')::numeric;
  v_bank uuid := private.role_account(p_company_id, 'BANK');
begin
  if p_type in ('invoice', 'debit_note') then
    return private.aggregate_jlines(array[
      row(1, v_bank, 'BANK', 'D', v_total - v_wht, 'payment')::private.jline,
      row(2, case when v_wht > 0 then private.role_account(p_company_id, 'WHT_RECEIVABLE') end,
          'WHT_RECEIVABLE', 'D', v_wht, 'wht')::private.jline,
      row(3, case when v_def > 0 then private.role_account(p_company_id, 'OUTPUT_VAT_DEFERRED') end,
          'OUTPUT_VAT_DEFERRED', 'D', v_def, 'vat_transfer')::private.jline,
      row(4, private.role_account(p_company_id, 'AR'), 'AR', 'C', v_total, 'total')::private.jline,
      row(5, case when v_def > 0 then private.role_account(p_company_id, 'OUTPUT_VAT') end,
          'OUTPUT_VAT', 'C', v_def, 'vat_transfer')::private.jline]);
  elsif p_type = 'bill' then
    return private.aggregate_jlines(array[
      row(1, private.role_account(p_company_id, 'AP'), 'AP', 'D', v_total, 'total')::private.jline,
      row(2, case when v_def > 0 then private.role_account(p_company_id, 'INPUT_VAT') end,
          'INPUT_VAT', 'D', v_def, 'vat_transfer')::private.jline,
      row(3, v_bank, 'BANK', 'C', v_total - v_wht, 'payment')::private.jline,
      row(4, case when v_wht > 0 then private.role_account(p_company_id, 'WHT_PAYABLE') end,
          'WHT_PAYABLE', 'C', v_wht, 'wht')::private.jline,
      row(5, case when v_def > 0 then private.role_account(p_company_id, 'INPUT_VAT_DEFERRED') end,
          'INPUT_VAT_DEFERRED', 'C', v_def, 'vat_transfer')::private.jline]);
  elsif p_type = 'quotation' then
    -- a quotation turns into an invoice: preview that invoice
    return null;
  end if;
  return null;
end;
$$;

-- Account details for preview lines
create or replace function private.enrich_lines(p_lines jsonb, p_date date)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(x || jsonb_build_object(
      'code', a.code, 'name_th', a.name_th, 'name_en', a.name_en, 'type', a.type,
      'opening_balance', coalesce((
        select sum(jl.debit - jl.credit) from public.journal_lines jl
        join public.journal_entries je on je.id = jl.entry_id
        where jl.account_id = a.id and je.entry_date <= p_date), 0))
      order by ord), '[]'::jsonb)
  from jsonb_array_elements(coalesce(p_lines, '[]'::jsonb)) with ordinality as t(x, ord)
  join public.accounts a on a.id = (x ->> 'account_id')::uuid;
$$;

-- simulate_posting v2: adds `next` (settlement preview) and, for quotations, the invoice it becomes.
create or replace function public.simulate_posting(p_kind text, p_payload jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_company uuid := (p_payload ->> 'company_id')::uuid;
  v_built jsonb;
  v_next jsonb;
  v_date date;
  v_type public.document_type;
  v_err text;
  v_detail text;
begin
  if v_company is null or not private.is_member(v_company) then
    raise exception 'permission denied' using errcode = '42501';
  end if;

  begin
    if p_kind = 'payment' then
      v_built := private.build_payment_journal(v_company, p_payload);
      v_date := coalesce((p_payload ->> 'pay_date')::date, (now() at time zone 'Asia/Bangkok')::date);
    else
      p_payload := p_payload || jsonb_build_object('vat_rate', coalesce((p_payload ->> 'vat_rate')::numeric,
        (select vat_rate from public.companies where id = v_company)));
      v_type := (p_payload ->> 'type')::public.document_type;
      v_date := coalesce((p_payload ->> 'doc_date')::date, (now() at time zone 'Asia/Bangkok')::date);
      v_built := private.build_journal(v_company, p_payload);
      if v_type in ('quotation', 'purchase_order') then
        -- "next step" of a quotation / PO is the invoice / bill it turns into
        v_next := private.build_journal(v_company, p_payload || jsonb_build_object(
          'type', case when v_type = 'quotation' then 'invoice' else 'bill' end));
        v_next := jsonb_build_object('type', case when v_type = 'quotation' then 'invoice' else 'bill' end,
                                     'lines', v_next -> 'lines');
      elsif v_type in ('invoice', 'debit_note', 'bill') then
        v_next := jsonb_build_object('type', case when v_type = 'bill' then 'payment_paid' else 'payment_received' end,
          'lines', private.build_settlement_preview(v_company, v_type, v_built -> 'totals'));
      end if;
    end if;
  exception when sqlstate 'P0001' then
    get stacked diagnostics v_err = message_text, v_detail = pg_exception_detail;
    return jsonb_build_object('ok', false, 'error', v_err, 'detail', v_detail);
  end;

  return jsonb_build_object(
    'ok', true,
    'lines', private.enrich_lines(v_built -> 'lines', v_date),
    'totals', v_built -> 'totals',
    'line_amounts', v_built -> 'line_amounts',
    'allocations', v_built -> 'allocations',
    'next', case when v_next is null then null
                 else jsonb_build_object('type', v_next ->> 'type',
                                         'lines', private.enrich_lines(v_next -> 'lines', v_date)) end);
end;
$$;

-- ---------------------------------------------------------------------------
-- Lists with balances / payment status
--   payment_status: none (no settlement concept) | unpaid | partial | paid | overdue
-- ---------------------------------------------------------------------------
create or replace function public.list_documents(p_company_id uuid, p_types public.document_type[])
returns table (
  id uuid, type public.document_type, number text, status public.document_status, doc_date date,
  due_date date, contact_id uuid, contact_name text, ref_document_id uuid, total numeric, outstanding numeric,
  paid numeric, payment_status text, created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.is_member(p_company_id) then
    raise exception 'permission denied' using errcode = '42501';
  end if;
  return query
  select d.id, d.type, d.number, d.status, d.doc_date, d.due_date, d.contact_id, c.name, d.ref_document_id,
         d.total, b.outstanding, b.paid,
         case
           when d.status <> 'posted' or d.type not in ('invoice', 'debit_note', 'bill') then 'none'
           when b.outstanding <= 0 then 'paid'
           when d.due_date is not null and d.due_date < (now() at time zone 'Asia/Bangkok')::date then 'overdue'
           when b.paid > 0 then 'partial'
           else 'unpaid'
         end,
         d.created_at
  from public.documents d
  left join public.contacts c on c.id = d.contact_id
  left join lateral private.doc_balance(d.id) b on d.status = 'posted'
  where d.company_id = p_company_id and d.type = any (p_types)
  order by d.doc_date desc, d.created_at desc;
end;
$$;

-- Open documents a payment can settle
create or replace function public.open_documents(p_company_id uuid, p_contact_id uuid,
                                                 p_direction public.payment_direction)
returns table (
  id uuid, type public.document_type, number text, doc_date date, due_date date, total numeric,
  wht_total numeric, outstanding numeric, deferred_vat_remaining numeric
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.is_member(p_company_id) then
    raise exception 'permission denied' using errcode = '42501';
  end if;
  return query
  select d.id, d.type, d.number, d.doc_date, d.due_date, d.total, d.wht_total, b.outstanding,
         b.deferred_remaining
  from public.documents d
  cross join lateral private.doc_balance(d.id) b
  where d.company_id = p_company_id and d.contact_id = p_contact_id and d.status = 'posted'
    and d.type = any (case when p_direction = 'received' then array['invoice', 'debit_note']::public.document_type[]
                           else array['bill']::public.document_type[] end)
    and b.outstanding > 0
  order by d.doc_date, d.number;
end;
$$;

create or replace function public.list_payments(p_company_id uuid, p_direction public.payment_direction)
returns table (
  id uuid, number text, status public.document_status, pay_date date, contact_id uuid, contact_name text,
  amount numeric, wht_amount numeric, documents text, created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.is_member(p_company_id) then
    raise exception 'permission denied' using errcode = '42501';
  end if;
  return query
  select p.id, p.number, p.status, p.pay_date, p.contact_id, c.name, p.amount, p.wht_amount,
         (select string_agg(coalesce(d.number, '-'), ', ' order by d.number)
          from public.payment_allocations a join public.documents d on d.id = a.document_id
          where a.payment_id = p.id),
         p.created_at
  from public.payments p
  left join public.contacts c on c.id = p.contact_id
  where p.company_id = p_company_id and p.direction = p_direction
  order by p.pay_date desc, p.created_at desc;
end;
$$;

-- ---------------------------------------------------------------------------
-- Public share links (docs/DECISIONS.md P2)
-- ---------------------------------------------------------------------------
create table public.document_shares (
  token text primary key,
  company_id uuid not null,
  document_id uuid,
  payment_id uuid,
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  revoked_at timestamptz,
  foreign key (company_id, document_id) references public.documents (company_id, id) on delete cascade,
  foreign key (company_id, payment_id) references public.payments (company_id, id) on delete cascade,
  check ((document_id is null) <> (payment_id is null))
);

alter table public.document_shares enable row level security;
revoke all on public.document_shares from anon;
create policy document_shares_select on public.document_shares for select to authenticated
  using (private.is_member(company_id));
revoke insert, update, delete on public.document_shares from authenticated;

create or replace function public.create_share_link(p_document_id uuid default null, p_payment_id uuid default null,
                                                    p_expires_at timestamptz default null)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_company uuid;
  v_status public.document_status;
  v_token text;
begin
  if p_document_id is not null then
    select company_id, status into v_company, v_status from public.documents where id = p_document_id;
  else
    select company_id, status into v_company, v_status from public.payments where id = p_payment_id;
  end if;
  if v_company is null or not private.has_role(v_company, '{owner,admin,accountant,staff}') then
    raise exception 'permission denied' using errcode = '42501';
  end if;
  if v_status <> 'posted' then
    raise exception 'SHARE_NOT_POSTED' using errcode = 'P0001';
  end if;
  -- 2 × 122 random bits, URL-safe
  v_token := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
  insert into public.document_shares (token, company_id, document_id, payment_id, expires_at)
  values (v_token, v_company, p_document_id, p_payment_id, p_expires_at);
  return v_token;
end;
$$;

create or replace function public.revoke_share_link(p_token text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_company uuid;
begin
  select company_id into v_company from public.document_shares where token = p_token;
  if v_company is null or not private.has_role(v_company, '{owner,admin,accountant,staff}') then
    raise exception 'permission denied' using errcode = '42501';
  end if;
  update public.document_shares set revoked_at = now() where token = p_token and revoked_at is null;
end;
$$;

-- Everything the PDF needs, for one document or payment (members, or anyone with a valid token)
create or replace function private.print_payload(p_document_id uuid, p_payment_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_company uuid;
  v_contact uuid;
  v_doc jsonb;
begin
  if p_document_id is not null then
    select company_id, contact_id into v_company, v_contact from public.documents where id = p_document_id;
    select to_jsonb(d) - 'created_by' - 'posted_by' - 'voided_by'
           || jsonb_build_object('lines', coalesce((select jsonb_agg(to_jsonb(l) order by l.line_no)
                                                    from public.document_lines l where l.document_id = d.id), '[]'),
                                 'ref_number', (select r.number from public.documents r where r.id = d.ref_document_id),
                                 'ref_date', (select r.doc_date from public.documents r where r.id = d.ref_document_id),
                                 'ref_total', (select r.total from public.documents r where r.id = d.ref_document_id),
                                 'kind', 'document')
      into v_doc
    from public.documents d where d.id = p_document_id;
  else
    select company_id, contact_id into v_company, v_contact from public.payments where id = p_payment_id;
    select to_jsonb(p) - 'created_by' - 'posted_by' - 'voided_by'
           || jsonb_build_object('allocations', coalesce((
                select jsonb_agg(jsonb_build_object('number', d.number, 'doc_date', d.doc_date, 'type', d.type,
                                                    'total', d.total, 'amount', a.amount, 'wht_amount', a.wht_amount,
                                                    'vat_transferred', a.vat_transferred)
                                 order by d.number)
                from public.payment_allocations a join public.documents d on d.id = a.document_id
                where a.payment_id = p.id), '[]'),
              'kind', 'payment')
      into v_doc
    from public.payments p where p.id = p_payment_id;
  end if;

  return jsonb_build_object(
    'document', v_doc,
    'company', (select jsonb_build_object('name', name, 'name_en', name_en, 'address', address, 'tax_id', tax_id,
                                          'branch_code', branch_code, 'branch_name', branch_name, 'phone', phone,
                                          'email', email, 'vat_registered', vat_registered, 'date_era', date_era,
                                          'logo_path', logo_path)
                from public.companies where id = v_company),
    'contact', (select jsonb_build_object('name', name, 'tax_id', tax_id, 'branch_code', branch_code,
                                          'branch_name', branch_name, 'address', address, 'entity_type', entity_type,
                                          'phone', phone, 'email', email)
                from public.contacts where id = v_contact));
end;
$$;

create or replace function public.print_document(p_document_id uuid default null, p_payment_id uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_company uuid;
begin
  if p_document_id is not null then
    select company_id into v_company from public.documents where id = p_document_id;
  else
    select company_id into v_company from public.payments where id = p_payment_id;
  end if;
  if v_company is null or not private.is_member(v_company) then
    raise exception 'DOCUMENT_NOT_FOUND' using errcode = 'P0001';
  end if;
  return private.print_payload(p_document_id, p_payment_id);
end;
$$;

-- Callable without signing in: returns null for unknown, revoked or expired tokens.
create or replace function public.get_shared_document(p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_share public.document_shares;
begin
  select * into v_share from public.document_shares
  where token = p_token and revoked_at is null and (expires_at is null or expires_at > now());
  if v_share.token is null then
    return null;
  end if;
  return private.print_payload(v_share.document_id, v_share.payment_id);
end;
$$;

revoke execute on function public.list_documents, public.open_documents, public.list_payments,
  public.create_share_link, public.revoke_share_link, public.print_document from public, anon;
grant execute on function public.list_documents, public.open_documents, public.list_payments,
  public.create_share_link, public.revoke_share_link, public.print_document to authenticated;
revoke execute on function public.get_shared_document from public;
grant execute on function public.get_shared_document to anon, authenticated;
revoke execute on function private.aggregate_jlines, private.build_settlement_preview, private.enrich_lines,
  private.print_payload from public, anon, authenticated;
