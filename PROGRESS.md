# PROGRESS

Spec (อ่านก่อนเริ่มงานทุกครั้ง):

- [docs/PHASE0-1_SPEC.md](docs/PHASE0-1_SPEC.md) — M0–M9
- [docs/PHASE2-3_SPEC.md](docs/PHASE2-3_SPEC.md) — M10–M22 (ภาษี/การเงิน + OCR) — เริ่มหลัง M9 + e2e ผ่าน
- [docs/DESIGN_SIMULATION.md](docs/DESIGN_SIMULATION.md) — แผงจำลองบัญชีระหว่างกรอก (ใช้ตั้งแต่ M4 เป็นต้นไป)

| Milestone                           | สถานะ                |
| ----------------------------------- | -------------------- |
| M0 — Project setup                  | ✅ เสร็จ              |
| M1 — Auth + Multi-company           | ✅ เสร็จ              |
| M2 — ผังบัญชี                          | ✅ เสร็จ              |
| M3 — ข้อมูลหลัก                        | ✅ เสร็จ              |
| M4 — Posting engine                 | ⏳                   |
| M5 — ฝั่งขาย                          | ⏳                   |
| M6 — ฝั่งซื้อ/ค่าใช้จ่าย                   | ⏳                   |
| M7 — สมุดรายวันทั่วไป                   | ⏳                   |
| M8 — รายงาน                         | ⏳                   |
| M9 — Mobile polish + Release prep   | ⏳                   |
| M10 — รายงาน VAT                    | ⏳                   |
| M11 — รายงานภาษีหัก ณ ที่จ่าย            | ⏳                   |
| M12 — กระทบยอดธนาคาร                | ⏳                   |
| M13 — สต็อกสินค้า                      | ⏳                   |
| M14 — สินทรัพย์ถาวร                    | ⏳                   |
| M15 — ปิดงวดบัญชี                      | ⏳                   |
| M16 — Dashboard การเงินฉบับเต็ม        | ⏳                   |
| M17 — OCR JSON contract + ingestion | ⏳ ต้องได้ข้อมูล OCR ก่อน |
| M18 — ช่องทางนำเข้าไฟล์                | ⏳                   |
| M19 — Validation + เอกสารร่าง        | ⏳                   |
| M20 — คิวตรวจทาน                     | ⏳                   |
| M21 — เรียนรู้จากการแก้ไข               | ⏳                   |
| M22 — Auto-post + รายงานความแม่นยำ   | ⏳                   |

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

## M2 — ผังบัญชี (2026-11-25)

### ทำแล้ว

- **หน้า บัญชี → ผังบัญชี** (`/accounting/accounts`): แสดงแบบ tree, ขยาย/ย่อ, ค้นหาด้วยรหัส/ชื่อไทย/ชื่ออังกฤษ (แสดงบัญชีแม่ของผลลัพธ์ด้วย), ซ่อน/แสดงบัญชีที่ปิดใช้งาน, ป้ายบทบาทที่ผูกไว้, ไอคอนกุญแจ = บัญชีระบบ
  - เพิ่ม / เพิ่มบัญชีย่อย / แก้ไข / ปิด-เปิดใช้งาน / ลบ (เฉพาะบัญชีที่ไม่ใช่ระบบ)
  - แก้ไขได้เฉพาะ owner / admin / accountant (staff, viewer ดูอย่างเดียว)
