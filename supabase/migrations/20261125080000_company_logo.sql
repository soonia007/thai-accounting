-- Company logo: shown in the app and printed on the company's documents (PDF, share page).
-- Logos are printed on documents sent to customers, so the bucket is public-read;
-- only owner/admin of the company can upload, replace or remove (path = <company_id>/...).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('company-logos', 'company-logos', true, 2 * 1024 * 1024, array['image/png', 'image/jpeg'])
on conflict (id) do nothing;

-- Storage needs to read an object to replace or delete it (logos are public anyway)
create policy company_logos_select on storage.objects for select to authenticated
  using (bucket_id = 'company-logos');
create policy company_logos_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'company-logos'
              and private.has_role(nullif((storage.foldername(name))[1], '')::uuid, '{owner,admin}'));
create policy company_logos_update on storage.objects for update to authenticated
  using (bucket_id = 'company-logos'
         and private.has_role(nullif((storage.foldername(name))[1], '')::uuid, '{owner,admin}'));
create policy company_logos_delete on storage.objects for delete to authenticated
  using (bucket_id = 'company-logos'
         and private.has_role(nullif((storage.foldername(name))[1], '')::uuid, '{owner,admin}'));

alter table public.companies
  add constraint companies_logo_path_own_folder
  check (logo_path is null or split_part(logo_path, '/', 1) = id::text);

-- 50 Tawi print data: include the payer's logo
create or replace function public.print_wht_certificate(p_certificate_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', w.id, 'number', w.number, 'cert_date', w.cert_date, 'form', w.form, 'condition', w.condition,
    'total_income', w.total_income, 'total_tax', w.total_tax, 'voided', w.voided_at is not null,
    'source_number', coalesce(p.number, d.number),
    'payer', jsonb_build_object('name', c.name, 'tax_id', c.tax_id, 'address', c.address,
                                'branch_code', c.branch_code, 'logo_path', c.logo_path),
    'payee', jsonb_build_object('name', k.name, 'tax_id', k.tax_id, 'address', k.address,
                                'entity_type', k.entity_type, 'branch_code', k.branch_code),
    'lines', (select jsonb_agg(jsonb_build_object('income_type', l.income_type, 'name_th', t.name_th,
                'name_en', t.name_en, 'section', t.section, 'form_row', t.form_row, 'rate', l.wht_rate,
                'income_amount', l.income_amount, 'tax_amount', l.tax_amount) order by l.line_no)
              from public.wht_certificate_lines l join public.wht_income_types t on t.code = l.income_type
              where l.certificate_id = w.id))
  from public.wht_certificates w
  join public.companies c on c.id = w.company_id
  join public.contacts k on k.id = w.contact_id
  left join public.payments p on p.id = w.payment_id
  left join public.documents d on d.id = w.document_id
  where w.id = p_certificate_id and private.is_member(w.company_id);
$$;
