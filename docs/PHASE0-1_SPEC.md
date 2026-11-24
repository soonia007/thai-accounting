# PHASE 0 + 1 SPEC — ระบบบัญชีออนไลน์ (Web + iOS + Android)

> ไฟล์นี้คือ spec หลักของ Phase 0 (รากฐาน) + Phase 1 (บัญชีแกนหลัก) ให้ Claude Code อ่านทุกครั้งก่อนเริ่มงาน
>
> **Phase 0 = รากฐาน** → ข้อ 1–3 (stack, หลักการบัญชี, data model) + M0 (setup) + M1 (multi-company/RLS) + M4 (posting engine, เลขเอกสาร, audit log)
> **Phase 1 = ฟีเจอร์บัญชี** → M2, M3, M5–M9
> ลำดับการทำยังเป็น M0 → M9 ตามเดิม เพราะ M2–M3 (ผังบัญชี, ข้อมูลหลัก) ต้องมีก่อน posting engine
> เป้าหมาย: ระบบบัญชีแกนหลักที่ "ใช้งานง่าย" (ผู้ใช้กรอกเอกสาร ระบบลงบัญชีให้เอง) รองรับหลายบริษัท และเผื่อขาย subscription ในอนาคต

---

## 0. กติกาการทำงานของ Claude Code (สำคัญ)

1. ทำทีละ Milestone (M0 → M9) ห้ามข้าม ห้ามทำหลาย milestone พร้อมกัน
2. จบแต่ละ milestone: รัน lint + typecheck + tests ให้ผ่าน → commit → สรุปสั้นๆ (ทำอะไร / ไฟล์หลัก / วิธีทดสอบ) แล้ว **หยุดรอฉันยืนยัน** ก่อนไป milestone ถัดไป
3. ถ้า spec ไม่ชัดหรือขัดกันเอง ให้ถามก่อน ห้ามเดา logic บัญชีเอง
4. ทุกการเปลี่ยน database ทำผ่าน migration file เท่านั้น
5. อัปเดต `PROGRESS.md` ทุกครั้งที่จบ milestone (สถานะ + สิ่งที่ค้าง) เพื่อให้ session ถัดไปอ่านแทนการอ่านโค้ดทั้งหมด
6. โค้ดและชื่อตัวแปรเป็นภาษาอังกฤษ ส่วน UI รองรับ ไทย (default) / อังกฤษ

## 1. Tech Stack (ล็อกไว้แล้ว)

| ส่วน                 | เลือกใช้                                                                             |
| ------------------- | ---------------------------------------------------------------------------------- |
| Frontend            | React + TypeScript + Vite (SPA)                                                    |
| UI                  | Tailwind CSS + shadcn/ui, mobile-first responsive                                  |
| State/Data          | TanStack Query, React Hook Form + Zod                                              |
| Backend             | Supabase (Postgres, Auth, Storage, Row-Level Security)                             |
| Business logic สำคัญ | Postgres functions (RPC) เพื่อให้ทุก client (web/iOS/Android) ใช้กฎเดียวกันและ atomic     |
| Mobile              | Capacitor (iOS + Android) ห่อ SPA ตัวเดียวกัน + PWA สำหรับเว็บ                           |
| PDF                 | สร้างฝั่ง client ด้วย @react-pdf/renderer + ฟอนต์ไทย (Sarabun)                          |
| i18n                | i18next (th, en)                                                                   |
| Tests               | Vitest (unit), pgTAP หรือ SQL tests สำหรับ posting engine, Playwright (e2e flow หลัก) |

> เหตุผลที่ใช้ SPA ไม่ใช้ Next.js: Capacitor ต้องการ static build และแอปบัญชีอยู่หลัง login อยู่แล้ว จึงไม่ต้องใช้ SSR

## 2. หลักการบัญชีที่ระบบต้องบังคับ

- **บัญชีคู่:** ทุก journal entry ต้อง ผลรวมเดบิต = ผลรวมเครดิต (บังคับใน DB ไม่ใช่แค่ฝั่ง UI)
- **เงิน:** เก็บเป็น `numeric(18,2)` ห้ามใช้ float; ปัดเศษแบบ half-up ต่อบรรทัดตามมาตรฐานใบกำกับภาษี
- **VAT:** default 7% แต่ตั้งค่าได้ต่อบริษัท; รองรับราคา "รวม VAT" / "แยก VAT" / "ไม่มี VAT"; บริษัทที่ไม่จด VAT ต้องซ่อนฟีเจอร์ VAT
- **หัก ณ ที่จ่าย:** ระบุ % ต่อบรรทัดหรือต่อเอกสาร (1, 2, 3, 5% ฯลฯ)
- **สถานะเอกสาร:** `draft` → `posted` → `voided`; เอกสาร posted แก้ไม่ได้ ลบไม่ได้ ทำได้แค่ void (สร้าง reversing entry) หรือออกใบลดหนี้
- **เลขที่เอกสาร:** รันต่อเนื่องต่อ บริษัท + ประเภทเอกสาร + ปี/เดือน ไม่ซ้ำไม่ข้าม (ใช้ sequence table + row lock) รูปแบบตั้งค่าได้ เช่น `INV-2026-0001`
- **Audit log:** บันทึกทุก insert/update/void ว่าใครทำ เมื่อไหร่ ค่าก่อน/หลัง
- **ปี:** เก็บเป็น ค.ศ. แสดงผล พ.ศ./ค.ศ. ตามตั้งค่า; timezone `Asia/Bangkok`
- **จำนวนเงินเป็นตัวอักษรไทย:** เช่น "หนึ่งพันบาทถ้วน" บนเอกสาร

