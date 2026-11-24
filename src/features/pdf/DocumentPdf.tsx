import { Document, Font, Page, StyleSheet, Text, View } from '@react-pdf/renderer'
import thai400 from '@fontsource/sarabun/files/sarabun-thai-400-normal.woff?url'
import thai700 from '@fontsource/sarabun/files/sarabun-thai-700-normal.woff?url'
import latin400 from '@fontsource/sarabun/files/sarabun-latin-400-normal.woff?url'
import latin700 from '@fontsource/sarabun/files/sarabun-latin-700-normal.woff?url'
import { bahtText, formatDate, formatMoney } from '@/lib/format'
import { branchLabel, documentTitle, type PrintData } from './print-data'

// Sarabun (spec §1): Latin + Thai subsets as a fallback chain
Font.register({
  family: 'SarabunLatin',
  fonts: [{ src: latin400 }, { src: latin700, fontWeight: 700 }],
})
Font.register({
  family: 'SarabunThai',
  fonts: [{ src: thai400 }, { src: thai700, fontWeight: 700 }],
})
// Thai has no spaces between words: break lines on Thai word boundaries
const segmenter =
  typeof Intl !== 'undefined' && 'Segmenter' in Intl
    ? new Intl.Segmenter('th', { granularity: 'word' })
    : null
// The '' after each segment marks a break point WITHOUT drawing a hyphen (Thai never hyphenates;
// Sarabun has no hyphen glyph for react-pdf's default and would show a box).
Font.registerHyphenationCallback((word) =>
  segmenter ? Array.from(segmenter.segment(word), (s) => s.segment).flatMap((seg) => [seg, '']) : [word],
)

const s = StyleSheet.create({
  page: {
    fontFamily: ['SarabunLatin', 'SarabunThai'],
    fontSize: 10,
    padding: 36,
    color: '#111',
    lineHeight: 1.4,
  },
  row: { flexDirection: 'row' },
  between: { flexDirection: 'row', justifyContent: 'space-between' },
  bold: { fontWeight: 700 },
  muted: { color: '#555' },
  small: { fontSize: 8.5 },
  title: { fontSize: 15, fontWeight: 700, textAlign: 'right' },
  copyTag: {
    alignSelf: 'flex-end',
    borderWidth: 1,
    borderColor: '#111',
    paddingHorizontal: 6,
    paddingVertical: 1,
    marginTop: 4,
    fontSize: 9,
  },
  box: { borderWidth: 1, borderColor: '#bbb', borderRadius: 3, padding: 8 },
  th: {
    flexDirection: 'row',
    backgroundColor: '#eee',
    borderBottomWidth: 1,
    borderColor: '#999',
    paddingVertical: 4,
    fontWeight: 700,
  },
  tr: { flexDirection: 'row', borderBottomWidth: 0.5, borderColor: '#ccc', paddingVertical: 3 },
  cNo: { width: '6%', textAlign: 'center' },
  cDesc: { width: '44%', paddingHorizontal: 3 },
  cQty: { width: '10%', textAlign: 'right', paddingRight: 3 },
  cPrice: { width: '14%', textAlign: 'right', paddingRight: 3 },
  cDisc: { width: '12%', textAlign: 'right', paddingRight: 3 },
  cAmt: { width: '14%', textAlign: 'right', paddingRight: 3 },
  sign: { width: '45%', alignItems: 'center', marginTop: 36 },
  signLine: { borderTopWidth: 0.7, borderColor: '#111', width: '80%', marginBottom: 3 },
})

const m = (n: number | string | null | undefined) => formatMoney(n ?? 0, 'th')

function Party({
  label,
  name,
  address,
  taxId,
  branch,
}: {
  label: string
  name: string
  address: string | null
  taxId: string | null
  branch: string | null
}) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={[s.small, s.muted]}>{label}</Text>
      <Text style={s.bold}>{name}</Text>
      {address ? <Text>{address}</Text> : null}
      {taxId ? (
        <Text>
          เลขประจำตัวผู้เสียภาษี {taxId}
          {branch ? `  ${branch}` : ''}
        </Text>
      ) : null}
    </View>
  )
}

function TotalRow({ label, value, strong }: { label: string; value: number; strong?: boolean }) {
  return (
    <View style={[s.between, { paddingVertical: 1.5 }]}>
      <Text style={strong ? s.bold : s.muted}>{label}</Text>
      <Text style={strong ? s.bold : undefined}>{m(value)}</Text>
    </View>
  )
}

