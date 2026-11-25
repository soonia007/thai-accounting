# FINORA — Design system

แบรนด์ **FINORA** · ดูทันสมัย สะอาด แบบ Apple / Google · ใช้ได้ทั่วโลก (ไทย/อังกฤษ)
ค่าทั้งหมดอยู่ใน `src/index.css` (CSS variables + Tailwind `@theme`) — **ห้าม hardcode สี** ในหน้าจอ ใช้ token เสมอ

## สี (เจ้าของกำหนด 2026-11-25)

| ใช้งาน            | ชื่อ             | Hex       | Token / class                                     |
| ---------------- | -------------- | --------- | ------------------------------------------------- |
| Primary (แบรนด์)  | Mermaid Blue   | `#2690CF` | `brand` — โลโก้, เมนูที่เลือก, focus ring, ไอคอนเน้น    |
| Primary Strong   | Deep Blue      | `#0B56A4` | `brand-strong` = `primary` — ปุ่มหลัก, ลิงก์, ตัวเลขเน้น |
| Secondary        | Mid Blue       | `#3E77BB` | `brand-mid` — สีรอง, กราฟ                          |
| App Background   | Soft Gray Blue | `#F5F8FA` | `background`                                      |
| Card / Container | White          | `#FFFFFF` | `card`                                            |
| Border           | Gray Blue      | `#DCE5EC` | `border`, `input`                                 |
| Main Text        | Charcoal       | `#231F20` | `foreground`                                      |
| Secondary Text   | Gray           | `#657786` | `muted-foreground`                                |
| Success          | Green          | `#2E9D68` | `success` (ข้อความบนพื้นอ่อน: `success-foreground`)   |
| Warning          | Amber          | `#E5A52B` | `warning` (ข้อความ: `warning-foreground`)          |
| Error            | Red            | `#D64545` | `destructive` (ข้อความ: `destructive-foreground`)  |

**การเข้าถึง (WCAG AA ≥ 4.5:1):** ตัวอักษรขาวบน Mermaid Blue ได้แค่ 3.5:1 → ปุ่มทึบใช้ Deep Blue (7.3:1)
Green / Amber / Red สว่างเกินจะเป็นตัวอักษรบนพื้นขาว → ใช้เป็นจุด/ไอคอน/พื้นอ่อน และใช้ `*-foreground` (เข้มกว่า) เป็นตัวอักษร

## โลโก้ (เจ้าของกำหนด 2026-11-25)

ตัว "F" สามชั้น น้ำเงินเข้ม → ฟ้า → มิ้นต์ — เป็น SVG ที่ trace จากไฟล์ของเจ้าของ: `public/brand/finora-mark.svg`, component `BrandMark` / `BrandLogo` (มาร์ก + คำว่า FINORA สี cobalt)
ไอคอน PWA / favicon สร้างจากไฟล์นี้ (พื้นขาว) · ห้ามใช้ไฟล์ภาพพื้นขาวเดิมบนพื้นสี

| สีโลโก้    | Hex       | Token                                                   |
| -------- | --------- | ------------------------------------------------------- |
| Cobalt   | `#0443A8` | `finora-cobalt` — คำว่า FINORA, ปุ่มหลักในหน้าโปรโมท         |
| Blue     | `#015BD3` | `finora-blue`                                           |
| Sky      | `#1488EE` | `finora-sky` — ไล่สี, ไฮไลต์ (ห้ามเป็นพื้นของตัวอักษรขาว: 3.3:1) |
| Mint     | `#2DE2C5` | `finora-mint` — จุดเน้นบนพื้นเข้ม, glow                      |
| Obsidian | `#071022` | `finora-obsidian` — section พื้นเข้ม                       |

## หน้าโปรโมท (`/welcome`, ก่อน login)

`src/features/landing/` — Hero (ภาพสินค้าเอียงแล้วตั้งตรงเมื่อเลื่อน + chip กระจกลอย), สถิติ, ฟีเจอร์แบบ bento (กระจกฝ้า),
วิธีใช้งานแบบ sticky (ภาพสินค้าค้างไว้ เปลี่ยนตามขั้น), section พื้นเข้ม, ตารางเปรียบเทียบ, roadmap, CTA

- แอนิเมชัน: `data-reveal` (เฟด/ลอยขึ้น), parallax ผ่าน `--sy`, ทั้งหมดปิดเมื่อผู้ใช้ตั้ง reduced motion
- ภาพสินค้า `public/landing/{th,en}-*.webp` = screenshot จริงจากบริษัทเดโม — ถ่ายใหม่เมื่อหน้าจอเปลี่ยนมาก
- เนื้อหาพูดถึงเฉพาะสิ่งที่ทำแล้ว; ของที่ยังไม่ทำอยู่ใน roadmap พร้อมป้าย "เร็วๆ นี้"

## ตัวอักษร

Inter (ละติน/ตัวเลข) + Noto Sans Thai — self-hosted ผ่าน `@fontsource-variable` (ใช้ได้ offline ในแอป)
ตัวเลขเงินใช้ `tabular-nums` ให้ตรงหลัก · PDF ยังใช้ Sarabun (ฟอนต์ราชการ)

## รูปทรงและพื้นผิว

- ปุ่ม: ทรงแคปซูล (`rounded-full`), สูง 40px (sm 32px)
- การ์ด: `rounded-2xl`, เส้นขอบบาง + `shadow-card`; ยกขึ้นเมื่อ hover ใช้ `shadow-raised`; overlay ใช้ `shadow-overlay`
- ช่องกรอก / select: `rounded-xl`, สูง 40px, focus = ขอบ `brand` + วง 15%
- แท็บ / ตัวสลับ: segmented control (พื้น `muted`, ตัวที่เลือกเป็นการ์ดขาว)
- ป้ายสถานะ: `Badge` variant `success` / `warning` / `danger` / `neutral` + จุดสี

## เลย์เอาต์

- เดสก์ท็อป: sidebar ขาว 256px + เนื้อหา**เต็มความกว้าง**; ฟอร์ม + แผงจำลอง 2 คอลัมน์ (แผงกว้างขึ้นตามจอ 22 → 36rem)
- มือถือ: แถบบน/ล่างโปร่งแสงเบลอ (iOS style), dialog ทุกตัว**เต็มจอ**บนมือถือ, การ์ดกลางจอบนเดสก์ท็อป
- แผงจำลองบัญชี: ปุ่ม **ขยายเต็มจอ** → สรุปภาษาง่าย + รายการบัญชี + T-account พร้อมกัน (Esc ปิด)
- Safe area iOS: ใช้ `pt-[calc(… + env(safe-area-inset-top))]` — อย่าใช้ `.pt-safe` คู่กับ `p-*` (จะทับกัน)
