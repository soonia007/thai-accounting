# PROGRESS

Spec: [docs/PHASE0-1_SPEC.md](docs/PHASE0-1_SPEC.md) — อ่านก่อนเริ่มงานทุกครั้ง

| Milestone                         | สถานะ            |
| --------------------------------- | ---------------- |
| M0 — Project setup                | ✅ เสร็จ          |
| M1 — Auth + Multi-company         | ✅ เสร็จ (รอยืนยัน) |
| M2 — ผังบัญชี                        | ⏳               |
| M3 — ข้อมูลหลัก                      | ⏳               |
| M4 — Posting engine               | ⏳               |
| M5 — ฝั่งขาย                        | ⏳               |
| M6 — ฝั่งซื้อ/ค่าใช้จ่าย                 | ⏳               |
| M7 — สมุดรายวันทั่วไป                 | ⏳               |
| M8 — รายงาน                       | ⏳               |
| M9 — Mobile polish + Release prep | ⏳               |

## M0 — Project setup (2026-11-25)

### ทำแล้ว

- Vite 8 + React 19 + TypeScript 6 + Tailwind CSS 4 + shadcn/ui (button, card, select), alias `@/` → `src/`
- ESLint (typescript-eslint, react-hooks) + Prettier (tailwind plugin), Vitest + Testing Library (jsdom)
- TanStack Query, React Router, React Hook Form + Zod, Supabase JS client (`src/lib/supabase.ts`, อ่านค่าจาก `.env.local`)
- i18next: `th` (default) / `en` — `src/i18n/locales/*.json`, ภาษาที่เลือกจำใน localStorage
- Layout: sidebar (desktop ≥ md) / top bar + bottom nav 5 ปุ่ม (mobile), safe-area iOS (`pt-safe`/`pb-safe`, `viewport-fit=cover`), ตัวสลับภาษา
- Android back button (`src/lib/native.ts`)
- PWA: `vite-plugin-pwa` (manifest + service worker auto-update) + ไอคอนสร้างจาก `public/favicon.svg`
- Capacitor 8: appId `com.thaiaccounting.app`, โฟลเดอร์ `android/` และ `ios/`
- Supabase CLI: `supabase/config.jsonc`, migration แรก `supabase/migrations/20261125000000_baseline.sql` (timezone Asia/Bangkok, schema `private`, trigger `set_updated_at`), pgTAP test ใน `supabase/tests/`

### คำสั่ง

| คำสั่ง                                              | ใช้ทำอะไร                                       |
| ------------------------------------------------- | ---------------------------------------------- |
| `npm run dev`                                     | รันเว็บ http://localhost:5173                    |
| `npm run lint` / `npm run typecheck` / `npm test` | ตรวจคุณภาพ                                      |
| `npm run format`                                  | จัดรูปแบบโค้ด                                     |
| `npm run db:start`                                | เปิด Supabase local (ต้องมี Docker)               |
| `npm run db:reset`                                | รัน migrations ใหม่ทั้งหมด                         |
| `npm run db:test`                                 | รัน pgTAP tests                                 |
| `npm run cap:android`                             | build + รันบน Android (ต้องมี Android Studio/SDK) |
| `npm run cap:ios`                                 | build + เปิด Xcode (ต้องใช้ Mac)                  |

### ค้าง / ข้อควรรู้

- **ยังไม่ได้ทดสอบ** `npx cap run android` — เครื่องนี้ยังไม่มี Android SDK (ติดตั้ง Android Studio แล้วรัน `npm run cap:android`)
- **ยังไม่ได้ทดสอบ** iOS build — ต้องทำบน Mac
- ~~ยังไม่ได้รัน migration / pgTAP~~ → ติดตั้ง Docker Desktop แล้ว (M1) และรันผ่าน
- ใช้ TypeScript 6.0 (ไม่ใช่ 7) เพราะ typescript-eslint ยังรองรับแค่ < 6.1
- `npm audit` แจ้ง moderate 4 รายการใน `workbox-build` (dependency ของ vite-plugin-pwa ตอน build เท่านั้น ไม่เข้า bundle)
- appId `com.thaiaccounting.app` เป็นค่าชั่วคราว เปลี่ยนได้ก่อน M9 (ต้องเปลี่ยนก่อนขึ้น store)

## M1 — Auth + Multi-company (2026-11-25)

### ทำแล้ว

