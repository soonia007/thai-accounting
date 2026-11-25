import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer'
import { PDF_FONT_FAMILY } from '@/features/pdf/fonts'
import { branchLabel } from '@/features/pdf/print-data'
import { bahtText, formatDate, formatMoney } from '@/lib/format'
import type { WhtCertificateData } from './types'

// หนังสือรับรองการหักภาษี ณ ที่จ่าย ตามมาตรา 50 ทวิ แห่งประมวลรัษฎากร
// Thai only: the form is a Revenue Department form and is always issued in Thai.

const s = StyleSheet.create({
  page: {
    fontFamily: PDF_FONT_FAMILY,
    fontSize: 9.5,
    padding: 30,
    color: '#111',
    lineHeight: 1.35,
  },
  row: { flexDirection: 'row' },
  between: { flexDirection: 'row', justifyContent: 'space-between' },
  bold: { fontWeight: 700 },
  muted: { color: '#555' },
  small: { fontSize: 8 },
  box: { borderWidth: 0.8, borderColor: '#333', padding: 6, marginTop: 6 },
  th: {
    flexDirection: 'row',
    borderBottomWidth: 0.8,
    borderColor: '#333',
    paddingVertical: 3,
    fontWeight: 700,
    textAlign: 'center',
  },
  tr: { flexDirection: 'row', borderBottomWidth: 0.4, borderColor: '#aaa', paddingVertical: 3 },
  cType: { width: '52%', paddingHorizontal: 3 },
  cDate: { width: '14%', textAlign: 'center' },
  cAmt: { width: '17%', textAlign: 'right', paddingRight: 3 },
  check: {
    width: 9,
    height: 9,
    borderWidth: 0.8,
    borderColor: '#111',
    marginRight: 3,
    marginTop: 1.5,
  },
  checked: { backgroundColor: '#111' },
  sign: { width: '50%', alignItems: 'center', marginTop: 26 },
  signLine: { borderTopWidth: 0.7, borderColor: '#111', width: '75%', marginBottom: 3 },
})

const m = (n: number | string) => formatMoney(n, 'th')

function Check({ on, label }: { on: boolean; label: string }) {
  return (
    <View style={[s.row, { marginRight: 12 }]}>
      <View style={[s.check, on ? s.checked : {}]} />
      <Text>{label}</Text>
    </View>
  )
}

function Party({
  label,
  name,
  taxId,
  address,
  branch,
}: {
  label: string
  name: string
  taxId: string | null
  address: string | null
  branch: string | null
}) {
  return (
    <View style={s.box}>
      <View style={s.between}>
        <Text style={s.bold}>{label}</Text>
        <Text>เลขประจำตัวผู้เสียภาษีอากร {taxId || '-'}</Text>
      </View>
      <Text>
        ชื่อ {name}
        {branch ? `  (${branch})` : ''}
      </Text>
      <Text>ที่อยู่ {address || '-'}</Text>
    </View>
  )
}

const COPIES = [
  'ฉบับที่ 1 (สำหรับผู้ถูกหักภาษี ณ ที่จ่าย ใช้แนบพร้อมกับแบบแสดงรายการภาษี)',
  'ฉบับที่ 2 (สำหรับผู้ถูกหักภาษี ณ ที่จ่าย เก็บไว้เป็นหลักฐาน)',
]