- **หน้า บัญชี → การผูกบัญชี** (`/accounting/mappings`): เลือกบัญชีให้ 13 บทบาท เลือกได้เฉพาะบัญชีที่ใช้งานอยู่ ไม่ใช่บัญชีคุม และประเภทตรงกัน
- **กฎใน DB** (`supabase/migrations/20261125020000_m2_chart_of_accounts.sql`) — ทุก client ได้กฎเดียวกัน:
  - บัญชีแม่ต้องเป็นบัญชีคุม ประเภทเดียวกัน ใช้งานอยู่ และห้ามวนกลับ (cycle)
  - บัญชีระบบ: ลบไม่ได้, เปลี่ยนประเภท/สถานะบัญชีคุมไม่ได้ (แก้ชื่อ รหัส บัญชีแม่ได้); ผู้ใช้สร้างบัญชีระบบเองไม่ได้
  - บัญชีที่ถูกผูก (mapping) ปิดใช้งาน/เปลี่ยนประเภท/เปลี่ยนเป็นบัญชีคุมไม่ได้ → ต้องเปลี่ยน mapping ก่อน
  - ปิดใช้งานบัญชีคุมได้เมื่อบัญชีย่อยถูกปิดหมดแล้ว; บัญชีคุมที่มีบัญชีย่อยเปลี่ยนเป็นบัญชีธรรมดาไม่ได้
  - mapping: บัญชีต้องอยู่บริษัทเดียวกัน ใช้งานอยู่ ไม่ใช่บัญชีคุม และประเภทตรงกับบทบาท (`account_role_type()`)
  - ข้อความ error จาก DB แปลเป็นไทย/อังกฤษใน UI (`src/features/accounts/errors.ts`)

### ทดสอบ

- pgTAP รวม 76 tests (M2 เพิ่ม 29 ใน `supabase/tests/02_m2_chart_of_accounts.test.sql`)
- Vitest รวม 23 tests (M2 เพิ่ม tree/search ใน `src/features/accounts/tree.test.ts`)
- ทดสอบในเบราว์เซอร์: ดู tree, ค้นหา "ธนาคาร", ปิดใช้งานบัญชีที่ถูกผูก (ขึ้น error ภาษาไทยถูกต้อง), เพิ่มบัญชีย่อยรหัสซ้ำ (ขึ้น "รหัสนี้มีอยู่แล้ว") แล้วเพิ่มสำเร็จ, หน้า mapping แสดงครบ 13 บทบาท
- ยังไม่ได้กดเปลี่ยน mapping ผ่าน UI จริง (ทดสอบใน pgTAP แล้ว)

### ค้าง / ข้อควรรู้

- กฎ "บัญชีที่มีรายการบัญชีแล้วห้ามเปลี่ยนเป็นบัญชีคุม/ห้ามลบ" จะเพิ่มใน M4 เมื่อมี journal_lines
- คำถามบัญชีจาก M1 (ภาษีขายยังไม่ถึงกำหนดสำหรับธุรกิจบริการ) ยังรอคำตอบก่อน M4

## M3 — ข้อมูลหลัก (2026-11-25)

### ทำแล้ว

- **DB** (`supabase/migrations/20261125030000_m3_master_data.sql`)
  - `contacts`: ลูกค้า/ผู้ขาย/ทั้งคู่, นิติบุคคล/บุคคลธรรมดา (เตรียมไว้แยก ภ.ง.ด.3/53 ใน M11), เลขผู้เสียภาษี (checksum), สาขา, ที่อยู่, ผู้ติดต่อ, เครดิตเทอม
    - เลขผู้เสียภาษี + สาขา ซ้ำในบริษัทเดียวกันไม่ได้ (ใช้จับคู่ผู้ขายใน OCR M19)
  - `products`: สินค้า/บริการ, หน่วย, ราคาขาย/ซื้อ (**ก่อน VAT**), ประเภท VAT (ปกติ/0%/ยกเว้น), บัญชีรายได้/ค่าใช้จ่าย default (ว่าง = ใช้ mapping)
  - `bank_accounts`: ธนาคาร, เลขบัญชี, ชื่อบัญชี, สาขา, ประเภท — ผูกกับบัญชีในผังบัญชี 1:1; RPC `create_bank_account_with_ledger` สร้างบัญชีในผังบัญชีให้พร้อมกัน
  - รหัสอัตโนมัติเมื่อเว้นว่าง: C0001…, P0001…
  - สิทธิ์: ผู้ติดต่อ/สินค้า — owner/admin/accountant/staff เพิ่ม-แก้ได้, ลบได้เฉพาะ owner/admin/accountant; บัญชีธนาคาร — owner/admin/accountant