- **DB** (`supabase/migrations/20261125010000_m1_multi_company.sql`)
  - ตาราง: `profiles` (สร้างอัตโนมัติเมื่อสมัคร), `companies`, `company_members`, `company_invitations`, `account_templates`, `accounts`, `account_mappings`
  - RLS ทุกตาราง: เห็นเฉพาะบริษัทที่เป็นสมาชิก; anon อ่านอะไรไม่ได้
  - สิทธิ์: owner/admin = แก้ข้อมูลบริษัท + จัดการสมาชิก; owner/admin/accountant = แก้ผังบัญชี/mapping; staff/viewer = อ่าน
  - RPC: `create_company` (สร้างบริษัท + ตั้งเป็น owner + โหลดผังบัญชีจาก template ใน transaction เดียว), `my_invitations`, `accept_invitation`, `update_member_role`, `remove_member`
  - กฎ: บริษัทต้องมี owner อย่างน้อย 1 คน, เฉพาะ owner แตะ owner ได้, `accounts.parent_id` และ `account_mappings` ต้องอยู่บริษัทเดียวกัน (composite FK)
  - `is_valid_thai_tax_id()` ตรวจ checksum 13 หลัก (ฝั่ง TS: `src/lib/tax-id.ts`)
- **ผังบัญชีสำเร็จรูป** (`supabase/migrations/20261125010100_m1_account_templates.sql`) 4 ประเภท: บริการ / ซื้อมาขายไป / ผลิต / ร้านอาหาร (~50 บัญชี, รหัส 4 หลัก 1xxx–5xxx) + mapping 13 บทบาท (CASH, BANK, AR, AP, OUTPUT_VAT, INPUT_VAT, WHT_RECEIVABLE, WHT_PAYABLE, SALES_REVENUE, SALES_RETURNS, DEFAULT_EXPENSE, INVENTORY, RETAINED_EARNINGS — ธุรกิจบริการไม่มี INVENTORY)
- **หน้าเว็บ**: เข้าสู่ระบบ/สมัคร (email + ปุ่ม Google), onboarding wizard 2 ขั้น, ตัวสลับบริษัท (sidebar / top bar มือถือ), หน้า ตั้งค่า → สมาชิกและสิทธิ์ (เชิญ, เปลี่ยนบทบาท, นำออก, ยกเลิกคำเชิญ), กล่องคำเชิญที่หน้าแรก/onboarding
- Typed client: `src/lib/database.types.ts` (สร้างใหม่ด้วย `npm run db:types`)

### ทดสอบ

- pgTAP 47 tests (`supabase/tests/01_m1_multi_company.test.sql`) — **ยืนยันว่า user B มองไม่เห็น/แก้ไม่ได้ข้อมูลบริษัทของ user A** (companies, accounts, mappings, members, profiles, invitations) + สิทธิ์ตาม role + กฎ owner คนสุดท้าย
- Vitest 15 tests: tax ID checksum, validation ฟอร์มบริษัท, route guards
- ทดสอบมือในเบราว์เซอร์กับ Supabase local: สมัคร → สร้างบริษัท (ตรวจเลขผู้เสียภาษีผิด) → เชิญ → สมัคร user ที่ 2 → ยอมรับคำเชิญ → สลับบริษัท

### วิธีรันเอง

1. เปิด Docker Desktop → `npm run db:start` → คัดลอก API URL + anon key ใส่ `.env.local` (ดู `.env.example`)
2. `npm run dev` → http://localhost:5173 → สมัครด้วยอีเมลอะไรก็ได้ (local ไม่ต้องยืนยันอีเมล)
3. `npm run db:test` รัน pgTAP

### ค้าง / ต้องตัดสินใจ

- **ผังบัญชีสำเร็จรูปเป็น DRAFT** — ให้คุณหรือนักบัญชีตรวจก่อนใช้จริง (แก้ได้ในไฟล์ template migration หรือใน M2)
- **คำถามบัญชีที่ต้องตอบก่อน M4**: ธุรกิจบริการที่จด VAT ต้องใช้ "ภาษีขายยังไม่ถึงกำหนด" (VAT เกิดเมื่อรับเงิน) หรือไม่? spec ยังไม่ระบุ — ตอนนี้ยังไม่ได้ใส่บัญชีนี้
- **Google login**: โค้ดพร้อมแล้ว แต่ต้องสร้าง OAuth Client ใน Google Cloud แล้วใส่ใน `supabase/.env` + เปิด `google.enabled` ใน `supabase/config.jsonc` (และตั้งใน Supabase Dashboard สำหรับ production)
- Google login บนแอปมือถือ (Capacitor) ต้องทำ deep link เพิ่ม → ทำใน M9
- คำเชิญยังไม่ส่งอีเมล — ผู้ถูกเชิญต้องสมัครด้วยอีเมลนั้นแล้วกดยอมรับในแอป (ส่งอีเมลต้องใช้ Edge Function + ผู้ให้บริการอีเมล; ทำทีหลังได้)
- Docker CLI อยู่ที่ `C:Program FilesDockerDocker
esourcesin` — ถ้า terminal หา `docker` ไม่เจอให้เปิด terminal ใหม่หลังติดตั้ง

### ถัดไป: M2 — ผังบัญชี