export function DocumentPdf({ data, copy }: { data: PrintData; copy: boolean }) {
  const { company, contact, document: d } = data
  const era = company.date_era
  const title = documentTitle(data)
  const isPayment = d.kind === 'payment'
  const date = isPayment ? d.pay_date : d.doc_date
  const voided = d.status === 'voided'

  return (
    <Document title={`${title.th} ${d.number ?? ''}`} author={company.name}>
      <Page size="A4" style={s.page}>
        {/* Header: seller | title */}
        <View style={[s.between, { marginBottom: 12 }]}>
          <View style={{ width: '58%' }}>
            <Text style={[s.bold, { fontSize: 13 }]}>{company.name}</Text>
            {company.name_en ? <Text style={s.muted}>{company.name_en}</Text> : null}
            {company.address ? <Text>{company.address}</Text> : null}
            {company.tax_id ? (
              <Text>
                เลขประจำตัวผู้เสียภาษี {company.tax_id}{' '}
                {branchLabel(company.branch_code, company.branch_name)}
              </Text>
            ) : null}
            {company.phone || company.email ? (
              <Text style={s.muted}>
                {[company.phone && `โทร ${company.phone}`, company.email]
                  .filter(Boolean)
                  .join('  ')}
              </Text>
            ) : null}
          </View>
          <View style={{ width: '40%' }}>
            <Text style={s.title}>{title.th}</Text>
            <Text style={[s.muted, { textAlign: 'right' }]}>{title.en}</Text>
            <Text style={s.copyTag}>{copy ? 'สำเนา / Copy' : 'ต้นฉบับ / Original'}</Text>
            {voided ? (
              <Text style={[s.copyTag, { color: '#b00', borderColor: '#b00' }]}>ยกเลิก / VOID</Text>
            ) : null}
          </View>
        </View>

        {/* Buyer | document info */}
        <View style={[s.row, { gap: 10, marginBottom: 12 }]}>
          <View style={[s.box, { flex: 1.6 }]}>
            {contact ? (
              <Party
                label={isPayment && d.direction === 'paid' ? 'จ่ายให้ / Pay to' : 'ลูกค้า / Customer'}
                name={contact.name}
                address={contact.address}
                taxId={contact.tax_id}
                branch={
                  contact.entity_type === 'juristic'
                    ? branchLabel(contact.branch_code, contact.branch_name)
                    : null
                }
              />
            ) : null}
          </View>
          <View style={[s.box, { flex: 1 }]}>
            <View style={s.between}>
              <Text style={s.muted}>เลขที่ / No.</Text>
              <Text style={s.bold}>{d.number ?? '—'}</Text>
            </View>
            <View style={s.between}>
              <Text style={s.muted}>วันที่ / Date</Text>
              <Text>{formatDate(date, era)}</Text>
            </View>
            {!isPayment && d.due_date ? (
              <View style={s.between}>
                <Text style={s.muted}>
                  {d.type === 'quotation' ? 'ยืนราคาถึง' : 'ครบกำหนด / Due'}
                </Text>
                <Text>{formatDate(d.due_date, era)}</Text>
              </View>
            ) : null}
            {d.reference ? (
              <View style={s.between}>
                <Text style={s.muted}>อ้างอิง / Ref.</Text>
                <Text>{d.reference}</Text>
              </View>
            ) : null}
          </View>
        </View>

        {!isPayment && d.ref_number && (d.type === 'credit_note' || d.type === 'debit_note') ? (
          <View style={[s.box, { marginBottom: 10 }]}>
            <Text>
              อ้างอิงเอกสารเลขที่ {d.ref_number} ลงวันที่ {formatDate(d.ref_date, era)}
            </Text>
            <Text>
              มูลค่าตามเอกสารเดิม {m(d.ref_total)} บาท · ผลต่าง {m(d.total)} บาท · มูลค่าที่ถูกต้อง{' '}
              {m(Number(d.ref_total ?? 0) + (d.type === 'credit_note' ? -1 : 1) * Number(d.total))}{' '}
              บาท
            </Text>
          </View>
        ) : null}

        {/* Lines */}
        {!isPayment ? (
          <View>
            <View style={s.th}>
              <Text style={s.cNo}>#</Text>
              <Text style={s.cDesc}>รายการ / Description</Text>
              <Text style={s.cQty}>จำนวน</Text>
              <Text style={s.cPrice}>ราคา/หน่วย</Text>
              <Text style={s.cDisc}>ส่วนลด</Text>
              <Text style={s.cAmt}>จำนวนเงิน</Text>
            </View>
            {d.lines.map((l, i) => (
              <View key={l.line_no} style={s.tr} wrap={false}>
                <Text style={s.cNo}>{i + 1}</Text>
                <Text style={s.cDesc}>{l.description}</Text>
                <Text style={s.cQty}>{Number(l.qty).toLocaleString('th-TH')}</Text>
                <Text style={s.cPrice}>{m(l.unit_price)}</Text>
                <Text style={s.cDisc}>{Number(l.discount) ? m(l.discount) : ''}</Text>
                <Text style={s.cAmt}>{m(l.base_amount)}</Text>
              </View>
            ))}
          </View>
        ) : (
          <View>
            <View style={s.th}>
              <Text style={s.cNo}>#</Text>
              <Text style={{ width: '44%', paddingHorizontal: 3 }}>เอกสาร / Document</Text>
              <Text style={{ width: '16%' }}>วันที่</Text>
              <Text style={[s.cAmt, { width: '17%' }]}>ยอดเอกสาร</Text>
              <Text style={[s.cAmt, { width: '17%' }]}>ชำระครั้งนี้</Text>
            </View>
            {d.allocations.map((a, i) => (
              <View key={a.number} style={s.tr} wrap={false}>
                <Text style={s.cNo}>{i + 1}</Text>
                <Text style={{ width: '44%', paddingHorizontal: 3 }}>{a.number}</Text>
                <Text style={{ width: '16%' }}>{formatDate(a.doc_date, era)}</Text>
                <Text style={[s.cAmt, { width: '17%' }]}>{m(a.total)}</Text>
                <Text style={[s.cAmt, { width: '17%' }]}>{m(a.amount)}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Totals */}
        <View style={[s.row, { marginTop: 10, gap: 10 }]} wrap={false}>
          <View style={[s.box, { flex: 1.4, justifyContent: 'center' }]}>
            <Text style={s.muted}>จำนวนเงินตัวอักษร</Text>
            <Text style={s.bold}>
              ({bahtText(isPayment ? Number(d.amount) + Number(d.wht_amount) : d.total)})
            </Text>
            {d.notes ? <Text style={[s.small, { marginTop: 4 }]}>หมายเหตุ: {d.notes}</Text> : null}
          </View>
          <View style={{ flex: 1 }}>
            {!isPayment ? (
              <>
                <TotalRow label="รวมเป็นเงิน" value={d.subtotal} />
                {company.vat_registered ? (
                  <TotalRow label={`ภาษีมูลค่าเพิ่ม ${Number(d.vat_rate)}%`} value={d.vat_total} />
                ) : null}
                <TotalRow label="จำนวนเงินรวมทั้งสิ้น" value={d.total} strong />
                {Number(d.wht_total) > 0 ? (
                  <>
                    <TotalRow label="หัก ณ ที่จ่าย" value={-Number(d.wht_total)} />
                    <TotalRow label="ยอดชำระสุทธิ" value={d.net_total} strong />
                  </>
                ) : null}
              </>
            ) : (
              <>
                <TotalRow label="รวมชำระ" value={Number(d.amount) + Number(d.wht_amount)} />
                {Number(d.wht_amount) > 0 ? (
                  <TotalRow label="หัก ณ ที่จ่าย" value={-Number(d.wht_amount)} />
                ) : null}
                <TotalRow
                  label={d.direction === 'received' ? 'รับเงินสุทธิ' : 'จ่ายเงินสุทธิ'}
                  value={d.amount}
                  strong
                />
                {d.allocations.some((a) => Number(a.vat_transferred ?? 0) > 0) ? (
                  <TotalRow
                    label="ภาษีมูลค่าเพิ่มที่ถึงกำหนด"
                    value={d.allocations.reduce(
                      (sum, a) => sum + Number(a.vat_transferred ?? 0),
                      0,
                    )}
                  />
                ) : null}
              </>
            )}
          </View>
        </View>

        {/* Signatures */}
        <View style={[s.between, { marginTop: 24 }]} wrap={false}>
          <View style={s.sign}>
            <View style={s.signLine} />
            <Text>{isPayment && d.direction === 'received' ? 'ผู้รับเงิน' : 'ผู้รับเอกสาร'}</Text>
            <Text style={s.muted}>วันที่ ........................</Text>
          </View>
          <View style={s.sign}>
            <View style={s.signLine} />
            <Text>ผู้มีอำนาจลงนาม</Text>
            <Text style={s.muted}>ในนาม {company.name}</Text>
          </View>
        </View>
      </Page>
    </Document>
  )
}
