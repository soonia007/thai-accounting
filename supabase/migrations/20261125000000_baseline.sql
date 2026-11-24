-- M0 baseline: shared helpers used by every later migration.
-- Business tables arrive in M1+ (companies, company_members, RLS, ...).

-- Display/business timezone for the whole system (spec §2).
alter database postgres set timezone to 'Asia/Bangkok';

-- Internal helpers live in a schema that is NOT exposed through the API.
create schema if not exists private;

-- Generic trigger: keep updated_at current on every UPDATE.
create or replace function private.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