### Posting rules (ระบบลงบัญชีอัตโนมัติ)

| เอกสาร                      | เดบิต                         | เครดิต                            |
| --------------------------- | ---------------------------- | -------------------------------- |
| ใบเสนอราคา                  | (ไม่ลงบัญชี)                    |                                  |
| ใบแจ้งหนี้/ใบกำกับภาษี (ขายเชื่อ)  | ลูกหนี้การค้า                    | รายได้, ภาษีขาย                    |
| ใบเสร็จรับเงิน (รับชำระ)        | เงินสด/ธนาคาร, ภาษีถูกหัก ณ ที่จ่าย | ลูกหนี้การค้า                        |
| ขายเงินสด (ใบกำกับภาษี/ใบเสร็จ) | เงินสด/ธนาคาร, ภาษีถูกหัก ณ ที่จ่าย | รายได้, ภาษีขาย                    |
| ใบลดหนี้                      | รายได้ (หรือรับคืน), ภาษีขาย      | ลูกหนี้การค้า                        |
| ใบเพิ่มหนี้                     | ลูกหนี้การค้า                    | รายได้, ภาษีขาย                    |
| บันทึกค่าใช้จ่าย/ซื้อเชื่อ           | ค่าใช้จ่าย/สินค้า, ภาษีซื้อ          | เจ้าหนี้การค้า                       |
| จ่ายชำระ                     | เจ้าหนี้การค้า                   | เงินสด/ธนาคาร, ภาษีหัก ณ ที่จ่ายค้างจ่าย |
| ซื้อเงินสด                     | ค่าใช้จ่าย/สินค้า, ภาษีซื้อ          | เงินสด/ธนาคาร, ภาษีหัก ณ ที่จ่ายค้างจ่าย |

- บัญชีที่ใช้ใน posting rules ต้อง map ผ่านตาราง `account_mappings` ต่อบริษัท (ผู้ใช้เปลี่ยนได้) ห้าม hardcode เลขบัญชี
- ต้องมี unit/SQL test ครบทุกแถวในตารางนี้ รวมเคส VAT รวมใน/แยกนอก และหัก ณ ที่จ่าย

## 3. Data Model (ขั้นต่ำ)

- `companies` (ชื่อ, ที่อยู่, เลขผู้เสียภาษี 13 หลัก, สาขา/สำนักงานใหญ่, จด VAT?, โลโก้, ตั้งค่าเลขเอกสาร, ปีบัญชีเริ่ม)
- `company_members` (user_id, company_id, role: owner / admin / staff / accountant / viewer)
- `accounts` (ผังบัญชี: code, name_th, name_en, type: asset/liability/equity/revenue/expense, parent_id, is_active, is_system)
- `account_templates` (ผังบัญชีสำเร็จรูปตามประเภทธุรกิจ: บริการ, ซื้อมาขายไป, ผลิต, ร้านอาหาร)
- `account_mappings` (บทบาทบัญชี เช่น AR, AP, OUTPUT_VAT → account_id)
- `contacts` (ลูกค้า/ผู้ขาย/ทั้งคู่, เลขผู้เสียภาษี, สาขา, ที่อยู่, เครดิตเทอม)
- `products` (สินค้า/บริการ, หน่วย, ราคาขาย/ซื้อ, บัญชีรายได้/ค่าใช้จ่าย default, VAT type)
- `bank_accounts` (ผูกกับ account ในผังบัญชี)
- `documents` (header ทุกประเภท: type, number, date, due_date, contact_id, status, totals, vat_mode, `source` = manual|ocr, `ref_document_id` สำหรับแปลงต่อกัน)
- `document_lines` (product, description, qty, unit_price, discount, vat_rate, wht_rate, account_id)
- `payments` (รับ/จ่ายชำระ, ผูกกับ document ได้หลายใบ รองรับชำระบางส่วน)
- `journal_entries` + `journal_lines` (ผูกกลับ document_id)
- `attachments` (ไฟล์ใน Supabase Storage, ผูกกับ document)
- `doc_sequences`, `audit_logs`

> `source`, `status = draft` และ `attachments` คือจุดเชื่อมสำหรับ Phase 3 (OCR → JSON → สร้างเอกสารร่าง) ออกแบบไว้ตั้งแต่ตอนนี้

- ทุกตารางธุรกิจมี `company_id` + RLS policy: ผู้ใช้เห็นเฉพาะบริษัทที่เป็นสมาชิก

