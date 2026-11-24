# CLAUDE.md

ระบบบัญชีออนไลน์ (Web + iOS + Android) — React + Vite SPA, Supabase, Capacitor

- **อ่านก่อนเริ่มงานทุกครั้ง:** [docs/PHASE0-1_SPEC.md](docs/PHASE0-1_SPEC.md) และ [PROGRESS.md](PROGRESS.md)
- ทำทีละ milestone ตาม spec ข้อ 0; จบ milestone → lint + typecheck + tests ผ่าน → commit → อัปเดต PROGRESS.md → หยุดรอผู้ใช้ยืนยัน
- logic บัญชีที่ spec ไม่ชัด ให้ถามก่อน ห้ามเดา
- เปลี่ยน DB ผ่าน `supabase/migrations/*.sql` เท่านั้น; logic สำคัญเป็น Postgres function (RPC)
- เงินใช้ `numeric(18,2)` ห้าม float
- โค้ด/ชื่อตัวแปรภาษาอังกฤษ; ข้อความ UI ผ่าน i18next (`src/i18n/locales/th.json`, `en.json`) ห้าม hardcode
- ตรวจก่อน commit: `npm run lint && npm run typecheck && npm test && npm run format:check`
