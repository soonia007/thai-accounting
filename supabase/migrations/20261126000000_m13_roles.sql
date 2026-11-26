-- M13 (part 1): account roles for perpetual inventory. Own migration: enum values must be
-- committed before use.
alter type public.account_role add value if not exists 'COGS';
alter type public.account_role add value if not exists 'INVENTORY_ADJUSTMENT';
