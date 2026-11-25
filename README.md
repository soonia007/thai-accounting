# FINORA — ระบบบัญชีออนไลน์

Web + iOS + Android accounting app for Thai SMEs (multi-company, VAT, withholding tax).

- Spec: [docs/PHASE0-1_SPEC.md](docs/PHASE0-1_SPEC.md) · [docs/PHASE2-3_SPEC.md](docs/PHASE2-3_SPEC.md)
- สถานะงาน: [PROGRESS.md](PROGRESS.md)

---

## วิธีรันแอปบนเครื่อง

แอปมี 2 ส่วนที่ต้องเปิด:

1. **ฐานข้อมูล (Supabase)** — รันใน Docker บนเครื่องเรา
2. **หน้าเว็บ (Vite)** — เปิดที่ http://localhost:5173

### ก. ติดตั้งโปรแกรม (ทำครั้งเดียวต่อเครื่อง)

| โปรแกรม                        | ใช้ทำอะไร           | ดาวน์โหลด                                       |
| ------------------------------ | ------------------ | ---------------------------------------------- |
| **Git**                        | ดึงโค้ด              | https://git-scm.com/downloads                  |
| **Node.js 22 LTS** (หรือใหม่กว่า) | รันหน้าเว็บ           | https://nodejs.org                             |
| **Docker Desktop**             | รันฐานข้อมูล Supabase | https://www.docker.com/products/docker-desktop |

ตรวจว่าติดตั้งครบ (เปิด Terminal / PowerShell):

```bash
git --version
node -v      # ต้องเป็น v22 ขึ้นไป
docker -v
```

> Windows: หลังติดตั้ง Docker Desktop ถ้า terminal หาคำสั่ง `docker` ไม่เจอ ให้ปิดแล้วเปิด terminal ใหม่ (หรือรีสตาร์ทเครื่อง)

### ข. ตั้งค่าโปรเจกต์ (ทำครั้งแรกครั้งเดียว)

```bash
# 1) ดึงโค้ด (ถ้ายังไม่มีโฟลเดอร์โปรเจกต์)
git clone https://github.com/soonia007/thai-accounting.git
cd thai-accounting

# 2) ติดตั้ง package (รวม Supabase CLI ด้วย ไม่ต้องติดตั้งแยก)
npm install

# 3) เปิดโปรแกรม Docker Desktop ก่อน แล้วรอให้ขึ้นว่า "Engine running"
#    จากนั้นเปิดฐานข้อมูล — ครั้งแรกจะดาวน์โหลด image หลายนาที
npm run db:start
```

```bash
# 4) สร้างไฟล์ตั้งค่า (ค่าใน .env.example ใช้กับฐานข้อมูลบนเครื่องได้เลย ไม่ต้องแก้)
#    macOS / Linux / Git Bash:
cp .env.example .env.local
#    Windows PowerShell:
copy .env.example .env.local
```

> ไฟล์ `.env.local` ไม่ถูก commit ขึ้น Git — แต่ละเครื่องต้องสร้างเองครั้งแรก
> ถ้าภายหลังจะต่อ Supabase บน cloud ให้แก้ 2 ค่าในไฟล์นี้เป็นของโปรเจกต์ cloud

### ค. เปิดแอป (ทำทุกครั้งที่เปิดเครื่องใหม่)

```bash
# 1) เปิดโปรแกรม Docker Desktop แล้วรอให้พร้อม
# 2) เข้าโฟลเดอร์โปรเจกต์
cd thai-accounting
# 3) ดึงโค้ดล่าสุด (ถ้ามีคนแก้จากที่อื่น) และติดตั้ง package ที่เพิ่มมา
git pull
npm install
# 4) เปิดฐานข้อมูล + อัปเดตโครงสร้างฐานข้อมูลเป็นเวอร์ชันล่าสุด (migration ใหม่จาก git pull)
npm run db:start
# 5) เปิดหน้าเว็บ
npm run dev
```

เปิดเบราว์เซอร์ที่ **http://localhost:5173** → กด "สมัครสมาชิก" ด้วยอีเมลอะไรก็ได้
(บนเครื่อง local ไม่ต้องยืนยันอีเมล) → สร้างบริษัทแรก → ใช้งานได้เลย

หน้า terminal ที่รัน `npm run dev` ต้องเปิดค้างไว้ตลอดที่ใช้งาน — กด `Ctrl + C` เพื่อหยุด

### ง. ปิดแอป

```bash
# หยุดหน้าเว็บ: กด Ctrl + C ใน terminal ที่รัน npm run dev
# หยุดฐานข้อมูล (ข้อมูลยังอยู่ครบ เปิดใหม่ด้วย npm run db:start):
npm run db:stop
```

