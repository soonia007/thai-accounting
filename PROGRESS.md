# PROGRESS

Spec (อ่านก่อนเริ่มงานทุกครั้ง):

- [docs/PHASE0-1_SPEC.md](docs/PHASE0-1_SPEC.md) — M0–M9
- [docs/PHASE2-3_SPEC.md](docs/PHASE2-3_SPEC.md) — M10–M22 (ภาษี/การเงิน + OCR) — เริ่มหลัง M9 + e2e ผ่าน
- [docs/DESIGN_SIMULATION.md](docs/DESIGN_SIMULATION.md) — แผงจำลองบัญชีระหว่างกรอก (ใช้ตั้งแต่ M4 เป็นต้นไป)
- [docs/DECISIONS.md](docs/DECISIONS.md) — การตัดสินใจเรื่อง logic บัญชีจากเจ้าของ (D1–D5) — engine ทำตามนี้

| Milestone                           | สถานะ                                                          |
| ----------------------------------- | -------------------------------------------------------------- |
| M0 — Project setup                  | ✅ เสร็จ                                                        |
| M1 — Auth + Multi-company           | ✅ เสร็จ                                                        |
| M2 — ผังบัญชี                          | ✅ เสร็จ                                                        |
| M3 — ข้อมูลหลัก                        | ✅ เสร็จ                                                        |
| M4 — Posting engine                 | ✅ เสร็จ                                                        |
| M5 — ฝั่งขาย                          | ✅ เสร็จ                                                        |
| M6 — ฝั่งซื้อ/ค่าใช้จ่าย                   | ✅ เสร็จ                                                        |
| M7 — สมุดรายวันทั่วไป                   | ✅ เสร็จ                                                        |
| M8 — รายงาน                         | ✅ เสร็จ                                                        |
| M9 — Mobile polish + Release prep   | ✅ เสร็จ (build ไบนารีจริงต้องทำบนเครื่องเจ้าของ — ดู docs/RELEASE.md) |
| M10 — รายงาน VAT                    | ⏳                                                             |
| M11 — รายงานภาษีหัก ณ ที่จ่าย            | ⏳                                                             |
| M12 — กระทบยอดธนาคาร                | ⏳                                                             |
| M13 — สต็อกสินค้า                      | ⏳                                                             |
| M14 — สินทรัพย์ถาวร                    | ⏳                                                             |
| M15 — ปิดงวดบัญชี                      | ⏳                                                             |
| M16 — Dashboard การเงินฉบับเต็ม        | ⏳                                                             |
| M17 — OCR JSON contract + ingestion | ⏳ ต้องได้ข้อมูล OCR ก่อน                                           |
| M18 — ช่องทางนำเข้าไฟล์                | ⏳                                                             |
| M19 — Validation + เอกสารร่าง        | ⏳                                                             |
| M20 — คิวตรวจทาน                     | ⏳                                                             |
| M21 — เรียนรู้จากการแก้ไข               | ⏳                                                             |
| M22 — Auto-post + รายงานความแม่นยำ   | ⏳                                                             |

## M0 — Project setup (2026-11-25)

### ทำแล้ว

- Vite 8 + React 19 + TypeScript 6 + Tailwind CSS 4 + shadcn/ui (button, card, select), alias `@/` → `src/`
- ESLint (typescript-eslint, react-hooks) + Prettier (tailwind plugin), Vitest + Testing Library (jsdom)
- TanStack Query, React Router, React Hook Form + Zod, Supabase JS client (`src/lib/supabase.ts`, อ่านค่าจาก `.env.local`)
- i18next: `th` (default) / `en` — `src/i18n/locales/*.json`, ภาษาที่เลือกจำใน localStorage
- Layout: sidebar (desktop ≥ md) / top bar + bottom nav 5 ปุ่ม (mobile), safe-area iOS (`pt-safe`/`pb-safe`, `viewport-fit=cover`), ตัวสลับภาษา
- Android back button (`src/lib/native.ts`)
- PWA: `vite-plugin-pwa` (manifest + service worker auto-update) + ไอคอนสร้างจาก `public/favicon.svg`
- Capacitor 8: appId `com.finora.app` (เดิม com.thaiaccounting.app), โฟลเดอร์ `android/` และ `ios/`
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
- (เดิม) appId `com.thaiaccounting.app` เป็นค่าชั่วคราว — เปลี่ยนเป็น `com.finora.app` แล้วใน M9 เปลี่ยนได้ก่อน M9 (ต้องเปลี่ยนก่อนขึ้น store)

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

