import { Document, Image, Page, StyleSheet, Text, View } from '@react-pdf/renderer'
import { C } from '@/features/pdf/colors'
import { PDF_FONT_FAMILY } from '@/features/pdf/fonts'
import { branchLabel } from '@/features/pdf/print-data'
import { BrandBar, PdfFooter, VoidWatermark } from '@/features/pdf/theme'
import { bahtText, formatDate, formatMoney } from '@/lib/format'
import type { WhtCertificateData } from './types'

// หนังสือรับรองการหักภาษี ณ ที่จ่าย ตามมาตรา 50 ทวิ แห่งประมวลรัษฎากร
// Keeps every element of the Revenue Department form; styled in the FINORA theme.
// Thai only: the form is a Revenue Department form and is always issued in Thai.

const s = StyleSheet.create({
  page: {
    fontFamily: PDF_FONT_FAMILY,
    fontSize: 9.5,
    paddingTop: 32,
    paddingBottom: 54,
    paddingHorizontal: 34,
    color: C.ink,
    lineHeight: 1.38,
  },
  row: { flexDirection: 'row' },
  between: { flexDirection: 'row', justifyContent: 'space-between' },
  bold: { fontWeight: 700 },
  muted: { color: C.muted },
  label: { fontSize: 7.5, color: C.muted, letterSpacing: 0.3 },
  card: { borderWidth: 0.8, borderColor: C.border, borderRadius: 8, padding: 9, marginTop: 8 },
  th: {
    flexDirection: 'row',
    backgroundColor: C.cobalt,
    color: '#FFFFFF',
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    paddingVertical: 6,
    fontSize: 8.5,
    fontWeight: 700,
  },
  tr: { flexDirection: 'row', borderBottomWidth: 0.6, borderColor: C.border, paddingVertical: 5 },
  cType: { width: '52%', paddingHorizontal: 6 },
  cDate: { width: '14%', textAlign: 'center' },
  cAmt: { width: '17%', textAlign: 'right', paddingRight: 6 },
  check: {
    width: 10,
    height: 10,
    borderWidth: 0.9,
    borderColor: C.muted,
    borderRadius: 3,
    marginRight: 4,
    marginTop: 1.5,
  },
  checked: { backgroundColor: C.cobalt, borderColor: C.cobalt },
  signLine: { borderTopWidth: 0.7, borderColor: C.ink, width: '75%', marginBottom: 3 },
})

const m = (n: number | string) => formatMoney(n, 'th')

function Check({ on, label }: { on: boolean; label: string }) {
  return (
    <View style={[s.row, { marginRight: 14, alignItems: 'center' }]}>
      <View style={[s.check, on ? s.checked : {}]} />
      <Text style={on ? [s.bold, { color: C.cobalt }] : s.muted}>{label}</Text>
    </View>
  )
}

function Party({
  label,
  name,
  taxId,
  address,
  branch,
  accent,
}: {
  label: string
  name: string
  taxId: string | null
  address: string | null
  branch: string | null
  accent: string
}) {
  return (
    <View style={[s.card, { flex: 1, borderLeftWidth: 3, borderLeftColor: accent }]}>
      <Text style={[s.label, { marginBottom: 2 }]}>{label}</Text>
      <Text style={[s.bold, { fontSize: 10.5 }]}>
        {name}
        {branch ? <Text style={[s.muted, { fontWeight: 400 }]}> · {branch}</Text> : null}
      </Text>
      <Text style={s.muted}>เลขประจำตัวผู้เสียภาษีอากร {taxId || '-'}</Text>
      <Text style={s.muted}>ที่อยู่ {address || '-'}</Text>
    </View>
  )
}

const COPIES = [
  'ฉบับที่ 1 (สำหรับผู้ถูกหักภาษี ณ ที่จ่าย ใช้แนบพร้อมกับแบบแสดงรายการภาษี)',
  'ฉบับที่ 2 (สำหรับผู้ถูกหักภาษี ณ ที่จ่าย เก็บไว้เป็นหลักฐาน)',
]

