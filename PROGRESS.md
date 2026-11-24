# PROGRESS

Spec: [docs/PHASE0-1_SPEC.md](docs/PHASE0-1_SPEC.md) — อ่านก่อนเริ่มงานทุกครั้ง

| Milestone                         | สถานะ            |
| --------------------------------- | ---------------- |
| M0 — Project setup                | ✅ เสร็จ (รอยืนยัน) |
| M1 — Auth + Multi-company         | ⏳ ยังไม่เริ่ม       |
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
- **ยังไม่ได้รัน** migration / pgTAP — เครื่องนี้ยังไม่มี Docker (ติดตั้ง Docker Desktop แล้วรัน `npm run db:start` + `npm run db:test`)
- ใช้ TypeScript 6.0 (ไม่ใช่ 7) เพราะ typescript-eslint ยังรองรับแค่ < 6.1
- `npm audit` แจ้ง moderate 4 รายการใน `workbox-build` (dependency ของ vite-plugin-pwa ตอน build เท่านั้น ไม่เข้า bundle)
- appId `com.thaiaccounting.app` เป็นค่าชั่วคราว เปลี่ยนได้ก่อน M9 (ต้องเปลี่ยนก่อนขึ้น store)

### ถัดไป: M1 — Auth + Multi-company