## M7 — สมุดรายวันทั่วไป (2026-11-25)

### การตัดสินใจจากเจ้าของ

- D9: บัญชีลูกหนี้/เจ้าหนี้การค้า (บทบาท AR/AP) **ห้ามลงด้วยมือ** — ลงผ่านเอกสารเท่านั้น

### ทำแล้ว

- **DB** (`supabase/migrations/20261125090000_m7_general_journal.sql`)
  - `manual_journals` + `manual_journal_lines` (ร่าง → บันทึก → ยกเลิก), `journal_entries.manual_journal_id`
  - `private.build_manual_journal`: ตรวจทุกบรรทัด (บัญชีต้องมี, ฝั่งเดียว, ไม่ติดลบ, ทศนิยม 2, ไม่ใช่บัญชีคุม/ปิดใช้งาน, ไม่ใช่ AR/AP ตาม D9), ≥ 2 บรรทัด, เดบิต = เครดิต
  - `simulate_manual_journal` (แสดงผลระหว่างพิมพ์แม้ยังไม่สมดุล), `save_manual_journal`, `post_manual_journal` (เลข `JV-2026-0001` ไม่ซ้ำไม่ข้าม), `void_manual_journal` (รายการกลับวันที่เดิม — D3)
  - สิทธิ์: owner/admin/accountant สร้าง/บันทึก/ยกเลิก; สมาชิกทุกคนดูได้; audit log ทุกการเปลี่ยนแปลง
- **หน้าเว็บ** — บัญชี → สมุดรายวันทั่วไป (`/accounting/journal`)
  - รายการ + ค้นหา, ฟอร์มบันทึก: เลือกบัญชีแยกตามหมวด (บัญชี AR/AP กดไม่ได้ พร้อมเหตุผล), เดบิต/เครดิต (ใส่ฝั่งหนึ่งแล้วอีกฝั่งล้างให้), เพิ่ม/ลบบรรทัด
  - แถบสมดุลแบบเรียลไทม์ (ตัวเลขวิ่ง, เขียว = สมดุล, เหลือง = ต่าง) + ปุ่ม **เติมส่วนต่าง**; ปุ่มบันทึกกดได้เมื่อสมดุลเท่านั้น
  - รูปแบบเริ่มต้น: ค่าเสื่อมราคา, ค่าใช้จ่ายค้างจ่าย, ตัดค่าใช้จ่ายจ่ายล่วงหน้า, นำเงินสดฝากธนาคาร
  - แผงจำลองบัญชี: เน้นบรรทัดที่กำลังแก้ + บอกบัญชีที่ได้รับผล, ขยายเต็มจอได้; หน้าที่บันทึกแล้วแสดงรายการจริง + รายการกลับเมื่อยกเลิก
  - แท็บหมวดบัญชีเปลี่ยนเป็นแบบ pill ตามดีไซน์ใหม่

### ทดสอบ

- pgTAP รวม 255 tests (M7 เพิ่ม 21 ใน `supabase/tests/09_m7_general_journal.test.sql`)
- Vitest รวม 117 tests (`journal-math` — ยอดรวมแบบสตางค์ ไม่มีปัดเศษเพี้ยน)
- ทดสอบในเบราว์เซอร์: รูปแบบค่าเสื่อมราคา → ใส่เดบิต 1,500 → ยังไม่สมดุล → เติมส่วนต่าง → สมดุล → บันทึก JV-2026-0001 → ยกเลิกพร้อมเหตุผล (เห็นรายการกลับ); บัญชีลูกหนี้กดเลือกไม่ได้; มือถือ

