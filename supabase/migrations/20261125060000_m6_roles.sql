-- M6 (part 1): new account role for income tax the payer bears on the payee's behalf
-- (docs/DECISIONS.md D8). Own migration: enum values must be committed before use.

alter type public.account_role add value if not exists 'WHT_BORNE_EXPENSE';