function CertificatePage({
  data,
  copy,
  logo,
}: {
  data: WhtCertificateData
  copy: string
  logo?: string | null
}) {
  const date = formatDate(data.cert_date, 'BE')
  return (
    <Page size="A4" style={s.page}>
      <BrandBar />
      {data.voided ? <VoidWatermark /> : null}

      <View style={[s.between, { alignItems: 'flex-start' }]}>
        <View style={{ width: '60%', gap: 3 }}>
          {logo ? (
            <Image
              src={logo}
              style={{ maxHeight: 40, maxWidth: 150, objectFit: 'contain', marginBottom: 4 }}
            />
          ) : null}
          <Text style={{ fontSize: 17, fontWeight: 700, color: C.cobalt, lineHeight: 1.7 }}>
            หนังสือรับรองการหักภาษี ณ ที่จ่าย
          </Text>
          <Text style={s.muted}>ตามมาตรา 50 ทวิ แห่งประมวลรัษฎากร</Text>
        </View>
        <View style={{ alignItems: 'flex-end', gap: 3 }}>
          <View
            style={{
              backgroundColor: C.tint,
              borderRadius: 8,
              paddingVertical: 6,
              paddingHorizontal: 10,
            }}
          >
            <Text style={s.label}>เลขที่ / NO.</Text>
            <Text style={[s.bold, { fontSize: 11 }]}>{data.number}</Text>
          </View>
          {data.source_number ? (
            <Text style={[s.muted, { fontSize: 8 }]}>อ้างอิง {data.source_number}</Text>
          ) : null}
          {data.voided ? (
            <Text
              style={{
                backgroundColor: '#FBE9E9',
                color: C.red,
                borderRadius: 999,
                paddingHorizontal: 8,
                paddingVertical: 2,
                fontSize: 8,
                fontWeight: 700,
              }}
            >
              ยกเลิก · VOID
            </Text>
          ) : null}
        </View>
      </View>

      <Text
        style={{
          marginTop: 8,
          alignSelf: 'flex-start',
          backgroundColor: C.accent,
          color: C.cobalt,
          borderRadius: 999,
          paddingHorizontal: 9,
          paddingVertical: 2.5,
          fontSize: 8,
          fontWeight: 700,
        }}
      >
        {copy}
      </Text>

      <View style={[s.row, { gap: 10 }]}>
        <Party
          label="ผู้มีหน้าที่หักภาษี ณ ที่จ่าย / PAYER"
          name={data.payer.name}
          taxId={data.payer.tax_id}
          address={data.payer.address}
          branch={data.payer.branch_code ? branchLabel(data.payer.branch_code, null) : null}
          accent={C.cobalt}
        />
        <Party
          label="ผู้ถูกหักภาษี ณ ที่จ่าย / PAYEE"
          name={data.payee.name}
          taxId={data.payee.tax_id}
          address={data.payee.address}
          branch={
            data.payee.entity_type === 'juristic' && data.payee.branch_code
              ? branchLabel(data.payee.branch_code, null)
              : null
          }
          accent={C.sky}
        />
      </View>

      <View
        style={[
          s.card,
          s.row,
          { flexWrap: 'wrap', alignItems: 'center', backgroundColor: C.tint, borderColor: C.tint },
        ]}
      >
        <Text style={[s.bold, { marginRight: 10 }]}>ลำดับที่ในแบบ</Text>
        <Check on={false} label="ภ.ง.ด.1ก" />
        <Check on={false} label="ภ.ง.ด.2" />
        <Check on={data.form === 'pnd3'} label="ภ.ง.ด.3" />
        <Check on={data.form === 'pnd53'} label="ภ.ง.ด.53" />
      </View>

      <View style={{ marginTop: 10 }}>
        <View style={s.th}>
          <Text style={s.cType}>ประเภทเงินได้พึงประเมินที่จ่าย</Text>
          <Text style={s.cDate}>วันเดือนปีที่จ่าย</Text>
          <Text style={s.cAmt}>จำนวนเงินที่จ่าย</Text>
          <Text style={s.cAmt}>ภาษีที่หักและนำส่ง</Text>
        </View>
        {data.lines.map((l, i) => (
          <View
            key={i}
            style={[s.tr, i % 2 === 1 ? { backgroundColor: C.zebra } : {}]}
            wrap={false}
          >
            <Text style={s.cType}>
              {l.name_th}{' '}
              <Text style={s.muted}>
                ตามมาตรา {l.section} · อัตรา {Number(l.rate)}%
              </Text>
            </Text>
            <Text style={s.cDate}>{date}</Text>
            <Text style={s.cAmt}>{m(l.income_amount)}</Text>
            <Text style={[s.cAmt, s.bold]}>{m(l.tax_amount)}</Text>
          </View>
        ))}
        <View
          style={[
            s.row,
            {
              backgroundColor: C.cobalt,
              color: '#FFFFFF',
              borderBottomLeftRadius: 8,
              borderBottomRightRadius: 8,
              paddingVertical: 6,
            },
          ]}
        >
          <Text style={[s.cType, s.bold, { width: '66%' }]}>รวมเงินที่จ่ายและภาษีที่หักนำส่ง</Text>
          <Text style={[s.cAmt, s.bold]}>{m(data.total_income)}</Text>
          <Text style={[s.cAmt, s.bold]}>{m(data.total_tax)}</Text>
        </View>
      </View>

      <View style={[s.card, { backgroundColor: C.mintTint, borderColor: C.mintTint }]}>
        <Text style={[s.label, { color: C.mintInk }]}>รวมเงินภาษีที่หักนำส่ง (ตัวอักษร)</Text>
        <Text style={[s.bold, { color: C.mintInk }]}>({bahtText(data.total_tax)})</Text>
      </View>

      <View style={[s.card, s.row, { flexWrap: 'wrap', alignItems: 'center' }]}>
        <Text style={[s.bold, { marginRight: 10 }]}>ผู้จ่ายเงิน</Text>
        <Check on={data.condition === 'withhold'} label="(1) หัก ณ ที่จ่าย" />
        <Check on={data.condition === 'pay_always'} label="(2) ออกให้ตลอดไป" />
        <Check on={data.condition === 'pay_once'} label="(3) ออกให้ครั้งเดียว" />
        <Check on={false} label="(4) อื่นๆ" />
      </View>

      <View style={[s.row, { gap: 10 }]} wrap={false}>
        <View style={[s.card, { flex: 1, backgroundColor: '#FFF8EC', borderColor: '#F6E3BD' }]}>
          <Text style={[s.label, { color: '#8A5A00' }]}>คำเตือน</Text>
          <Text style={{ fontSize: 8, color: '#6B4700' }}>
            ผู้มีหน้าที่ออกหนังสือรับรองการหักภาษี ณ ที่จ่าย ฝ่าฝืนไม่ปฏิบัติตามมาตรา 50 ทวิ แห่งประมวลรัษฎากร
            ต้องรับโทษทางอาญาตามมาตรา 35 แห่งประมวลรัษฎากร
          </Text>
        </View>
        <View style={[s.card, { flex: 1, alignItems: 'center' }]}>
          <Text style={{ fontSize: 8, textAlign: 'center' }}>
            ขอรับรองว่าข้อความและตัวเลขดังกล่าวข้างต้นถูกต้องตรงกับความจริงทุกประการ
          </Text>
          <View style={{ height: 24 }} />
          <View style={s.signLine} />
          <Text>ผู้จ่ายเงิน</Text>
          <Text style={s.muted}>{formatDate(data.cert_date, 'BE', 'long')}</Text>
        </View>
      </View>

      <PdfFooter label={`50 ทวิ ${data.number}`} />
    </Page>
  )
}

export function WhtCertificatePdf({
  data,
  logo,
}: {
  data: WhtCertificateData
  /** payer's logo as a data URL; null → none */
  logo?: string | null
}) {
  return (
    <Document title={`50 ทวิ ${data.number}`} creator="FINORA">
      {COPIES.map((c) => (
        <CertificatePage key={c} data={data} copy={c} logo={logo} />
      ))}
    </Document>
  )
}
