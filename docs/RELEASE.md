# RELEASE — ขึ้นทดสอบบนมือถือ (TestFlight / Google Play Internal testing)

> แอปคือ SPA ตัวเดียว (React + Vite) ห่อด้วย Capacitor 8 — bundle id **`com.finora.app`** (iOS และ Android)
> ไอคอน/Splash สร้างจากโลโก้ `public/brand/finora-mark.svg` ด้วย `node scripts/gen-native-assets.mjs`

## 0. ก่อนทุกครั้ง

```bash
git pull && npm install
npm run lint && npm run typecheck && npm test && npm run format:check
npm run db:start && npm run e2e        # E2E: สมัคร → บริษัท → ใบแจ้งหนี้ → รับชำระ → งบทดลอง
```

ตั้งค่า `.env` (ชี้ Supabase **ของจริง** ไม่ใช่ localhost) ก่อน build ที่จะส่งขึ้น Store:
`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (ดู `.env.example`)

## 1. เลขเวอร์ชัน

| แพลตฟอร์ม | ที่แก้                                                                                                          |
| -------- | ------------------------------------------------------------------------------------------------------------ |
| Android  | `android/app/build.gradle` → `versionCode` (เพิ่มทีละ 1 ทุกครั้งที่อัปโหลด) และ `versionName`                         |
| iOS      | Xcode → target App → General → Version (`MARKETING_VERSION`) และ Build (`CURRENT_PROJECT_VERSION`, เพิ่มทุกครั้ง) |

## 2. Android — Google Play Internal testing

1. ติดตั้ง Android Studio (JDK 21, Android SDK) แล้ว `npm run cap:sync` (build เว็บ + sync เข้า `android/`)
2. `npx cap open android` → Build ▸ Generate Signed Bundle (AAB) → สร้าง keystore ใหม่ครั้งแรก **เก็บไฟล์และรหัสไว้ในที่ปลอดภัย ห้าม commit**
3. Google Play Console → สร้างแอป `com.finora.app` → Testing ▸ Internal testing → อัปโหลด `.aab` → เพิ่มอีเมลผู้ทดสอบ
4. ปุ่ม Back ของ Android: ถอยหน้าก่อน ถ้าอยู่หน้าแรกสุดจึงออกจากแอป (`src/lib/native.ts`)

## 3. iOS — TestFlight

1. ต้องใช้ macOS + Xcode + บัญชี Apple Developer; `npm run cap:ios` (build เว็บ + sync + เปิด Xcode)
2. Xcode → target App → Signing & Capabilities → เลือก Team (Bundle Identifier = `com.finora.app`)
3. เลือก Any iOS Device → Product ▸ Archive → Distribute App ▸ App Store Connect ▸ Upload
4. App Store Connect → TestFlight → เพิ่มผู้ทดสอบภายใน
5. คำอธิบายสิทธิ์กล้อง/คลังภาพอยู่ใน `ios/App/App/Info.plist` แล้ว (ใช้ถ่ายรูปบิลแนบเอกสาร)

## 4. เช็กลิสต์ทดสอบบนเครื่องจริง

- [ ] เปิดแอป → เห็น Splash/ไอคอน FINORA, เข้าสู่ระบบได้
- [ ] ออกใบแจ้งหนี้ → แผงจำลองบัญชีขึ้นด้านล่าง กดขยายเต็มจอได้ → บันทึกและลงบัญชี
- [ ] ถ่ายรูปบิล/เลือกจากอัลบั้มแนบกับเอกสาร
- [ ] แชร์ PDF (iOS share sheet / Android)
- [ ] รายงานเลื่อนดูแนวนอนได้, ส่งออก PDF/Excel
- [ ] Safe area (รอยบาก/แถบล่าง iOS) ไม่บังปุ่ม, Back ของ Android ถอยหน้าตามที่คาด

## 5. สถานะการ build ในสภาพแวดล้อมพัฒนา (Linux cloud)

โปรเจกต์ native (`android/`, `ios/`) ถูกตั้งค่า bundle id / ไอคอน / splash / สิทธิ์ครบแล้ว แต่ **ยังไม่ได้ build ไบนารีจริง**
เพราะต้องใช้ Android SDK / Xcode ซึ่งไม่มีในสภาพแวดล้อมนี้ — ต้อง build บนเครื่องของคุณตามขั้นตอนข้างต้น
