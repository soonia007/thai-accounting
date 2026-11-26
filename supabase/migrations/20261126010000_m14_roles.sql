-- M14 (part 1): account roles for fixed assets. Own migration: enum values must be committed
-- before use.
alter type public.account_role add value if not exists 'DEPRECIATION_EXPENSE';
alter type public.account_role add value if not exists 'ASSET_DISPOSAL_GAIN';
alter type public.account_role add value if not exists 'ASSET_DISPOSAL_LOSS';
