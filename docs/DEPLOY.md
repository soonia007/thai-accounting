# DEPLOY — เปิด FINORA ออนไลน์ (Supabase Cloud + Cloudflare Pages)

ทำครั้งเดียว ~20 นาที หลังจากนั้นทุกครั้งที่ push ขึ้น GitHub เว็บจะอัปเดตเอง
(ฐานข้อมูลต้องรัน `npx supabase db push` เองเมื่อมี migration ใหม่ — ดูข้อ 4)

## 1. สร้างฐานข้อมูลออนไลน์ (Supabase — ฟรี)

1. สมัคร/เข้าสู่ระบบที่ https://supabase.com → **New project**
   - Name: `finora` · Region: **Southeast Asia (Singapore)** · ตั้ง **Database password** (จดเก็บไว้ ห้ามใส่ใน git)
2. รอสร้างเสร็จ (~2 นาที) แล้วไป **Project Settings → API** จดค่า:
   - **Project URL** (เช่น `https://abcd1234.supabase.co`)
   - **anon public** key (ใช้ฝั่งเว็บได้ เพราะทุกตารางมี RLS)
   - ห้ามใช้ `service_role` key กับเว็บเด็ดขาด
3. จดรหัสโปรเจกต์ (**Reference ID**) จาก Project Settings → General

## 2. ส่งโครงสร้างฐานข้อมูลขึ้นไป (จากเครื่องคุณ ในโฟลเดอร์โปรเจกต์)

```bash
git pull
npx supabase login                       # เปิดเบราว์เซอร์ให้ยืนยัน
npx supabase link --project-ref <Reference ID>   # ถามรหัสผ่านฐานข้อมูลจากข้อ 1
npx supabase db push                     # ส่ง supabase/migrations ทั้งหมดขึ้นไป
```

ตรวจ: Supabase → Table Editor ต้องเห็นตาราง `companies`, `documents`, … และ Storage มี bucket `company-logos`

## 3. ตั้งค่าการเข้าสู่ระบบ (Supabase → Authentication)

- **URL Configuration → Site URL**: ใส่ URL เว็บจริง (ได้จากข้อ 5 เช่น `https://finora.pages.dev`)
  และ **Redirect URLs** เพิ่ม `https://finora.pages.dev/**` (และโดเมนของคุณเองถ้ามี)
- **Sign In / Providers → Email**: ค่าเริ่มต้นบน cloud จะ **ยืนยันอีเมลก่อนเข้าใช้** (แนะนำให้เปิดไว้)
  — อีเมลฟรีของ Supabase ส่งได้จำกัดต่อชั่วโมง ถ้าใช้จริงควรตั้ง SMTP ของคุณเอง (Authentication → Emails → SMTP)
- เข้าด้วย Google: เปิด provider Google และใส่ Client ID/Secret จาก Google Cloud (ถ้ายังไม่ใช้ ข้ามได้)

## 4. เมื่อมี migration ใหม่ในอนาคต

```bash
git pull && npx supabase db push
```

ทำ **ก่อน** หรือพร้อมกับการ push โค้ดเว็บ ไม่งั้นเว็บจะขึ้นข้อความ "ฐานข้อมูลยังไม่ได้อัปเดต"

## 5. ขึ้นเว็บด้วย Cloudflare Pages (เชื่อม GitHub)

1. https://dash.cloudflare.com → **Workers & Pages → Create → Pages → Connect to Git**
2. เลือก repo `thai-accounting` (อนุญาตให้ Cloudflare เข้าถึง repo ถ้าถูกถาม)
3. ตั้งค่า build:
   | ช่อง                    | ค่า                |
   | ---------------------- | ----------------- |
   | Production branch      | `main`            |
   | Framework preset       | `Vite` (หรือ None) |
   | Build command          | `npm run build`   |
   | Build output directory | `dist`            |
4. **Environment variables** (Production และ Preview):
   | ชื่อ                       | ค่า                      |
   | ------------------------ | ----------------------- |
   | `VITE_SUPABASE_URL`      | Project URL จากข้อ 1     |
   | `VITE_SUPABASE_ANON_KEY` | anon public key จากข้อ 1 |
   | `NODE_VERSION`           | `22`                    |
5. **Save and Deploy** → ได้ URL `https://<ชื่อโปรเจกต์>.pages.dev` → กลับไปใส่ในข้อ 3
6. (ถ้ามีโดเมน) Pages → Custom domains → เพิ่มโดเมน แล้วเพิ่มโดเมนนั้นใน Redirect URLs ของ Supabase ด้วย

หมายเหตุ: ค่า `VITE_*` ถูกฝังตอน build — แก้ค่าแล้วต้องกด **Retry deployment** ใหม่

## 6. ทดสอบหลังขึ้น

- เปิด URL → หน้าโปรโมท → สมัครสมาชิก → ยืนยันอีเมล → สร้างบริษัท → ออกใบแจ้งหนี้ → เปิดรายงานงบทดลอง
- รีเฟรชหน้าลึก ๆ เช่น `/reports/vat` ต้องไม่ขึ้น 404 (มี `public/_redirects` จัดการให้แล้ว)
- อัปโหลดโลโก้บริษัทใน ตั้งค่า → ข้อมูลบริษัท

## สิ่งที่ repo เตรียมไว้ให้แล้ว

- `public/_redirects` — ทุกเส้นทางกลับไปที่ `index.html` (SPA)
- `public/_headers` — header ความปลอดภัย + cache ไฟล์ใน `/assets` ระยะยาว, `sw.js` ไม่ cache
- `.node-version` — Node 22
