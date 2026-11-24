-- M2: chart-of-accounts integrity rules, enforced in the DB so every client gets the same behaviour.
--
-- Errors are raised with errcode P0001 and a stable UPPER_SNAKE message the UI translates
-- (src/features/accounts/errors.ts).

-- Which account type each mapping role must point to.
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
    when 'WHT_RECEIVABLE' then 'asset'
    when 'INVENTORY' then 'asset'
    when 'AP' then 'liability'
    when 'OUTPUT_VAT' then 'liability'
    when 'WHT_PAYABLE' then 'liability'
    when 'RETAINED_EARNINGS' then 'equity'
    when 'SALES_REVENUE' then 'revenue'
    when 'SALES_RETURNS' then 'revenue'
    when 'DEFAULT_EXPENSE' then 'expense'
  end::public.account_type;
$$;

-- ---------------------------------------------------------------------------
-- accounts
-- ---------------------------------------------------------------------------
-- SECURITY INVOKER on purpose: current_user tells API callers ('authenticated') apart from the
-- template loader (runs as the table owner). Callers can read everything this checks via RLS.
create or replace function private.validate_account()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_parent public.accounts;
  v_ancestor uuid;
  v_depth int := 0;
  v_is_mapped boolean := false;
  v_has_children boolean := false;
  v_has_active_children boolean := false;
begin
  new.code := trim(new.code);
  new.name_th := trim(new.name_th);
  new.name_en := nullif(trim(new.name_en), '');

  if new.name_th = '' then
    raise exception 'ACCOUNT_NAME_REQUIRED' using errcode = 'P0001';
  end if;

  if tg_op = 'UPDATE' then
    if new.company_id <> old.company_id then
      raise exception 'ACCOUNT_COMPANY_IMMUTABLE' using errcode = 'P0001';
    end if;
    -- is_system is set only by the template loader
    new.is_system := old.is_system;

    select exists (select 1 from public.account_mappings m where m.account_id = new.id)
      into v_is_mapped;
    select exists (select 1 from public.accounts c where c.parent_id = new.id),
           exists (select 1 from public.accounts c where c.parent_id = new.id and c.is_active)
      into v_has_children, v_has_active_children;

    if new.type <> old.type then
      if old.is_system then
        raise exception 'ACCOUNT_SYSTEM_TYPE_LOCKED' using errcode = 'P0001';
      end if;
      if v_has_children then
        raise exception 'ACCOUNT_HAS_CHILDREN' using errcode = 'P0001';
      end if;
      if v_is_mapped then
        raise exception 'ACCOUNT_IS_MAPPED' using errcode = 'P0001';
      end if;
    end if;

    if new.is_group <> old.is_group then
      if old.is_system then
        raise exception 'ACCOUNT_SYSTEM_GROUP_LOCKED' using errcode = 'P0001';
      end if;
      if old.is_group and v_has_children then
        raise exception 'ACCOUNT_HAS_CHILDREN' using errcode = 'P0001';
      end if;
      if new.is_group and v_is_mapped then
        raise exception 'ACCOUNT_IS_MAPPED' using errcode = 'P0001';
      end if;
      -- M4 will also block turning an account with journal lines into a group.
    end if;

    if old.is_active and not new.is_active then
      if v_is_mapped then
        raise exception 'ACCOUNT_IS_MAPPED' using errcode = 'P0001';
      end if;
      if v_has_active_children then
        raise exception 'ACCOUNT_HAS_ACTIVE_CHILDREN' using errcode = 'P0001';
      end if;
    end if;
  else
    -- Only the template loader (SECURITY DEFINER, runs as owner) may create system accounts.
    if current_user in ('authenticated', 'anon') then
      new.is_system := false;
    end if;
  end if;

  if new.parent_id is not null then
    select * into v_parent from public.accounts where id = new.parent_id;
    if v_parent.id is null or v_parent.company_id <> new.company_id then
      raise exception 'ACCOUNT_PARENT_NOT_FOUND' using errcode = 'P0001';
    end if;
    if not v_parent.is_group then
      raise exception 'ACCOUNT_PARENT_NOT_GROUP' using errcode = 'P0001';
    end if;
    if v_parent.type <> new.type then
      raise exception 'ACCOUNT_PARENT_TYPE_MISMATCH' using errcode = 'P0001';
    end if;
    if new.is_active and not v_parent.is_active then
      raise exception 'ACCOUNT_PARENT_INACTIVE' using errcode = 'P0001';
    end if;

    -- No cycles: walk up from the parent; we must never reach this account.
    v_ancestor := v_parent.id;
    while v_ancestor is not null loop
      if v_ancestor = new.id then
        raise exception 'ACCOUNT_PARENT_CYCLE' using errcode = 'P0001';
      end if;
      v_depth := v_depth + 1;
      if v_depth > 50 then
        raise exception 'ACCOUNT_PARENT_CYCLE' using errcode = 'P0001';
      end if;
      select parent_id into v_ancestor from public.accounts where id = v_ancestor;
    end loop;
  end if;

  return new;
end;
$$;

create trigger accounts_validate before insert or update on public.accounts
  for each row execute function private.validate_account();

-- Deleting system accounts is already blocked by RLS (accounts_delete policy).
-- Children (parent FK) and mappings (mapping FK) block deletes with 23503.

-- ---------------------------------------------------------------------------
-- account_mappings
-- ---------------------------------------------------------------------------
create or replace function private.validate_account_mapping()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_acc public.accounts;
begin
  select * into v_acc from public.accounts where id = new.account_id;
  if v_acc.id is null or v_acc.company_id <> new.company_id then
    raise exception 'MAPPING_ACCOUNT_NOT_FOUND' using errcode = 'P0001';
  end if;
  if v_acc.is_group then
    raise exception 'MAPPING_ACCOUNT_IS_GROUP' using errcode = 'P0001';
  end if;
  if not v_acc.is_active then
    raise exception 'MAPPING_ACCOUNT_INACTIVE' using errcode = 'P0001';
  end if;
  if v_acc.type <> public.account_role_type(new.role) then
    raise exception 'MAPPING_ACCOUNT_TYPE_MISMATCH' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger account_mappings_validate before insert or update on public.account_mappings
  for each row execute function private.validate_account_mapping();

revoke execute on function private.validate_account_mapping from public, anon, authenticated;