### ถัดไป: M9 — Mobile polish + Release prep

## Redesign + แบรนด์ FINORA (2026-11-25)

- ชื่อแบรนด์ **FINORA** (แอป, แท็บเบราว์เซอร์, PWA, Capacitor, Android/iOS display name) + โลโก้ใหม่ (`BrandMark`, `public/favicon.svg`, ไอคอน PWA)
- ธีมใหม่ตามสีที่เจ้าของกำหนด — รายละเอียด/กฎการใช้สีอยู่ใน [docs/DESIGN_SYSTEM.md](docs/DESIGN_SYSTEM.md)
- ฟอนต์ Inter + Noto Sans Thai, ปุ่มแคปซูล, การ์ดมน, segmented control, ป้ายสถานะตามโทนสี
- ทุกหน้าใช้ความกว้างเต็มจอ, แผงจำลองบัญชีมีโหมด **เต็มจอ** (desktop + มือถือ), dialog เต็มจอบนมือถือ
- หน้าแรก: ปุ่มลัด (ใบแจ้งหนี้, รับชำระ, ค่าใช้จ่าย, ผู้ติดต่อ) จนกว่าจะทำ dashboard ใน M8
- แก้บั๊กเดิม: `.pt-safe` ทับ padding ด้านบน (หัวหน้าจอชิดขอบ)
- ค้าง: ไอคอนแอป native (Android mipmap / iOS AppIcon) ยังเป็นของเดิม → ทำใน M9; ยังไม่มี dark mode

## PDF ดีไซน์ใหม่ + โลโก้บริษัทลูกค้า (2026-11-25)

- PDF เอกสารทุกแบบ + 50 ทวิ ออกแบบใหม่ตามธีมเว็บ/โลโก้ FINORA (ข้อมูลตามกฎหมายครบเหมือนเดิม) — ดู docs/DESIGN_SYSTEM.md
- อัปโหลดโลโก้บริษัท (ตั้งค่า → ข้อมูลบริษัท): ใช้ใน PDF, 50 ทวิ, หน้าลิงก์แชร์, ตัวเลือกบริษัท
- migration `20261125080000_company_logo.sql` (bucket `company-logos` + RLS, logo ใน 50 ทวิ) + pgTAP 6 tests
- ข้อควรรู้: โลโก้ FINORA เล็กๆ ใน footer PDF ใส่ไม่ได้ (react-pdf ไม่วาดภาพในแถบล่าง) จึงเป็นข้อความ "สร้างด้วย FINORA"

## Dashboard + ห้องทดลองบัญชี + โทนสีโลโก้ (2026-11-25)

- ทั้งแอปใช้โทนสีโลโก้ (cobalt / sky / mint) + โลโก้บนแถบบนมือถือ
- **Dashboard** (หน้าแรก): รายได้/ค่าใช้จ่ายเดือนนี้ (เทียบเดือนก่อน), เงินสด/เงินฝาก, ลูกหนี้ + เกินกำหนด, กราฟรายเดือน (tooltip, สลับ รายได้-ค่าใช้จ่าย/กำไร, 6/12 เดือน), ตัวเลขวิ่ง — ข้อมูลจาก RPC `dashboard_summary` (migration `20261125070000_dashboard.sql`, pgTAP 7 tests)
  - ตัวเลขมาจากบัญชีแยกประเภทจริง; รายงานเต็ม (งบการเงิน, export) ยังเป็นงาน M8
- **ห้องทดลองบัญชี** (`/sandbox`): slider ราคา/จำนวน/ส่วนลด/หัก ณ ที่จ่าย + toggle ประเภทรายการ/บริการ-สินค้า/VAT → ผลลงบัญชีทันทีด้วย engine จริง ไม่บันทึก
- **ฟอร์มลงบัญชี**: ช่องที่กำลังแก้มีกรอบ + ป้าย "กำลังแก้บรรทัด n"; แผงจำลองบอกว่าแก้อะไรและเน้นบัญชีที่ได้รับผล; ยอดเงินวิ่งไปค่าใหม่
- เพิ่ม dependency: `recharts`

