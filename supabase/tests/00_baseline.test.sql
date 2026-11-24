-- pgTAP tests. Run with: npm run db:test  (needs `supabase start` / Docker)
begin;
select plan(2);

select has_schema('private', 'private schema exists');
select has_function('private', 'set_updated_at', 'updated_at trigger helper exists');

select * from finish();
rollback;
