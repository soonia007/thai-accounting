# ตัวเชื่อม OCR ของ FINORA (finora-ocr)

ให้โปรแกรม **pdfstruct** ([soonia007/pdf-structure-extractor](https://github.com/soonia007/pdf-structure-extractor))
บนคอมพิวเตอร์ของคุณอ่านบิล/ใบกำกับภาษี/ใบเสร็จ แล้วส่งเข้า FINORA อัตโนมัติ

```
โฟลเดอร์ Inbox ──┐
                 ├─> pdfstruct (อ่าน PDF / OCR ภาพสแกน) ─> แปลงเป็น JSON (contracts/ocr-document.v1.json) ─> FINORA "รอตรวจ"
อัปโหลดในเว็บ ───┘
```

- **ไม่ลงบัญชีเอง** ทุกเอกสารเข้าไปที่สถานะ "รอตรวจ" ให้คนยืนยันก่อน
- ไฟล์ที่ส่งแล้วถูก **ย้าย** ไป `processed/` (ไฟล์ซ้ำไป `processed/duplicates/`, อ่านไม่ได้ไป `failed/` พร้อมไฟล์ `.error.txt`) — ไม่ลบไฟล์ของคุณ
- ไฟล์เดิมส่งซ้ำ (ตรวจจาก SHA-256) จะไม่สร้างงานซ้ำ
- ไฟล์ที่อัปโหลดผ่านเว็บ/มือถือ ตัวเชื่อมจะดึงมาอ่านให้เองด้วย

## ติดตั้ง (Windows) — ทำครั้งเดียว

1. ติดตั้ง **Python 3.10+** จาก https://www.python.org/downloads/ (ติ๊ก _Add python.exe to PATH_)
2. (ถ้าต้องอ่านภาพสแกน/รูปถ่าย) ติดตั้ง **Tesseract** จาก https://github.com/UB-Mannheim/tesseract/wiki
   และติ๊ก **Thai** ใน _Additional language data_ — PDF ที่มีตัวอักษรอยู่แล้วไม่ต้องใช้
3. เปิด PowerShell ในโฟลเดอร์ `tools\ocr-connector` ของโปรเจกต์นี้ แล้วรัน
   ```powershell
   python -m venv .venv
   .venv\Scripts\activate
   pip install "pdfstruct @ git+https://github.com/soonia007/pdf-structure-extractor"
   ```
   (ถ้ามี clone ของ pdf-structure-extractor อยู่แล้ว ใช้ `pip install -e D:\path\to\pdf-structure-extractor` แทนได้)
4. ใน FINORA ไปที่ **นำเข้าเอกสาร → เชื่อมต่อ OCR API** กด **สร้างกุญแจ** แล้วคัดลอกข้อความที่ขึ้นมา
   ไปบันทึกเป็นไฟล์ `finora-ocr.json` ในโฟลเดอร์นี้ (ดูตัวอย่าง `finora-ocr.example.json`)
   แก้ `watch_dir` เป็นโฟลเดอร์ที่จะวางบิล เช่น `"C:/Users/you/Documents/FINORA Inbox"`
5. ทดลองอ่านไฟล์เดียว (ยังไม่ส่ง): `python -m finora_ocr check samples\tax-invoice.pdf`
6. เปิดตัวเชื่อม: `python -m finora_ocr run` — หน้า "เชื่อมต่อ OCR" ในแอปจะขึ้นว่า **โปรแกรมเชื่อมต่ออยู่**

### ให้เปิดเองทุกครั้งที่เปิดเครื่อง

ดับเบิลคลิก `start-finora-ocr.bat` เพื่อทดสอบ แล้วสร้างทางลัดของไฟล์นี้ไว้ใน
`shell:startup` (กด Win+R พิมพ์ `shell:startup`) หรือใช้ Task Scheduler ให้รัน `start-finora-ocr.bat` ตอน log on

## ทำให้อ่านแม่นขึ้น

- ตัวเชื่อมใช้ `thai-documents.spec.yaml` (หาคำว่า "เลขที่", "วันที่", "ยอดรวมทั้งสิ้น", "ภาษีมูลค่าเพิ่ม" ฯลฯ)
  เพิ่มคำที่ร้านของคุณใช้ได้ในไฟล์นี้
- ผู้ขายที่ส่งบิลหน้าตาเดิมทุกครั้ง: **สอน template** ในแอป pdfstruct (ครอปตัวแปร) โดยตั้งชื่อตัวแปรตามนี้
  `document_number`, `issue_date`, `seller_name`, `tax_ids`, `subtotal`, `vat_amount`, `total`, `lines`
  แล้วใส่ `"templates": "C:/path/to/templates"` ใน `finora-ocr.json` — ตัวเชื่อมจะลอง template ก่อน ถ้าไม่ตรงค่อยใช้ spec ทั่วไป
- ค่าที่ความมั่นใจต่ำกว่าเกณฑ์ (ตั้งในแอป ค่าเริ่มต้น 85%) จะถูกไฮไลต์ให้ตรวจ
- สแกนที่ 300 dpi ภาพตรง ไม่เอียง

## สำหรับนักพัฒนา

- สัญญา JSON: [`contracts/ocr-document.v1.json`](../../contracts/ocr-document.v1.json) — โปรแกรม OCR ตัวไหนก็ได้ที่ส่ง JSON ตามนี้
- Endpoint: Supabase Edge Function `ocr-agent` (`supabase/functions/ocr-agent`), header `x-finora-key`
  `POST /ping`, `POST /claim`, `POST /upload` (multipart `file`), `POST /result {job_id, raw, document | error}`
- ตัวเชื่อมเรียก pdfstruct ผ่าน **command line** เท่านั้น (ไม่ผูกกับโค้ดภายในของ OCR)
- ทดสอบ: `pip install -e ".[dev]" && pytest` · `ruff check . && ruff format --check .`