## หน้าโปรโมท + โลโก้ FINORA (2026-11-25)

- โลโก้ "F" ของเจ้าของ → SVG (`public/brand/finora-mark.svg`) ใช้ทั้งแอป, favicon, ไอคอน PWA
- หน้าโปรโมท `/welcome` (ผู้ที่ยังไม่ login เปิด `/` จะมาที่นี่; ลิงก์ตรงไปหน้าอื่นยังไป `/login`) — ไทย/อังกฤษ, scroll reveal, parallax, sticky showcase, glassmorphism, ตารางเปรียบเทียบ, CTA ทรงมน
- `/login?mode=signUp` เปิดหน้าสมัครเลย, หน้า login มีปุ่มกลับหน้าแรก
- ค้าง: ไอคอนแอป native (Android/iOS) ยังเป็นของเดิม → M9; ฟอร์ม "ติดต่อ/นัดเดโม" ยังไม่มี (ต้องตัดสินใจว่าส่งไปที่ไหน)

## การเปลี่ยนแปลงขอบเขต (2026-11-25)

- เพิ่ม Phase 2+3 (M10–M22) ตาม `docs/PHASE2-3_SPEC.md`
- **ข้อกำหนดดีไซน์ใหม่: จำลองการลงบัญชีระหว่างกรอก** (`docs/DESIGN_SIMULATION.md`)
  - กระทบ M4: แยก `private.build_journal()` (pure) ให้ `post_document()` และ `simulate_posting()` ใช้ร่วมกัน + test ว่าผลจำลอง = ผล post จริง
  - กระทบ M5/M6/M7 และ M12–M15, M20, M22: ทุกฟอร์มที่ลงบัญชีต้องมี `<PostingPreview>`
- **ข้อมูลที่ต้องได้ก่อน M17 (OCR):** OCR รันที่ไหน, เรียกใช้อย่างไร, ตัวอย่าง JSON จริง 3–5 ไฟล์ใน `samples/ocr/`, มี confidence ต่อ field หรือไม่
- M11: ไฟล์ข้อความสำหรับยื่นออนไลน์ — ต้องถามรูปแบบก่อนทำ

## หัวหน้าเพจแบบ global + ปุ่มจัดหมวด (2026-11-25)

- `PageHeader` / `ActionGroup` ใช้ทุกหน้า: หมวด · ชื่อหน้า · คำอธิบาย · ปุ่มจัดกลุ่มมีป้าย (ดู docs/DESIGN_SYSTEM.md)
- เมนูสร้างเอกสารมีหัวข้อและคำอธิบายแต่ละประเภท; Dashboard ทางลัดแบ่ง 3 กลุ่ม
- แก้ "Could not find the function … / Bucket not found": ฐานข้อมูลเครื่องเจ้าของยังไม่ได้รัน migration ใหม่ → `npm run db:start` รัน `migration up` ให้แล้ว, มี `npm run db:migrate`, และแอปแสดงข้อความแนะนำแทน error ดิบ

## เมนูข้างแบบหมวดขยายได้ + ฟังก์ชันที่ยังไม่ทำ (2026-11-25)

- `NavTree`: หมวดกดขยาย; ฟังก์ชันที่ยังไม่ทำแสดงสีเทากดไม่ได้พร้อมป้าย M# (รายงาน M8/M10/M11/M13/M16, กระทบยอด M12, สต็อก M13, สินทรัพย์ M14, ปิดงวด M15, OCR M17–M22)
- เมื่อทำ M ใดเสร็จ ให้เปิดลิงก์ในไฟล์ `nav-items.ts` (ใส่ `to`, ลบ `milestone`)
- ลบหน้า ComingSoon และ route `/reports` เดิม (ไม่มีลิงก์ไปแล้ว)

## M8 — รายงาน (2026-11-25)