## 4. Milestones

### M0 — Project setup

- Vite + React + TS + Tailwind + shadcn/ui, ESLint/Prettier, Vitest
- เชื่อม Supabase (local ด้วย Supabase CLI), โครงสร้าง migrations
- ตั้ง Capacitor (`ios`, `android`) + PWA manifest/service worker
- โครง layout: sidebar (desktop) / bottom nav (mobile), ตัวสลับภาษา
- **Done เมื่อ:** หน้า Hello รันได้บน web, `npx cap run android` ได้; iOS build ได้บน Mac

### M1 — Auth + Multi-company

- สมัคร/ล็อกอิน (email + Google), สร้างบริษัทแรกด้วย onboarding wizard (เลือกประเภทธุรกิจ → โหลดผังบัญชีจาก template)
- สลับบริษัท (company switcher), เชิญสมาชิก + role, RLS ทุกตาราง
- **Done เมื่อ:** test ยืนยันว่า user A มองไม่เห็นข้อมูลบริษัทของ user B

### M2 — ผังบัญชี

- ดู/เพิ่ม/แก้/ปิดใช้งานบัญชี แบบ tree, ค้นหา, บัญชี system ห้ามลบ
- หน้า account mappings

### M3 — ข้อมูลหลัก

- CRUD ผู้ติดต่อ, สินค้า/บริการ, บัญชีธนาคาร พร้อม validate เลขผู้เสียภาษี 13 หลัก (checksum)
- Import/Export CSV

### M4 — Posting engine (หัวใจของระบบ)

- Postgres function `post_document(document_id)`, `void_document(document_id, reason)`
- สร้าง journal ตาม posting rules ข้อ 2, ตรวจ balance, ออกเลขที่เอกสารตอน post, เขียน audit log, ทั้งหมดใน transaction เดียว
- **Done เมื่อ:** tests ครบทุกแถวของ posting rules ผ่าน

### M5 — ฝั่งขาย

- ใบเสนอราคา → ใบแจ้งหนี้/วางบิล → ใบกำกับภาษี/ใบเสร็จ (ปุ่มแปลงเอกสาร), ใบลดหนี้/เพิ่มหนี้
- ฟอร์มกรอกง่าย: เลือกลูกค้า → เพิ่มรายการ → ระบบคำนวณ VAT/หัก ณ ที่จ่าย/ยอดสุทธิ real-time
- รับชำระ (เต็ม/บางส่วน), สถานะ: ค้างชำระ/เกินกำหนด/ชำระแล้ว
- PDF ภาษาไทยตามรูปแบบใบกำกับภาษีเต็มรูป (ข้อมูลผู้ขาย-ผู้ซื้อ เลขผู้เสียภาษี สาขา เลขที่ วันที่ รายการ VAT แยก), มีต้นฉบับ/สำเนา, ส่งทาง email/แชร์ลิงก์

### M6 — ฝั่งซื้อ/ค่าใช้จ่าย

- ใบสั่งซื้อ, บันทึกค่าใช้จ่าย (เชื่อ/สด), จ่ายชำระ
- แนบไฟล์/ถ่ายรูปบิลจากมือถือ (Capacitor Camera)
- ออกหนังสือรับรองหัก ณ ที่จ่าย (50 ทวิ) เป็น PDF

### M7 — สมุดรายวันทั่วไป

- ลงรายการเอง (รายการปรับปรุง), ตรวจ balance ก่อนบันทึก, void ได้

### M8 — รายงาน

- งบทดลอง, งบกำไรขาดทุน, งบแสดงฐานะการเงิน, บัญชีแยกประเภท, สรุปลูกหนี้/เจ้าหนี้คงค้าง
- ตัวกรองช่วงวันที่ เลือกบริษัทเดียวหรือรวมหลายบริษัท (เฉพาะที่ผู้ใช้เป็นสมาชิก)
- Export PDF + Excel
- Dashboard หน้าแรก: รายได้ ค่าใช้จ่าย กำไร ลูกหนี้ค้าง เดือนนี้ vs เดือนก่อน

### M9 — Mobile polish + Release prep

- ทดสอบ responsive ทุกหน้าบนจอมือถือ, safe area iOS, ปุ่ม back Android
- App icon / splash, ตั้ง bundle id, build ทดสอบ (TestFlight / Internal testing)
- E2E (Playwright): สมัคร → สร้างบริษัท → ออกใบกำกับภาษี → รับชำระ → งบทดลองถูกต้อง

## 5. นอก Scope ของ Phase 1 (ห้ามทำตอนนี้)

รายงาน ภ.พ.30 / ภ.ง.ด., กระทบยอดธนาคาร, สต็อก FIFO, สินทรัพย์ถาวร, ปิดงวด (Phase 2) · OCR (Phase 3) · ระบบชำระเงิน subscription, e-Tax Invoice (Phase 4)
→ แต่ data model ต้องไม่ขัดขวางการเพิ่มสิ่งเหล่านี้ภายหลัง
