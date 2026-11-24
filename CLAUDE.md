# CLAUDE.md

ระบบบัญชีออนไลน์ (Web + iOS + Android) — React + Vite SPA, Supabase, Capacitor

- **อ่านก่อนเริ่มงานทุกครั้ง:** [PROGRESS.md](PROGRESS.md) และ spec ของ phase ที่กำลังทำ
  - Phase 0+1 (M0–M9): [docs/PHASE0-1_SPEC.md](docs/PHASE0-1_SPEC.md)
  - Phase 2+3 (M10–M22): [docs/PHASE2-3_SPEC.md](docs/PHASE2-3_SPEC.md) — เริ่มได้เมื่อ M0–M9 ผ่านครบ + e2e เขียว
  - ข้อกำหนดดีไซน์ที่ใช้ทุก phase: [docs/DESIGN_SIMULATION.md](docs/DESIGN_SIMULATION.md) — ทุกฟอร์มที่ลงบัญชีต้องมีแผงจำลองบัญชี real-time และใช้ `build_journal` ตัวเดียวกับ `post_document`
- ทำทีละ milestone ตาม spec ข้อ 0; จบ milestone → lint + typecheck + tests ผ่าน → commit → อัปเดต PROGRESS.md → หยุดรอผู้ใช้ยืนยัน
- logic บัญชีที่ spec ไม่ชัด ให้ถามก่อน ห้ามเดา
- เปลี่ยน DB ผ่าน `supabase/migrations/*.sql` เท่านั้น; logic สำคัญเป็น Postgres function (RPC)
- เงินใช้ `numeric(18,2)` ห้าม float
- โค้ด/ชื่อตัวแปรภาษาอังกฤษ; ข้อความ UI ผ่าน i18next (`src/i18n/locales/th.json`, `en.json`) ห้าม hardcode
- ตรวจก่อน commit: `npm run lint && npm run typecheck && npm test && npm run format:check`