- migration `20261125100000_m8_reports.sql`: RPC อ่านอย่างเดียว `report_trial_balance`, `report_income_statement`, `report_balance_sheet`, `report_general_ledger`, `report_receivable_payable` (รับรายการบริษัทหลายแห่งได้ — ตรวจสมาชิกทุกแห่ง) + pgTAP `10_m8_reports.test.sql` (14 tests)
- ทุกรายงานแปลงเป็น `ReportTable` เดียว (`src/features/reports/model.ts`) แล้วใช้ร่วมกันทั้งหน้าจอ / PDF (`ReportPdf.tsx`) / Excel (`export-xlsx.ts`, exceljs โหลดเมื่อกดส่งออก)
- ตัวกรองอยู่ใน URL (`?cos=…&from=…&to=…`): เลือกบริษัทเดียวหรือรวมหลายบริษัท, ช่วงวันที่ + ปุ่มลัด, ณ วันที่ (งบแสดงฐานะ/ลูกหนี้-เจ้าหนี้)
- ตัดสินใจ D10 (รวมตามรหัสบัญชี, กำไรที่ยังไม่ปิดบัญชี)
- เปิดลิงก์ในเมนู: งบทดลอง, งบกำไรขาดทุน, งบแสดงฐานะการเงิน, บัญชีแยกประเภท, ลูกหนี้/เจ้าหนี้คงค้าง
- Dashboard หน้าแรก (รายได้/ค่าใช้จ่าย/กำไร/ลูกหนี้เดือนนี้ vs เดือนก่อน) ทำไปแล้วก่อนหน้านี้
- ค้าง: ลูกหนี้/เจ้าหนี้ตามอายุ (aging) → M16
- ทดสอบ: pgTAP รวม 269 tests, Vitest รวม ~135 tests; ในเบราว์เซอร์: ทุกรายงาน + ดาวน์โหลด PDF/Excel + มือถือ
- ถัดไป: M9 (Mobile polish + Release prep + E2E)

## M9 — Mobile polish + Release prep (2026-11-25)

- ตรวจ responsive ทุกหน้า (25 เส้นทาง × จอ 390 และ 360px): เจอล้นจอ 1 จุด (dropdown ยาวในฟอร์มใบค่าใช้จ่าย) → แก้ด้วย CSS กลาง; ตารางรายงานเลื่อนแนวนอนในการ์ด
- Safe area iOS (viewport-fit=cover + env(safe-area-*) ในแถบบน/ล่าง/dialog/แผงจำลอง) และปุ่ม Back ของ Android (`src/lib/native.ts`) มีอยู่แล้ว ตรวจใช้งานครบ
- **bundle id = `com.finora.app`** (เจ้าของเลือก): capacitor.config, Android applicationId/namespace/MainActivity, iOS PRODUCT_BUNDLE_IDENTIFIER
- ไอคอน Android (legacy/round/adaptive) + ไอคอน iOS 1024 + splash ทุกขนาด สร้างจากโลโก้ด้วย `scripts/gen-native-assets.mjs`
- E2E Playwright (`npm run e2e`, `e2e/core-flow.spec.ts`): สมัคร → สร้างบริษัท → ผู้ติดต่อ → ใบแจ้งหนี้ 1,000+VAT → รับชำระ → งบทดลองสมดุล (เงินฝาก 1,070 / รายได้ 1,000 / ภาษีขาย 70) — ผ่าน
- คู่มือขึ้น TestFlight / Play Internal testing + เช็กลิสต์เครื่องจริง: [docs/RELEASE.md](docs/RELEASE.md)
- **ยังไม่ได้ทำ (ต้องใช้เครื่องเจ้าของ):** build .aab/.ipa จริงและทดสอบบนเครื่องจริง — ไม่มี Android SDK/Xcode ในสภาพแวดล้อมนี้ (`cap sync android` ผ่าน)
- ถัดไป: Phase 2 (M10 รายงาน VAT) — เริ่มได้เมื่อ M0–M9 ผ่านครบ + e2e เขียว ✔

## M10 — รายงาน VAT (2026-11-25)

