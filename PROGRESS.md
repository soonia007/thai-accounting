# PROGRESS

Spec (อ่านก่อนเริ่มงานทุกครั้ง):

- [docs/PHASE0-1_SPEC.md](docs/PHASE0-1_SPEC.md) — M0–M9
- [docs/PHASE2-3_SPEC.md](docs/PHASE2-3_SPEC.md) — M10–M22 (ภาษี/การเงิน + OCR) — เริ่มหลัง M9 + e2e ผ่าน
- [docs/DESIGN_SIMULATION.md](docs/DESIGN_SIMULATION.md) — แผงจำลองบัญชีระหว่างกรอก (ใช้ตั้งแต่ M4 เป็นต้นไป)
- [docs/DECISIONS.md](docs/DECISIONS.md) — การตัดสินใจเรื่อง logic บัญชีจากเจ้าของ (D1–D5) — engine ทำตามนี้

| Milestone                           | สถานะ                |
| ----------------------------------- | -------------------- |
| M0 — Project setup                  | ✅ เสร็จ              |
| M1 — Auth + Multi-company           | ✅ เสร็จ              |
| M2 — ผังบัญชี                          | ✅ เสร็จ              |
| M3 — ข้อมูลหลัก                        | ✅ เสร็จ              |
| M4 — Posting engine                 | ✅ เสร็จ              |
| M5 — ฝั่งขาย                          | ✅ เสร็จ              |
| M6 — ฝั่งซื้อ/ค่าใช้จ่าย                   | ✅ เสร็จ              |
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

## M4 — Posting engine (2026-11-25)

### การตัดสินใจจากเจ้าของ (docs/DECISIONS.md)

- D1/D2: VAT ค่าบริการขาย/ซื้อแบบเชื่อ → ลง "ภาษีขาย/ซื้อยังไม่ถึงกำหนด" ก่อน แล้วโอนตอนรับ/จ่ายเงินตามสัดส่วน
- D3: void → กลับรายการลงวันที่เดียวกับเอกสารต้นฉบับ
- D4: ใบลดหนี้ → Dr รับคืนและส่วนลด (4110)
- D5: VAT ของใบลด/เพิ่มหนี้ค่าบริการ ตามสถานะใบแจ้งหนี้ (ยังไม่จ่าย → ยังไม่ถึงกำหนด, จ่ายครบ → ภาษีขาย, จ่ายบางส่วน → ห้าม)

### ทำแล้ว

- **บัญชีใหม่** (เพิ่มแบบ additive): 1141 ภาษีซื้อยังไม่ถึงกำหนด, 2121 ภาษีขายยังไม่ถึงกำหนด + บทบาท `INPUT_VAT_DEFERRED` / `OUTPUT_VAT_DEFERRED` (เติมให้บริษัทเดิมอัตโนมัติ)
- **ตาราง**: `documents`, `document_lines`, `payments`, `payment_allocations` (ชำระหลายใบ/บางส่วน), `journal_entries`, `journal_lines`, `doc_sequences`, `audit_logs`
- **กฎใน DB**:
  - เดบิต = เครดิต ตรวจตอน commit (constraint trigger) + ห้ามลงบัญชีคุม/บัญชีปิดใช้งาน
  - journal แก้/ลบไม่ได้ (append-only); เอกสาร/การชำระที่ post แล้วแก้/ลบไม่ได้
  - คอลัมน์ยอดเงินคำนวณโดย engine เท่านั้น (client เขียนไม่ได้)
  - audit log ทุก insert/update/delete + แยก action `post` / `void`
  - บัญชีที่มีรายการแล้ว เปลี่ยนประเภท/เป็นบัญชีคุมไม่ได้