function CertificatePage({ data, copy }: { data: WhtCertificateData; copy: string }) {
  const date = formatDate(data.cert_date, 'BE')
  return (
    <Page size="A4" style={s.page}>
      <Text style={[s.small, s.muted]}>{copy}</Text>
      <View style={[s.between, { marginTop: 4 }]}>
        <View>
          <Text style={[s.bold, { fontSize: 13 }]}>หนังสือรับรองการหักภาษี ณ ที่จ่าย</Text>
          <Text>ตามมาตรา 50 ทวิ แห่งประมวลรัษฎากร</Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text>เลขที่ {data.number}</Text>
          {data.source_number ? (
            <Text style={[s.small, s.muted]}>อ้างอิง {data.source_number}</Text>
          ) : null}
          {data.voided ? (
            <Text style={[s.bold, { color: '#b00', marginTop: 2 }]}>ยกเลิก / VOID</Text>
          ) : null}
        </View>
      </View>

      <Party
        label="ผู้มีหน้าที่หักภาษี ณ ที่จ่าย"
        name={data.payer.name}
        taxId={data.payer.tax_id}
        address={data.payer.address}
        branch={data.payer.branch_code ? branchLabel(data.payer.branch_code, null) : null}
      />
      <Party
        label="ผู้ถูกหักภาษี ณ ที่จ่าย"
        name={data.payee.name}
        taxId={data.payee.tax_id}
        address={data.payee.address}
        branch={
          data.payee.entity_type === 'juristic' && data.payee.branch_code
            ? branchLabel(data.payee.branch_code, null)
            : null
        }
      />

      <View style={[s.box, s.row, { flexWrap: 'wrap' }]}>
        <Text style={{ marginRight: 8 }}>ลำดับที่ในแบบ</Text>
        <Check on={false} label="ภ.ง.ด.1ก" />
        <Check on={false} label="ภ.ง.ด.2" />
        <Check on={data.form === 'pnd3'} label="ภ.ง.ด.3" />
        <Check on={data.form === 'pnd53'} label="ภ.ง.ด.53" />
      </View>

      <View style={[s.box, { padding: 0 }]}>
        <View style={s.th}>
          <Text style={s.cType}>ประเภทเงินได้พึงประเมินที่จ่าย</Text>
          <Text style={s.cDate}>วัน เดือน ปี ที่จ่าย</Text>
          <Text style={s.cAmt}>จำนวนเงินที่จ่าย</Text>
          <Text style={s.cAmt}>ภาษีที่หักและนำส่งไว้</Text>
        </View>
        {data.lines.map((l, i) => (
          <View key={i} style={s.tr} wrap={false}>
            <Text style={s.cType}>
              {l.name_th} ตามมาตรา {l.section} (อัตรา {Number(l.rate)}%)
            </Text>
            <Text style={s.cDate}>{date}</Text>
            <Text style={s.cAmt}>{m(l.income_amount)}</Text>
            <Text style={s.cAmt}>{m(l.tax_amount)}</Text>
          </View>
        ))}
        <View style={[s.row, { paddingVertical: 3 }]}>
          <Text style={[s.cType, s.bold, { width: '66%' }]}>รวมเงินที่จ่ายและภาษีที่หักนำส่ง</Text>
          <Text style={[s.cAmt, s.bold]}>{m(data.total_income)}</Text>
          <Text style={[s.cAmt, s.bold]}>{m(data.total_tax)}</Text>
        </View>
      </View>
      <View style={[s.box, s.row]}>
        <Text>รวมเงินภาษีที่หักนำส่ง (ตัวอักษร) </Text>
        <Text style={s.bold}>({bahtText(data.total_tax)})</Text>
      </View>

      <View style={[s.box, s.row, { flexWrap: 'wrap' }]}>
        <Text style={{ marginRight: 8 }}>ผู้จ่ายเงิน</Text>
        <Check on={data.condition === 'withhold'} label="(1) หัก ณ ที่จ่าย" />
        <Check on={data.condition === 'pay_always'} label="(2) ออกให้ตลอดไป" />
        <Check on={data.condition === 'pay_once'} label="(3) ออกให้ครั้งเดียว" />
        <Check on={false} label="(4) อื่นๆ" />
      </View>

      <View style={[s.box, s.row]}>
        <Text style={[s.small, { width: '50%' }]}>
          คำเตือน ผู้มีหน้าที่ออกหนังสือรับรองการหักภาษี ณ ที่จ่าย ฝ่าฝืนไม่ปฏิบัติตามมาตรา 50 ทวิ แห่งประมวลรัษฎากร
          ต้องรับโทษทางอาญาตามมาตรา 35 แห่งประมวลรัษฎากร
        </Text>
        <View style={s.sign}>
          <Text style={s.small}>ขอรับรองว่าข้อความและตัวเลขดังกล่าวข้างต้นถูกต้องตรงกับความจริงทุกประการ</Text>
          <View style={{ height: 22 }} />
          <View style={s.signLine} />
          <Text>ผู้จ่ายเงิน</Text>
          <Text>{formatDate(data.cert_date, 'BE', 'long')}</Text>
        </View>
      </View>
    </Page>
  )
}

export function WhtCertificatePdf({ data }: { data: WhtCertificateData }) {
  return (
    <Document title={`50 ทวิ ${data.number}`}>
      {COPIES.map((c) => (
        <CertificatePage key={c} data={data} copy={c} />
      ))}
    </Document>
  )
}