- migration `20261125110000_m10_vat_reports.sql` (เพิ่มอย่างเดียว): `document_lines.vat_claimable`, ใบกำกับผู้ขาย + เดือนที่ใช้สิทธิ์ ใน `documents`/`payments`, ตาราง `vat_returns`, RPC `set_vat_claim`, `report_vat_sales`, `report_vat_purchases`, `vat_return_summary`, `file_vat_return`, `unfile_vat_return`; posting engine (build_journal/save_document/document_payload) รองรับภาษีซื้อขอคืนไม่ได้
- ตัดสินใจ D11–D13 (docs/DECISIONS.md)
- หน้า `/reports/vat`: เดือนภาษี + 3 แท็บ (ภาษีขาย / ภาษีซื้อ / สรุป ภ.พ.30 บรรทัด 1–12) + ส่งออก PDF/Excel + บันทึกการยื่น (ขอคืน/ยกไป) + ข้อความ "ร่างช่วยยื่น" (spec Phase 2 §0.4)
- ฟอร์มซื้อ: ช่องใบกำกับภาษีผู้ขาย/เดือนที่ใช้สิทธิ์ + ติ๊ก "ภาษีซื้อขอคืนไม่ได้" ต่อบรรทัด (แผงจำลองแสดงผลทันที); เอกสารซื้อ/การจ่ายชำระที่บันทึกแล้วแก้ข้อมูลใบกำกับได้
- PDF/Excel ของทุกรายงานแสดงวันที่ตาม พ.ศ./ค.ศ. ของบริษัท
- ทดสอบ: pgTAP `11_m10_vat.test.sql` (21 tests เทียบตัวเลขคำนวณมือ) รวม 290; Vitest 144+; ในเบราว์เซอร์: ซื้อเงินสดภาษีต้องห้าม → รายงาน 3 แท็บ → PDF
- ค้าง/ทราบไว้: ยังไม่ล็อกการ post/void เอกสารในเดือนที่ยื่นแล้ว (จะทำใน M15 ปิดงวด) — ตอนนี้หน้า ภ.พ.30 แจ้งเตือนถ้าตัวเลขเปลี่ยนหลังยื่น
- ถัดไป: M11 รายงานภาษีหัก ณ ที่จ่าย

## M11 — รายงานภาษีหัก ณ ที่จ่าย (2026-11-25)

- migration `20261125120000_m11_wht_reports.sql`: RPC `report_wht_pnd` (ใบแนบ ภ.ง.ด.3/53), `report_wht_certificates` (ทะเบียน 50 ทวิ ที่ออก), `report_wht_received` (ทะเบียนภาษีถูกหัก จากบัญชี WHT_RECEIVABLE), `set_received_wht_cert`; คอลัมน์ `received_wht_cert_no/date` ใน payments/documents
- ตัดสินใจ D14
- หน้า `/reports/wht`: 4 แท็บ ภ.ง.ด.3 / ภ.ง.ด.53 (สรุปตามประเภทเงินได้ + ใบแนบ พร้อมเงื่อนไข 1/2/3) / 50 ทวิ ที่ออก / 50 ทวิ ที่ได้รับ (เลือกทั้งปีได้) + PDF/Excel (Excel แยกชีตตามตาราง)
- ใบเสร็จรับเงิน/ขายเงินสดที่ถูกหัก: การ์ด "ภาษีที่ลูกค้าหัก ณ ที่จ่าย" บันทึกเลขที่/วันที่ 50 ทวิ ที่ได้รับ
- ส่งออกรายงานรองรับหลายตาราง (`ReportSection`) ใช้ได้กับทุกรายงาน
- ทดสอบ: pgTAP `12_m11_wht.test.sql` (14 tests เทียบตัวเลขคำนวณมือ) รวม 304; Vitest 150
- ค้าง: ไฟล์ข้อความยื่น ภ.ง.ด. ออนไลน์ — รอเจ้าของส่งรูปแบบไฟล์ของกรมสรรพากร
- ถัดไป: M12 กระทบยอดธนาคาร