- **Engine** (`supabase/migrations/20261125040300_m4_posting_engine.sql`):
  - `calc_line` (ปัด half-up ต่อบรรทัด, แยก/รวม/ไม่มี VAT, หัก ณ ที่จ่ายจากฐานก่อน VAT)
  - `private.build_journal` / `build_payment_journal` = กฎลงบัญชีที่เดียว
  - `simulate_posting` (ใช้กับแผงจำลอง — ไม่เขียนอะไรเลย, คืนยอดยกมาของแต่ละบัญชี, error เป็นข้อมูล)
  - `save_document` / `post_document` / `void_document`, `save_payment` / `post_payment` / `void_payment`, `document_balance`
  - เลขเอกสาร: `INV-2026-0001` (ตั้งค่า prefix / รีเซ็ตรายปี-รายเดือน / จำนวนหลัก / พ.ศ.-ค.ศ. ได้ใน `companies.doc_number_settings`) — ไม่ซ้ำไม่ข้าม (row lock)
- **TS mirror** `src/lib/money/calc.ts` (BigInt, ไม่มี float) สำหรับยอดรวมในฟอร์ม — test ใช้ตัวเลขชุดเดียวกับ SQL

### ทดสอบ

- pgTAP รวม 169 tests — `supabase/tests/04_m4_posting_engine.test.sql` 63 tests ครบทุกแถวของ posting rules:
  ใบแจ้งหนี้ (บริการ/สินค้า/ผสม/รวม VAT/ไม่มี VAT), รับชำระ (เต็ม+หัก ณ ที่จ่าย, บางส่วน 2 งวด), ขายสด, ใบลดหนี้ (ยังไม่จ่าย/จ่ายครบ/จ่ายบางส่วน=ห้าม/เกินยอด), ใบเพิ่มหนี้, บิลเชื่อ (บริการ/สินค้า), จ่ายชำระ+หัก ณ ที่จ่าย, ซื้อสด, ใบเสนอราคา (ไม่ลงบัญชี), บริษัทไม่จด VAT, เลขเอกสารต่อเนื่อง, **simulate = post**, void (วันที่เดิม, มีการชำระแล้วห้าม, สิทธิ์), ห้ามแก้เอกสาร/journal, ไม่สมดุล = reject, AR ในบัญชี = ยอดค้างของเอกสาร, audit log
- Vitest รวม 57 tests (calc.ts 14 tests ตัวเลขตรงกับ DB)
- M4 ไม่มีหน้าจอใหม่ (หน้าจอมาใน M5) — หน้า "การผูกบัญชี" มี 15 บทบาทแล้ว

### ข้อควรรู้

- ใบลดหนี้ของ "ขายเงินสด" ยังไม่รองรับ (ต้องอ้างอิงใบแจ้งหนี้)
- ล็อกงวด (M15) ยังไม่มี — void จะถูกบล็อกในงวดที่ล็อกเมื่อทำ M15
- ภาษีซื้อขอคืนไม่ได้ / ยื่นเลื่อนเดือน → Phase 2 (M10)

## M5 — ฝั่งขาย (2026-11-25)

### การตัดสินใจ (docs/DECISIONS.md)

- P1: ส่งอีเมล = เปิดเมนูแชร์/แอปอีเมลของผู้ใช้ (ยังไม่ส่งจาก server)
- P2: ลิงก์แชร์ = ใครมีลิงก์ก็เปิดได้ (token สุ่ม, อ่านอย่างเดียว, ยกเลิก/ตั้งวันหมดอายุได้)

### ทำแล้ว

- **DB** (`supabase/migrations/20261125050000_m5_sales.sql`)
  - `simulate_posting` คืน "ขั้นต่อไป" (preview การรับชำระเต็มจำนวน) ด้วย — ใช้กฎเดียวกับ `build_payment_journal`
  - `list_documents` / `open_documents` / `list_payments` — ยอดค้าง + สถานะ ค้างชำระ / เกินกำหนด / ชำระแล้ว
  - `document_shares` + `create_share_link` / `revoke_share_link` / `get_shared_document` (anon อ่านผ่าน token เท่านั้น)
  - `print_document` — ข้อมูลสำหรับ PDF (ผู้ขาย-ผู้ซื้อ เลขผู้เสียภาษี สาขา รายการ VAT แยก)
