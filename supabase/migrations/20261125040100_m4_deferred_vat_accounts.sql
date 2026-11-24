-- M4 (part 2): deferred VAT accounts — additive only.

create or replace function public.account_role_type(p_role public.account_role)
returns public.account_type
language sql
immutable
as $$
  select case p_role
    when 'CASH' then 'asset'
    when 'BANK' then 'asset'
    when 'AR' then 'asset'
    when 'INPUT_VAT' then 'asset'
    when 'INPUT_VAT_DEFERRED' then 'asset'
    when 'WHT_RECEIVABLE' then 'asset'
    when 'INVENTORY' then 'asset'
    when 'AP' then 'liability'
    when 'OUTPUT_VAT' then 'liability'
    when 'OUTPUT_VAT_DEFERRED' then 'liability'
    when 'WHT_PAYABLE' then 'liability'
    when 'RETAINED_EARNINGS' then 'equity'
    when 'SALES_REVENUE' then 'revenue'
    when 'SALES_RETURNS' then 'revenue'
    when 'DEFAULT_EXPENSE' then 'expense'
  end::public.account_type;
$$;

-- Templates (all business types)
insert into public.account_templates
  (business_type, code, name_th, name_en, type, parent_code, is_group, mapping_role, sort_order)
select b.bt, v.code, v.name_th, v.name_en, v.type::public.account_type, v.parent_code, false,
       v.role::public.account_role, v.sort_order
from (values
  ('1141', 'ภาษีซื้อยังไม่ถึงกำหนด', 'Deferred input VAT', 'asset', '1100', 'INPUT_VAT_DEFERRED', 114),
  ('2121', 'ภาษีขายยังไม่ถึงกำหนด', 'Deferred output VAT', 'liability', '2100', 'OUTPUT_VAT_DEFERRED', 212)
) as v (code, name_th, name_en, type, parent_code, role, sort_order)
cross join (select unnest(enum_range(null::public.business_type)) as bt) b
on conflict do nothing;

-- Backfill existing companies: add the account (if the code is free) and the mapping.
do $$
declare
  r record;
  v_parent uuid;
  v_account uuid;
begin
  for r in
    select c.id as company_id, t.code, t.name_th, t.name_en, t.type, t.parent_code, t.mapping_role
    from public.companies c
    join public.account_templates t on t.business_type = c.business_type
    where t.mapping_role in ('OUTPUT_VAT_DEFERRED', 'INPUT_VAT_DEFERRED')
      and not exists (select 1 from public.account_mappings m
                      where m.company_id = c.id and m.role = t.mapping_role)
  loop
    select id into v_parent from public.accounts
    where company_id = r.company_id and code = r.parent_code and is_group and type = r.type;

    select id into v_account from public.accounts where company_id = r.company_id and code = r.code;
    if v_account is null then
      insert into public.accounts (company_id, code, name_th, name_en, type, parent_id, is_group, is_system)
      values (r.company_id, r.code, r.name_th, r.name_en, r.type, v_parent, false, true)
      returning id into v_account;
    end if;

    -- Only map if the existing/new account fits the role (otherwise the user maps it in the UI)
    if exists (select 1 from public.accounts a
               where a.id = v_account and a.type = r.type and not a.is_group and a.is_active) then
      insert into public.account_mappings (company_id, role, account_id)
      values (r.company_id, r.mapping_role, v_account);
    end if;
  end loop;
end;
$$;
