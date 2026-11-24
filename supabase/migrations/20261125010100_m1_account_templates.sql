-- M1: chart-of-accounts templates per business type.
-- DRAFT for review by the owner/accountant (see PROGRESS.md). Users can edit their own chart in M2.
--
-- Each row: applies to business types `bt` (null = all types).
-- mapping_role links the account to account_mappings, which the posting engine (M4) uses.

insert into public.account_templates
  (business_type, code, name_th, name_en, type, parent_code, is_group, mapping_role, sort_order)
select b.business_type, v.code, v.name_th, v.name_en, v.type::public.account_type, v.parent_code,
       v.is_group, v.mapping_role::public.account_role, v.sort_order
from (
  values
  -- bt, code, name_th, name_en, type, parent, group, role, sort
  -- 1 Assets ----------------------------------------------------------------
  (null, '1000', 'สินทรัพย์', 'Assets', 'asset', null, true, null, 100),
  (null, '1100', 'สินทรัพย์หมุนเวียน', 'Current assets', 'asset', '1000', true, null, 110),
  (null, '1110', 'เงินสด', 'Cash on hand', 'asset', '1100', false, 'CASH', 111),
  (null, '1120', 'เงินฝากธนาคาร', 'Cash at bank', 'asset', '1100', false, 'BANK', 112),
  (null, '1130', 'ลูกหนี้การค้า', 'Trade accounts receivable', 'asset', '1100', false, 'AR', 113),
  (null, '1140', 'ภาษีซื้อ', 'Input VAT', 'asset', '1100', false, 'INPUT_VAT', 114),
  (null, '1150', 'ภาษีเงินได้ถูกหัก ณ ที่จ่าย', 'Withholding tax receivable', 'asset', '1100', false, 'WHT_RECEIVABLE', 115),
  ('{trading}', '1160', 'สินค้าคงเหลือ', 'Inventory', 'asset', '1100', false, 'INVENTORY', 116),
  ('{manufacturing}', '1160', 'สินค้าสำเร็จรูป', 'Finished goods', 'asset', '1100', false, 'INVENTORY', 116),
  ('{manufacturing}', '1161', 'งานระหว่างทำ', 'Work in process', 'asset', '1100', false, null, 117),
  ('{manufacturing}', '1162', 'วัตถุดิบ', 'Raw materials', 'asset', '1100', false, null, 118),
  ('{restaurant}', '1160', 'วัตถุดิบอาหารและเครื่องดื่มคงเหลือ', 'Food and beverage inventory', 'asset', '1100', false, 'INVENTORY', 116),
  (null, '1170', 'ค่าใช้จ่ายจ่ายล่วงหน้า', 'Prepaid expenses', 'asset', '1100', false, null, 119),
  (null, '1200', 'สินทรัพย์ไม่หมุนเวียน', 'Non-current assets', 'asset', '1000', true, null, 120),
  (null, '1210', 'อุปกรณ์สำนักงาน', 'Office equipment', 'asset', '1200', false, null, 121),
  (null, '1211', 'ค่าเสื่อมราคาสะสม - อุปกรณ์สำนักงาน', 'Accumulated depreciation - office equipment', 'asset', '1200', false, null, 122),
  (null, '1220', 'ยานพาหนะ', 'Vehicles', 'asset', '1200', false, null, 123),
  (null, '1221', 'ค่าเสื่อมราคาสะสม - ยานพาหนะ', 'Accumulated depreciation - vehicles', 'asset', '1200', false, null, 124),
  ('{manufacturing}', '1230', 'เครื่องจักร', 'Machinery', 'asset', '1200', false, null, 125),
  ('{manufacturing}', '1231', 'ค่าเสื่อมราคาสะสม - เครื่องจักร', 'Accumulated depreciation - machinery', 'asset', '1200', false, null, 126),
  ('{restaurant}', '1230', 'อุปกรณ์ครัว', 'Kitchen equipment', 'asset', '1200', false, null, 125),
  ('{restaurant}', '1231', 'ค่าเสื่อมราคาสะสม - อุปกรณ์ครัว', 'Accumulated depreciation - kitchen equipment', 'asset', '1200', false, null, 126),
  (null, '1290', 'เงินมัดจำ', 'Deposits', 'asset', '1200', false, null, 129),
  -- 2 Liabilities -----------------------------------------------------------
  (null, '2000', 'หนี้สิน', 'Liabilities', 'liability', null, true, null, 200),
  (null, '2100', 'หนี้สินหมุนเวียน', 'Current liabilities', 'liability', '2000', true, null, 210),
  (null, '2110', 'เจ้าหนี้การค้า', 'Trade accounts payable', 'liability', '2100', false, 'AP', 211),
  (null, '2120', 'ภาษีขาย', 'Output VAT', 'liability', '2100', false, 'OUTPUT_VAT', 212),
  (null, '2130', 'ภาษีหัก ณ ที่จ่ายค้างจ่าย', 'Withholding tax payable', 'liability', '2100', false, 'WHT_PAYABLE', 213),
  (null, '2140', 'ค่าใช้จ่ายค้างจ่าย', 'Accrued expenses', 'liability', '2100', false, null, 214),
  (null, '2150', 'เงินรับล่วงหน้าจากลูกค้า', 'Customer advances', 'liability', '2100', false, null, 215),
  (null, '2160', 'ประกันสังคมค้างจ่าย', 'Social security payable', 'liability', '2100', false, null, 216),
  (null, '2200', 'หนี้สินไม่หมุนเวียน', 'Non-current liabilities', 'liability', '2000', true, null, 220),
  (null, '2210', 'เงินกู้ยืมระยะยาว', 'Long-term loans', 'liability', '2200', false, null, 221),
  (null, '2220', 'เงินกู้ยืมจากกรรมการ', 'Loans from directors', 'liability', '2200', false, null, 222),
  -- 3 Equity ----------------------------------------------------------------
  (null, '3000', 'ส่วนของเจ้าของ', 'Equity', 'equity', null, true, null, 300),
  (null, '3100', 'ทุนที่ชำระแล้ว', 'Paid-up capital', 'equity', '3000', false, null, 310),
  (null, '3200', 'กำไร (ขาดทุน) สะสม', 'Retained earnings', 'equity', '3000', false, 'RETAINED_EARNINGS', 320),
  -- 4 Revenue ---------------------------------------------------------------
  (null, '4000', 'รายได้', 'Revenue', 'revenue', null, true, null, 400),
  ('{service}', '4100', 'รายได้จากการให้บริการ', 'Service revenue', 'revenue', '4000', false, 'SALES_REVENUE', 410),
  ('{trading,manufacturing}', '4100', 'รายได้จากการขาย', 'Sales revenue', 'revenue', '4000', false, 'SALES_REVENUE', 410),
  ('{restaurant}', '4100', 'รายได้จากการขายอาหารและเครื่องดื่ม', 'Food and beverage sales', 'revenue', '4000', false, 'SALES_REVENUE', 410),
  -- contra-revenue: used by credit notes (ใบลดหนี้)
  (null, '4110', 'รับคืนและส่วนลดจ่าย', 'Sales returns and allowances', 'revenue', '4000', false, 'SALES_RETURNS', 411),
  (null, '4900', 'รายได้อื่น', 'Other income', 'revenue', '4000', false, null, 490),
  (null, '4910', 'ดอกเบี้ยรับ', 'Interest income', 'revenue', '4000', false, null, 491),
  -- 5 Expenses --------------------------------------------------------------
  (null, '5000', 'ค่าใช้จ่าย', 'Expenses', 'expense', null, true, null, 500),
  ('{service}', '5100', 'ต้นทุนบริการ', 'Cost of services', 'expense', '5000', true, null, 510),
  ('{service}', '5110', 'ค่าจ้างผู้รับเหมาช่วง', 'Subcontractor costs', 'expense', '5100', false, null, 511),
  ('{trading}', '5100', 'ต้นทุนขาย', 'Cost of sales', 'expense', '5000', true, null, 510),
  ('{trading}', '5110', 'ซื้อสินค้า', 'Purchases', 'expense', '5100', false, null, 511),
  ('{trading}', '5120', 'ค่าขนส่งเข้า', 'Freight-in', 'expense', '5100', false, null, 512),
  ('{manufacturing}', '5100', 'ต้นทุนการผลิต', 'Cost of production', 'expense', '5000', true, null, 510),
  ('{manufacturing}', '5110', 'ซื้อวัตถุดิบ', 'Raw material purchases', 'expense', '5100', false, null, 511),
  ('{manufacturing}', '5120', 'ค่าแรงทางตรง', 'Direct labour', 'expense', '5100', false, null, 512),
  ('{manufacturing}', '5130', 'ค่าใช้จ่ายการผลิต', 'Manufacturing overhead', 'expense', '5100', false, null, 513),
  ('{restaurant}', '5100', 'ต้นทุนขาย', 'Cost of sales', 'expense', '5000', true, null, 510),
  ('{restaurant}', '5110', 'ซื้อวัตถุดิบอาหาร', 'Food purchases', 'expense', '5100', false, null, 511),
  ('{restaurant}', '5120', 'ซื้อเครื่องดื่ม', 'Beverage purchases', 'expense', '5100', false, null, 512),
  ('{restaurant}', '5130', 'ค่าแก๊สและเชื้อเพลิงในครัว', 'Kitchen gas and fuel', 'expense', '5100', false, null, 513),
  (null, '5200', 'ค่าใช้จ่ายในการขายและบริหาร', 'Selling and administrative expenses', 'expense', '5000', true, null, 520),
  (null, '5210', 'เงินเดือนและค่าจ้าง', 'Salaries and wages', 'expense', '5200', false, null, 521),
  (null, '5211', 'เงินสมทบประกันสังคม', 'Social security contributions', 'expense', '5200', false, null, 522),
  (null, '5220', 'ค่าเช่า', 'Rent', 'expense', '5200', false, null, 523),
  (null, '5230', 'ค่าน้ำประปาและค่าไฟฟ้า', 'Utilities', 'expense', '5200', false, null, 524),
  (null, '5240', 'ค่าโทรศัพท์และอินเทอร์เน็ต', 'Telephone and internet', 'expense', '5200', false, null, 525),
  (null, '5250', 'วัสดุสิ้นเปลือง', 'Supplies', 'expense', '5200', false, null, 526),
  (null, '5255', 'ค่าโฆษณาและส่งเสริมการขาย', 'Advertising and promotion', 'expense', '5200', false, null, 527),
  ('{restaurant}', '5256', 'ค่าธรรมเนียมแพลตฟอร์มเดลิเวอรี', 'Delivery platform fees', 'expense', '5200', false, null, 528),
  (null, '5260', 'ค่าธรรมเนียมธนาคาร', 'Bank charges', 'expense', '5200', false, null, 529),
  (null, '5265', 'ค่าทำบัญชีและสอบบัญชี', 'Accounting and audit fees', 'expense', '5200', false, null, 530),
  (null, '5270', 'ค่าเสื่อมราคา', 'Depreciation', 'expense', '5200', false, null, 531),
  (null, '5290', 'ค่าใช้จ่ายเบ็ดเตล็ด', 'Miscellaneous expenses', 'expense', '5200', false, 'DEFAULT_EXPENSE', 539),
  (null, '5300', 'ต้นทุนทางการเงิน', 'Finance costs', 'expense', '5000', true, null, 540),
  (null, '5310', 'ดอกเบี้ยจ่าย', 'Interest expense', 'expense', '5300', false, null, 541),
  (null, '5400', 'ภาษีเงินได้นิติบุคคล', 'Corporate income tax', 'expense', '5000', false, null, 550)
) as v (bt, code, name_th, name_en, type, parent_code, is_group, mapping_role, sort_order)
join (select unnest(enum_range(null::public.business_type)) as business_type) b
  on v.bt is null or b.business_type::text = any (v.bt::text[]);