- **หน้าเว็บ**
  - ขาย (`/sales`): แท็บ ใบเสนอราคา / ใบแจ้งหนี้ / ขายสด / ใบลดหนี้ / ใบเพิ่มหนี้ / ใบเสร็จ, ค้นหา, ป้ายสถานะ
  - ฟอร์มเอกสาร (`/sales/new/:type`, `/sales/:id`): เลือกลูกค้า → เพิ่มรายการ (เลือกสินค้าหรือพิมพ์เอง, บริการ/สินค้า, ประเภท VAT, ส่วนลด, หัก ณ ที่จ่าย) → ยอดรวม real-time, บันทึกร่าง / Post / void
  - **แผงจำลองบัญชี** (`src/features/posting/PostingPreview.tsx`): ภาษาง่าย + Journal / T-accounts + "ขั้นต่อไปเมื่อรับชำระ"; มือถือเป็น bottom sheet; หลัง post แสดง journal ที่ลงจริง
  - ปุ่มแปลงเอกสาร: ใบเสนอราคา → ใบแจ้งหนี้/ขายสด, ใบแจ้งหนี้ → ใบลดหนี้/ใบเพิ่มหนี้, ใบแจ้งหนี้ → รับชำระ
  - รับชำระ (`/sales/payments/new`): หลายใบ/บางส่วน, หัก ณ ที่จ่าย, ออกใบเสร็จ (RV-…)
  - PDF ภาษาไทย (`@react-pdf/renderer` + ฟอนต์ Sarabun): ต้นฉบับ/สำเนา, จำนวนเงินตัวอักษร, ป้าย VOID; ปุ่ม PDF / ลิงก์แชร์ / อีเมล; หน้าสาธารณะ `/share/:token`
  - ตั้งค่า → ข้อมูลบริษัท (`/settings/company`) — ข้อมูลที่พิมพ์บนเอกสาร

### ทดสอบ

- pgTAP รวม 187 tests (M5 เพิ่ม 18 ใน `supabase/tests/05_m5_sales.test.sql`)
- Vitest รวม 95 tests (payload, payment math, simulation, print data, format)
- ทดสอบในเบราว์เซอร์: ใบแจ้งหนี้ค่าบริการ 1,000 + VAT 7% → แผงจำลอง Dr ลูกหนี้ 1,070 / Cr รายได้ 1,000 / Cr ภาษีขายยังไม่ถึงกำหนด 70 (ตาม D1) → Post (INV-2026-0001) → รับชำระ (RV-2026-0001) โอน VAT ถูกต้อง → สถานะ "ชำระแล้ว" → ดาวน์โหลด PDF (ภาษาไทยถูกต้อง) → สร้างลิงก์แชร์แล้วเปิดแบบไม่ login ได้

### ข้อควรรู้

- ยืนยันก่อน post ใช้ `window.confirm` ของเบราว์เซอร์ (ปรับเป็น dialog สวยๆ ได้ใน M9)
- อีเมลยังไม่ส่งจาก server (P1)
- ยังไม่ได้ทดสอบบนมือถือจริง (ทำใน M9)

## M6 — ฝั่งซื้อ/ค่าใช้จ่าย (2026-11-25)

### การตัดสินใจจากเจ้าของ (docs/DECISIONS.md)

- D6: ประเภทเงินได้ หัก ณ ที่จ่าย **เลือกต่อบรรทัด** (ค่าเริ่มต้นจากสินค้า/บริการ)
- D7: 50 ทวิ — บุคคลธรรมดา = ภ.ง.ด.3, นิติบุคคล = ภ.ง.ด.53; 1 ใบต่อการจ่าย 1 ครั้ง; ลงวันที่จ่าย; เลขที่ต่อเนื่องรายปี
- D8: รองรับ **ออกภาษีให้** ทั้ง "ตลอดไป" (gross-up: ฐาน × อัตรา ÷ (100 − อัตรา)) และ "ครั้งเดียว" (ฐาน × อัตรา) — ลงบัญชีใหม่ 5285 ภาษีเงินได้ออกแทนผู้รับ (บทบาท `WHT_BORNE_EXPENSE`)

### ทำแล้ว