## ใช้งานง่ายขึ้นสำหรับผู้ใช้ใหม่ (2026-11-26)

- ฟอร์มเอกสารขาย/ซื้อ: ปุ่ม "เพิ่มลูกค้าใหม่ / เพิ่มผู้ขายใหม่" ข้างช่องผู้ติดต่อ เปิด dialog ในหน้าเดิม บันทึกแล้วเลือกให้อัตโนมัติ (ไม่ต้องไปหน้าผู้ติดต่อ)
- ช่องสินค้า/บริการในแต่ละบรรทัด: ตัวเลือก "＋ เพิ่มสินค้า/บริการใหม่…" ใช้คำอธิบายที่พิมพ์ไว้เป็นชื่อ บันทึกแล้วเติมบรรทัดให้ (ราคา VAT หัก ณ ที่จ่าย)
- ContactDialog / ProductDialog รับ `defaultType` / `defaultName` / `onCreated` และกัน submit ทะลุไปฟอร์มเอกสาร
- Dashboard: การ์ด "เริ่มต้นใช้งาน FINORA" 6 ขั้น ติ๊กเองจากข้อมูลจริง มีแถบความคืบหน้า เน้นขั้นถัดไป ซ่อนได้ และหายเองเมื่อครบ
- หน้าสร้างบริษัท: error ฐานข้อมูลยังไม่อัปเดตแสดงคำแนะนำแทนข้อความดิบ

## M12 — กระทบยอดธนาคาร (2026-11-26)

- migration `20261125130000_m12_bank_reconciliation.sql`: ตาราง `bank_statements`, `bank_statement_lines`, `bank_matches`, `bank_import_mappings`; RPC `import_bank_statement` (ข้ามรายการซ้ำ, จำ mapping ต่อธนาคาร), `bank_reconcile_data`, `bank_match_suggestions`, `match_bank_line` (หลายรายการบัญชีต่อ 1 รายการ statement), `unmatch_bank_line`, `create_bank_adjustment` (D15), `bank_reconciliation`
- หน้า `/accounting/bank-reconciliation` (เมนู บัญชี → กระทบยอดธนาคาร + แท็บในหมวดบัญชี): ขั้นตอน 4 ข้อบนหน้า, สรุปยอด, นำเข้า CSV/Excel (ลากวาง → เลือกคอลัมน์ + ตัวอย่างการอ่าน; วันที่ พ.ศ./ค.ศ., ถอน/ฝาก หรือคอลัมน์เดียว), จับคู่อัตโนมัติ (ยืนยันทีละคู่หรือทั้งหมด), จับคู่เอง (ไฮไลต์ยอดเท่ากัน + ยอดที่เลือก), ลงบัญชีด่วน, ปุ่มไปรับ/จ่ายชำระพร้อมกรอกค่าไว้, รายงานกระทบยอด + PDF/Excel
- หน้ารับ/จ่ายชำระรับค่า `?date=&account=&ref=&amount=` จาก statement
- ทดสอบ: pgTAP `13_m12_bank_reconciliation.test.sql` (15) รวม 319; Vitest 160 (parse + report); ในเบราว์เซอร์: นำเข้า CSV แบบกสิกร → จับคู่อัตโนมัติ 3 คู่ → ค่าธรรมเนียม JV → รายงานผลต่าง 0
- ถัดไป: M13 สต็อกสินค้า

## M13 — สต็อกสินค้า (2026-11-26)

