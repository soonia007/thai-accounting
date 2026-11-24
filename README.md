# Thai Accounting — ระบบบัญชีออนไลน์

Web + iOS + Android accounting app for Thai SMEs (multi-company, VAT, withholding tax).

- Spec: [docs/PHASE0-1_SPEC.md](docs/PHASE0-1_SPEC.md)
- Status: [PROGRESS.md](PROGRESS.md)

## Getting started

```bash
npm install
cp .env.example .env.local   # fill in Supabase URL + anon key
npm run dev
```

Local database (requires Docker): `npm run db:start`, then `npm run db:reset` / `npm run db:test`.

Mobile: `npm run cap:android` (Android Studio) · `npm run cap:ios` (macOS + Xcode).