- **หน้าเว็บ**: ผู้ติดต่อ (`/contacts`), สินค้า/บริการ (`/products`), บัญชี → บัญชีธนาคาร (`/accounting/bank-accounts`)
  - ค้นหา, กรองประเภท, แสดง/ซ่อนที่ปิดใช้งาน, เพิ่ม/แก้/ลบ
  - **Import/Export CSV** (ผู้ติดต่อ + สินค้า): ไฟล์ UTF-8 มี BOM (เปิดใน Excel ภาษาไทยไม่เพี้ยน), ปุ่มดาวน์โหลดไฟล์ตัวอย่าง, ตรวจทุกแถวก่อนนำเข้า + บอกแถว/คอลัมน์ที่ผิด, แถวที่มีรหัสเดิม = อัปเดต, แถวไม่มีรหัส = เพิ่มใหม่, รับค่าภาษาไทยได้ (เช่น "ลูกค้า", "ผู้ขาย", "บริการ")
  - มือถือ: แถบล่าง = หน้าแรก/ขาย/ซื้อ/ผู้ติดต่อ/เมนู (`/menu` รวมทุกหน้า)

### ทดสอบ

- pgTAP รวม 106 tests (M3 เพิ่ม 30 ใน `supabase/tests/03_m3_master_data.test.sql`)
- Vitest รวม 43 tests (CSV, import validation, ธนาคาร)
- ทดสอบในเบราว์เซอร์: นำเข้า CSV 3 แถว (ผ่าน 2, จับเลขผู้เสียภาษีผิด 1), แก้ที่อยู่ผู้ติดต่อ, เพิ่มบริการราคา 1,500, เพิ่มบัญชีธนาคาร 2 บัญชี (ผูก 1120 เดิม + สร้าง 1121 ใหม่), เมนูมือถือ

### ข้อควรรู้

- ผู้ติดต่อต่างประเทศ (ไม่มีเลขผู้เสียภาษีไทย 13 หลัก) — ตอนนี้ต้องเว้นช่องเลขผู้เสียภาษีว่าง; ถ้าต้องการช่องสำหรับ Tax ID ต่างประเทศให้บอก
- ลบผู้ติดต่อ/สินค้าที่ใช้ในเอกสารแล้วจะทำไม่ได้ (FK) เมื่อมีเอกสารใน M5/M6 → ให้ปิดใช้งานแทน
- รายการแสดงสูงสุด 1,000 แถว (ค่า default ของ Supabase) — พอสำหรับ SME; ถ้าเกินจะเพิ่ม pagination

### ถัดไป: M4 — Posting engine (ต้องได้คำตอบเรื่อง logic บัญชีก่อน)

## การเปลี่ยนแปลงขอบเขต (2026-11-25)

- เพิ่ม Phase 2+3 (M10–M22) ตาม `docs/PHASE2-3_SPEC.md`
- **ข้อกำหนดดีไซน์ใหม่: จำลองการลงบัญชีระหว่างกรอก** (`docs/DESIGN_SIMULATION.md`)
  - กระทบ M4: แยก `private.build_journal()` (pure) ให้ `post_document()` และ `simulate_posting()` ใช้ร่วมกัน + test ว่าผลจำลอง = ผล post จริง
  - กระทบ M5/M6/M7 และ M12–M15, M20, M22: ทุกฟอร์มที่ลงบัญชีต้องมี `<PostingPreview>`
- **ข้อมูลที่ต้องได้ก่อน M17 (OCR):** OCR รันที่ไหน, เรียกใช้อย่างไร, ตัวอย่าง JSON จริง 3–5 ไฟล์ใน `samples/ocr/`, มี confidence ต่อ field หรือไม่
- M11: ไฟล์ข้อความสำหรับยื่นออนไลน์ — ต้องถามรูปแบบก่อนทำ