- migrations `20261126000000_m13_roles.sql` (role COGS, INVENTORY_ADJUSTMENT) + `20261126000100_m13_inventory.sql`: บัญชี 1160/5101/5102 ทุกประเภทธุรกิจ (+ backfill), `products.track_stock/reorder_level`, `companies.cost_method`, `warehouses` (คลังหลักอัตโนมัติ), `stock_movements` (FIFO layers), `stock_consumptions`, `stock_adjustments`, `documents.restock`; engine: build_journal/save_document/document_payload/post_document/void_document/simulate_posting รองรับสต็อก; RPC `set_cost_method`, `post_stock_adjustment`, `void_stock_adjustment`, `stock_balance`, `stock_card`
- ตัดสินใจ D16
- หน้า `/accounting/inventory`: สินค้าคงเหลือ (มูลค่า, ต้นทุนเฉลี่ย, ใกล้หมด), รายงานสินค้าและวัตถุดิบ (รับ/จ่าย/คงเหลือ จำนวน+มูลค่า), ปรับสต็อก (นับ/เสียหาย/ยอดยกมา/อื่นๆ — ผู้ใช้ใส่สิ่งที่เห็น ระบบคำนวณส่วนต่าง), ตั้งค่า (วิธีคิดต้นทุน, ชื่อคลัง), PDF/Excel; หน้าว่างมี 3 ขั้นตอนเริ่มต้น
- สินค้า: สวิตช์ "นับสต็อกสินค้านี้" + จุดสั่งซื้อ; ใบลดหนี้: "คืนสินค้าเข้าสต็อก"; ฟอร์มขายเตือน "สต็อกไม่พอ" ขณะพิมพ์; หน้าแรกแจ้งสินค้าใกล้หมด
- ทดสอบ: pgTAP `14_m13_inventory.test.sql` (17, เทียบตัวเลขคำนวณมือ + มูลค่าสต็อก = ยอดบัญชีสินค้าคงเหลือ) รวม 336 (ปรับ 2 ข้อใน M1: บริษัทบริการได้บัญชีสต็อกเพิ่ม); Vitest 162
- ทราบไว้: สมุดรายวัน (JV) ยังลงบัญชีสินค้าคงเหลือได้ ซึ่งจะทำให้ยอดบัญชีไม่ตรงกับสต็อก — ควรปรับผ่านหน้าปรับสต็อก (อาจบล็อกเหมือน D9 ภายหลังถ้าเจ้าของต้องการ)
- ถัดไป: M14 สินทรัพย์ถาวร

## M14 — สินทรัพย์ถาวร (2026-11-26)

- migrations `20261126010000_m14_roles.sql` (DEPRECIATION_EXPENSE, ASSET_DISPOSAL_GAIN/LOSS) + `20261126010100_m14_fixed_assets.sql`: บัญชี 4920/5280 + map 5270, `asset_categories` (สร้างค่าเริ่มต้นจากผังบัญชีให้ทุกบริษัท), `fixed_assets`, `depreciation_runs/lines`; RPC `register_fixed_asset`, `unregistered_asset_lines`, `depreciation_preview`, `run_depreciation`, `void_depreciation_run`, `disposal_preview`, `dispose_fixed_asset`, `fixed_asset_register`, `init_asset_categories`
- ตัดสินใจ D17
- หน้า `/accounting/fixed-assets`: สรุปตัวเลข, การ์ด "ค่าเสื่อมราคารายเดือน" ปุ่มเดียว (บอกเดือนที่ค้าง + ยอด, ยกเลิกเดือนล่าสุด), ทะเบียน (แถบ % คิดค่าเสื่อม, มูลค่าสุทธิ), รายละเอียด + แผนค่าเสื่อมรายเดือน, ฟอร์มขาย/ตัดจำหน่ายพร้อมพรีวิวกำไร/ขาดทุนและ VAT, จัดการหมวด, PDF/Excel; หน้าว่างมี 3 ขั้นตอน
- ลงทะเบียน 3 แบบ (จากเอกสารซื้อ / ยกมา / ลงบัญชีแล้ว) พรีวิว "ค่าเสื่อม/เดือน · เดือนแรก · คิดครบเมื่อ"; เอกสารซื้อที่ลงบัญชีสินทรัพย์มีปุ่ม "ลงทะเบียน …" ในหน้าเอกสาร
- ทดสอบ: pgTAP `15_m14_fixed_assets.test.sql` (16, เทียบตัวเลขคำนวณมือ รวมการขาย + VAT) รวม 352 (M1 mappings 21); Vitest 166
- ถัดไป: M15 ปิดงวดบัญชี
