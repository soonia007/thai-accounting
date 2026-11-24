-- M4 (part 1): new account roles for deferred VAT on services (docs/DECISIONS.md D1, D2).
-- Kept in its own migration: new enum values must be committed before they are used.

alter type public.account_role add value if not exists 'OUTPUT_VAT_DEFERRED';
alter type public.account_role add value if not exists 'INPUT_VAT_DEFERRED';