- **DB** (`supabase/migrations/20261125060000_m6_roles.sql`, `20261125060100_m6_purchases.sql`)
  - `wht_income_types` (ข้อมูลอ้างอิง 13 ประเภท: มาตรา, แถวในแบบ 50 ทวิ, อัตราแนะนำ), `products.wht_income_type`, `document_lines.wht_income_type`
  - `documents.wht_condition` (ซื้อสด) / `payments.wht_condition` (จ่ายชำระบิล): withhold / pay_always / pay_once
  - engine: บรรทัดซื้อที่หัก ณ ที่จ่ายต้องมีประเภทเงินได้ (`WHT_INCOME_TYPE_REQUIRED` — แสดงในแผงจำลองด้วย); ออกภาษีให้ → ผู้ขายได้เต็มจำนวน + Dr 5285 / Cr ภาษีหัก ณ ที่จ่ายค้างจ่าย; ขายใช้ออกภาษีให้ไม่ได้
  - `wht_certificates` + `wht_certificate_lines`: สร้างอัตโนมัติ (trigger) ตอน post การจ่ายชำระ / ซื้อสดที่มีภาษี — แยกยอดตามประเภทเงินได้ตามสัดส่วนที่จ่าย; void → หนังสือรับรองถูกยกเลิก (เลขไม่ถูกใช้ซ้ำ); เลข `WHT-2026-0001`
  - `print_wht_certificate` (ข้อมูล PDF), ไฟล์แนบ: ตาราง `attachments` + Storage bucket `attachments` (ส่วนตัว, ≤ 20 MB, โฟลเดอร์ = company id, RLS)
- **หน้าเว็บ**
  - ซื้อ/ค่าใช้จ่าย (`/purchases`): ใบสั่งซื้อ (→ แปลงเป็นบิล/ซื้อสด), บันทึกค่าใช้จ่ายเชื่อ, ซื้อสด, จ่ายชำระ — ใช้ฟอร์ม + แผงจำลองชุดเดียวกับฝั่งขาย
  - บรรทัดเอกสารซื้อ: เลือกประเภทเงินได้ → ใส่อัตราแนะนำให้ (แก้ได้); สินค้า/บริการตั้งประเภทเงินได้เริ่มต้นได้
  - เลือก "ผู้จ่ายเงิน" (1) หัก ณ ที่จ่าย (2) ออกให้ตลอดไป (3) ออกให้ครั้งเดียว — ในหน้าจ่ายชำระ และซื้อสด; ยอดภาษีแนะนำคำนวณแบบเดียวกับหนังสือรับรอง (`settlementWht` mirror ของ SQL)
  - **50 ทวิ PDF** (ฉบับที่ 1 + ฉบับที่ 2): ปุ่มในใบสำคัญจ่าย/ซื้อสด + หน้ารวม `/purchases/wht-certificates`
  - **ไฟล์แนบ**: ปุ่มแนบไฟล์ / ถ่ายรูป (มือถือเว็บ = กล้องของเบราว์เซอร์, แอป = Capacitor Camera) ทุกเอกสารและการชำระ; เปิดดูผ่าน signed URL
  - iOS: เพิ่มข้อความขอสิทธิ์กล้อง/คลังภาพใน Info.plist; `npx cap sync` แล้ว

### ทดสอบ

- pgTAP รวม 221 tests (M6 เพิ่ม 34 ใน `supabase/tests/06_m6_purchases.test.sql`): บิล+จ่าย หัก ณ ที่จ่าย (ภ.ง.ด.3), ออกให้ตลอดไป (309.28, ภ.ง.ด.53, เงินได้ 10,309.28), ออกให้ครั้งเดียว, ซื้อสดออกให้, จ่ายครึ่งหนึ่ง 2 ประเภทเงินได้, ไม่มีภาษี = ไม่มีใบ, void, สิทธิ์, ไฟล์แนบ + Storage RLS
  - แก้ test เดิม 2 จุดตามกฎใหม่: บรรทัดซื้อสดใน M4 test ใส่ประเภทเงินได้ (D6), จำนวน mapping 14 → 15