### ลิงก์ที่ใช้บ่อย (ตอนฐานข้อมูลเปิดอยู่)

| ลิงก์                    | คืออะไร                                             |
| ---------------------- | -------------------------------------------------- |
| http://localhost:5173  | ตัวแอป                                              |
| http://127.0.0.1:54323 | Supabase Studio — ดูตาราง/ข้อมูลในฐานข้อมูล             |
| http://127.0.0.1:54324 | Mailpit — กล่องอีเมลจำลอง (อีเมลที่ระบบส่งบนเครื่อง local) |

---

## คำสั่งทั้งหมด

| คำสั่ง                                              | ใช้ทำอะไร                                                    |
| ------------------------------------------------- | ----------------------------------------------------------- |
| `npm run dev`                                     | เปิดหน้าเว็บ http://localhost:5173                             |
| `npm run db:start` / `npm run db:stop`            | เปิด (+ อัปเดตโครงสร้างให้ล่าสุด) / ปิดฐานข้อมูล (ข้อมูลไม่หาย)         |
| `npm run db:migrate`                              | อัปเดตโครงสร้างฐานข้อมูลอย่างเดียว (ข้อมูลไม่หาย) — ใช้หลัง `git pull` |
| `npm run db:status`                               | ดู URL และ key ของฐานข้อมูล                                    |
| `npm run db:reset`                                | ⚠️ **ล้างข้อมูลทั้งหมด** แล้วสร้างฐานข้อมูลใหม่จาก migrations         |
| `npm run db:test`                                 | รันเทสต์ฐานข้อมูล (pgTAP)                                       |
| `npm run lint` · `npm run typecheck` · `npm test` | ตรวจคุณภาพโค้ด / เทสต์หน้าเว็บ                                   |
| `npm run format`                                  | จัดรูปแบบโค้ด                                                  |
| `npm run cap:android`                             | build + รันบน Android (ต้องมี Android Studio)                  |
| `npm run cap:ios`                                 | build + เปิด Xcode (ต้องใช้ Mac)                               |

---

## ปัญหาที่พบบ่อย

| อาการ                                                                           | วิธีแก้                                                                                           |
| ------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `db:start` ขึ้น error เกี่ยวกับ Docker / `docker daemon is not running`              | ยังไม่ได้เปิด Docker Desktop หรือยังเปิดไม่เสร็จ — เปิดแล้วรอ "Engine running" แล้วรันใหม่                   |
| `db:start` บอก port ถูกใช้อยู่ (เช่น 54321, 54322)                                   | มี Supabase ของโปรเจกต์อื่นเปิดค้าง — `npx supabase stop --all` แล้วรันใหม่                             |
| `db:start` ค้าง/ล้มเหลวแปลกๆ หลังเปิดเครื่อง                                          | `npm run db:stop` แล้ว `npm run db:start` อีกครั้ง                                                 |
| ขึ้น "ฐานข้อมูลยังไม่ได้อัปเดต", "Could not find the function …" หรือ "Bucket not found" | ฐานข้อมูลเก่ากว่าโค้ด — รัน `npm run db:migrate` แล้วรีเฟรชหน้าเว็บ                                      |
| หน้าเว็บขาว / ล็อกอินไม่ได้ / ขึ้น "Failed to fetch"                                    | ฐานข้อมูลยังไม่เปิด (`npm run db:start`) หรือ `.env.local` ไม่ถูกต้อง — แก้แล้วหยุด `npm run dev` แล้วรันใหม่ |
| port 5173 ถูกใช้อยู่                                                                | Vite จะเปลี่ยนไปใช้ port อื่นให้เอง (ดูลิงก์ใน terminal)                                                |
| หลัง `git pull` แล้ว error เรื่อง package                                           | รัน `npm install` อีกครั้ง                                                                         |
| อยากเริ่มข้อมูลใหม่หมด                                                               | `npm run db:reset` (ข้อมูลทดลองทั้งหมดจะหายถาวร)                                                   |

---

## แอปมือถือ (ไม่จำเป็นสำหรับใช้งานบนเว็บ)

- **Android:** ติดตั้ง Android Studio + Android SDK → เสียบมือถือ/เปิด emulator → `npm run cap:android`
- **iOS:** ต้องใช้ Mac + Xcode → `npm run cap:ios` แล้วกด Run ใน Xcode
- แอปบนมือถือ/emulator ต่อฐานข้อมูลบนคอมผ่าน `127.0.0.1` ไม่ได้ — ต้องเปลี่ยน `VITE_SUPABASE_URL` เป็น IP ของคอมในวง LAN (เช่น `http://192.168.1.10:54321`) หรือใช้ Supabase บน cloud