- Vitest รวม 101 tests (settlementWht ตัวเลขชุดเดียวกับ SQL, path ไฟล์แนบ)
- ทดสอบในเบราว์เซอร์: บิลค่าออกแบบ 10,000 (ประเภทเงินได้มาจากสินค้า) → แนบไฟล์ → จ่ายชำระแบบออกให้ตลอดไป (แผงจำลองตรง D8) → ดาวน์โหลด 50 ทวิ (ตรวจภาพ PDF แล้ว) → ซื้อสดค่าเช่า 5,000 ออกให้ครั้งเดียว (ภาษี 250) → หน้ารวมหนังสือรับรองแสดง 2 ใบ

### ข้อควรรู้

- ยังไม่ได้ทดสอบกล้องในแอปมือถือจริง (Capacitor Camera) — ทดสอบใน M9
- อัตราแนะนำของประเภทเงินได้เป็นค่าทั่วไป ผู้ใช้แก้ได้ต่อบรรทัด — **ควรให้นักบัญชีตรวจรายการประเภทเงินได้/อัตรา** (ตาราง `wht_income_types`)
- ภ.ง.ด.1ก/2 (เงินเดือน, ดอกเบี้ย/ปันผลจ่ายบุคคล) ยังไม่รองรับในการออก 50 ทวิ
- CSV นำเข้า/ส่งออกสินค้ายังไม่มีคอลัมน์ประเภทเงินได้
- หนังสือรับรองยังไม่มีช่องลายเซ็น/ตราประทับแบบรูปภาพ

### ถัดไป: M7 — สมุดรายวันทั่วไป

## Redesign + แบรนด์ FINORA (2026-11-25)

- ชื่อแบรนด์ **FINORA** (แอป, แท็บเบราว์เซอร์, PWA, Capacitor, Android/iOS display name) + โลโก้ใหม่ (`BrandMark`, `public/favicon.svg`, ไอคอน PWA)
- ธีมใหม่ตามสีที่เจ้าของกำหนด — รายละเอียด/กฎการใช้สีอยู่ใน [docs/DESIGN_SYSTEM.md](docs/DESIGN_SYSTEM.md)
- ฟอนต์ Inter + Noto Sans Thai, ปุ่มแคปซูล, การ์ดมน, segmented control, ป้ายสถานะตามโทนสี
- ทุกหน้าใช้ความกว้างเต็มจอ, แผงจำลองบัญชีมีโหมด **เต็มจอ** (desktop + มือถือ), dialog เต็มจอบนมือถือ
- หน้าแรก: ปุ่มลัด (ใบแจ้งหนี้, รับชำระ, ค่าใช้จ่าย, ผู้ติดต่อ) จนกว่าจะทำ dashboard ใน M8
- แก้บั๊กเดิม: `.pt-safe` ทับ padding ด้านบน (หัวหน้าจอชิดขอบ)
- ค้าง: ไอคอนแอป native (Android mipmap / iOS AppIcon) ยังเป็นของเดิม → ทำใน M9; ยังไม่มี dark mode

## การเปลี่ยนแปลงขอบเขต (2026-11-25)

- เพิ่ม Phase 2+3 (M10–M22) ตาม `docs/PHASE2-3_SPEC.md`
- **ข้อกำหนดดีไซน์ใหม่: จำลองการลงบัญชีระหว่างกรอก** (`docs/DESIGN_SIMULATION.md`)
  - กระทบ M4: แยก `private.build_journal()` (pure) ให้ `post_document()` และ `simulate_posting()` ใช้ร่วมกัน + test ว่าผลจำลอง = ผล post จริง
  - กระทบ M5/M6/M7 และ M12–M15, M20, M22: ทุกฟอร์มที่ลงบัญชีต้องมี `<PostingPreview>`
- **ข้อมูลที่ต้องได้ก่อน M17 (OCR):** OCR รันที่ไหน, เรียกใช้อย่างไร, ตัวอย่าง JSON จริง 3–5 ไฟล์ใน `samples/ocr/`, มี confidence ต่อ field หรือไม่
- M11: ไฟล์ข้อความสำหรับยื่นออนไลน์ — ต้องถามรูปแบบก่อนทำ
