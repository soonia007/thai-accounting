import { Document, Image, Page, StyleSheet, Text, View } from '@react-pdf/renderer'
import { bahtText, formatDate, formatMoney } from '@/lib/format'
import { PDF_FONT_FAMILY } from './fonts'
import { branchLabel, documentTitle, type PrintData } from './print-data'
import { C } from './colors'
import { BrandBar, PdfFooter, VoidWatermark } from './theme'

// Modern tax-invoice layout in the FINORA theme. Content follows the Thai full tax invoice
// (seller/buyer name, address, tax ID, branch; number; date; items; VAT shown separately).

const s = StyleSheet.create({
  page: {
    fontFamily: PDF_FONT_FAMILY,
    fontSize: 9.5,
    paddingTop: 34,
    paddingBottom: 54,
    paddingHorizontal: 36,
    color: C.ink,
    lineHeight: 1.4,
  },
  row: { flexDirection: 'row' },
  between: { flexDirection: 'row', justifyContent: 'space-between' },
  bold: { fontWeight: 700 },
  muted: { color: C.muted },
  label: { fontSize: 7.5, color: C.muted, letterSpacing: 0.3 },
  card: { borderWidth: 0.8, borderColor: C.border, borderRadius: 8, padding: 10 },
  pill: {
    alignSelf: 'flex-end',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
    fontSize: 8,
    fontWeight: 700,
  },
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
  tr: {
    flexDirection: 'row',
    borderBottomWidth: 0.6,
    borderColor: C.border,
    paddingVertical: 5.5,
  },
  cNo: { width: '6%', textAlign: 'center' },
  cDesc: { width: '44%', paddingHorizontal: 4 },
  cQty: { width: '10%', textAlign: 'right', paddingRight: 4 },
  cPrice: { width: '14%', textAlign: 'right', paddingRight: 4 },
  cDisc: { width: '12%', textAlign: 'right', paddingRight: 4 },
  cAmt: { width: '14%', textAlign: 'right', paddingRight: 6 },
  sign: { flex: 1, alignItems: 'center', paddingTop: 30 },
  signLine: { borderTopWidth: 0.7, borderColor: C.ink, width: '78%', marginBottom: 4 },
})

const m = (n: number | string | null | undefined) => formatMoney(n ?? 0, 'th')

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flex: 1, gap: 2 }}>
      <Text style={s.label}>{label}</Text>
      <Text style={s.bold}>{value}</Text>
    </View>
  )
}

function TotalRow({ label, value }: { label: string; value: number }) {
  return (
    <View style={[s.between, { paddingVertical: 2.5, paddingHorizontal: 10 }]}>
      <Text style={s.muted}>{label}</Text>
      <Text>{m(value)}</Text>
    </View>
  )
}

/** Emphasised amount: cobalt bar with white text (grand total / net). */
function GrandTotal({ label, value }: { label: string; value: number }) {
  return (
    <View
      style={[
        s.between,
        {
          backgroundColor: C.cobalt,
          color: '#FFFFFF',
          borderRadius: 8,
          paddingVertical: 7,
          paddingHorizontal: 10,
          marginTop: 4,
          alignItems: 'center',
        },
      ]}
    >
      <Text style={s.bold}>{label}</Text>
      <Text style={[s.bold, { fontSize: 12 }]}>{m(value)}</Text>
    </View>
  )
}

export function DocumentPdf({
  data,
  copy,
  logo,
}: {
  data: PrintData
  copy: boolean
  /** company logo as a data URL (see theme.loadLogo); null → company name only */
  logo?: string | null
}) {
  const { company, contact, document: d } = data
  const era = company.date_era
  const title = documentTitle(data)
  const isPayment = d.kind === 'payment'
  const date = isPayment ? d.pay_date : d.doc_date
  const voided = d.status === 'voided'
  const partyLabel = isPayment && d.direction === 'paid' ? 'จ่ายให้ / Pay to' : 'ลูกค้า / Bill to'

  return (
    <Document title={`${title.th} ${d.number ?? ''}`} author={company.name} creator="FINORA">
      <Page size="A4" style={s.page}>
        <BrandBar />
        {voided ? <VoidWatermark /> : null}

        {/* Header: seller (logo) | title */}
        <View style={[s.between, { marginBottom: 14 }]}>
          <View style={{ width: '58%', gap: 1.5 }}>
            {logo ? (
              <Image
                src={logo}
                style={{ maxHeight: 46, maxWidth: 160, objectFit: 'contain', marginBottom: 6 }}
              />
            ) : null}
            <Text style={[s.bold, { fontSize: logo ? 11 : 14, color: C.ink }]}>{company.name}</Text>
            {company.name_en ? <Text style={s.muted}>{company.name_en}</Text> : null}
            {company.address ? <Text style={s.muted}>{company.address}</Text> : null}
            {company.tax_id ? (
              <Text style={s.muted}>
                เลขประจำตัวผู้เสียภาษี {company.tax_id} ·{' '}
                {branchLabel(company.branch_code, company.branch_name)}
              </Text>
            ) : null}
            {company.phone || company.email ? (
              <Text style={s.muted}>
                {[company.phone && `โทร ${company.phone}`, company.email]
                  .filter(Boolean)
                  .join(' · ')}
              </Text>
            ) : null}
          </View>
          <View style={{ width: '40%', alignItems: 'flex-end', gap: 3 }}>
            {title.th.split(' / ').map((part) => (
              <Text
                key={part}
                style={{
                  fontSize: title.th.includes(' / ') ? 16 : 19,
                  fontWeight: 700,
                  color: C.cobalt,
                  textAlign: 'right',
                  lineHeight: 1.45,
                }}
              >
                {part}
              </Text>
            ))}
            <Text style={{ fontSize: 8.5, color: C.muted, letterSpacing: 1.2, textAlign: 'right' }}>
              {title.en.toUpperCase()}
            </Text>
            <View style={[s.row, { gap: 4, marginTop: 4 }]}>
              <Text
                style={[
                  s.pill,
                  copy
                    ? { backgroundColor: C.tint, color: C.muted }
                    : { backgroundColor: C.accent, color: C.cobalt },
                ]}
              >
                {copy ? 'สำเนา · COPY' : 'ต้นฉบับ · ORIGINAL'}
              </Text>
              {voided ? (
                <Text style={[s.pill, { backgroundColor: '#FBE9E9', color: C.red }]}>
                  ยกเลิก · VOID
                </Text>
              ) : null}
            </View>
          </View>
        </View>

        {/* Document facts strip */}
        <View
          style={[
            s.row,
            { backgroundColor: C.tint, borderRadius: 8, padding: 10, gap: 10, marginBottom: 10 },
          ]}
        >
          <Meta label="เลขที่ / NO." value={d.number ?? '—'} />
          <Meta label="วันที่ / DATE" value={formatDate(date, era)} />
          {!isPayment && d.due_date ? (
            <Meta
              label={d.type === 'quotation' ? 'ยืนราคาถึง / VALID UNTIL' : 'ครบกำหนด / DUE'}
              value={formatDate(d.due_date, era)}
            />
          ) : null}
          {d.reference ? <Meta label="อ้างอิง / REF." value={d.reference} /> : null}
        </View>

        {/* Buyer */}
        {contact ? (
          <View style={[s.card, { borderLeftWidth: 3, borderLeftColor: C.sky, marginBottom: 10 }]}>
            <Text style={[s.label, { marginBottom: 2 }]}>{partyLabel.toUpperCase()}</Text>
            <Text style={[s.bold, { fontSize: 10.5 }]}>{contact.name}</Text>
            {contact.address ? <Text style={s.muted}>{contact.address}</Text> : null}
            {contact.tax_id ? (
              <Text style={s.muted}>
                เลขประจำตัวผู้เสียภาษี {contact.tax_id}
                {contact.entity_type === 'juristic'
                  ? ` · ${branchLabel(contact.branch_code, contact.branch_name)}`
                  : ''}
              </Text>
            ) : null}
          </View>
        ) : null}

        {!isPayment && d.ref_number && (d.type === 'credit_note' || d.type === 'debit_note') ? (
          <View
            style={[s.card, { backgroundColor: C.accent, borderColor: C.accent, marginBottom: 10 }]}
          >
            <Text>
              อ้างอิงเอกสารเลขที่ <Text style={s.bold}>{d.ref_number}</Text> ลงวันที่{' '}
              {formatDate(d.ref_date, era)}
            </Text>
            <Text style={s.muted}>
              มูลค่าตามเอกสารเดิม {m(d.ref_total)} บาท · ผลต่าง {m(d.total)} บาท · มูลค่าที่ถูกต้อง{' '}
              {m(Number(d.ref_total ?? 0) + (d.type === 'credit_note' ? -1 : 1) * Number(d.total))}{' '}
              บาท
            </Text>
          </View>
        ) : null}

        {/* Lines */}
        {!isPayment ? (
          <View>
            <View style={s.th} fixed>
              <Text style={s.cNo}>#</Text>
              <Text style={s.cDesc}>รายการ / Description</Text>
              <Text style={s.cQty}>จำนวน</Text>
              <Text style={s.cPrice}>ราคา/หน่วย</Text>
              <Text style={s.cDisc}>ส่วนลด</Text>
              <Text style={s.cAmt}>จำนวนเงิน</Text>
            </View>
            {d.lines.map((l, i) => (
              <View
                key={l.line_no}
                style={[s.tr, i % 2 === 1 ? { backgroundColor: C.zebra } : {}]}
                wrap={false}
              >
                <Text style={[s.cNo, s.muted]}>{i + 1}</Text>
                <Text style={s.cDesc}>{l.description}</Text>
                <Text style={s.cQty}>{Number(l.qty).toLocaleString('th-TH')}</Text>
                <Text style={s.cPrice}>{m(l.unit_price)}</Text>
                <Text style={[s.cDisc, s.muted]}>{Number(l.discount) ? m(l.discount) : '—'}</Text>
                <Text style={[s.cAmt, s.bold]}>{m(l.base_amount)}</Text>
              </View>
            ))}
          </View>
        ) : (
          <View>
            <View style={s.th}>
              <Text style={s.cNo}>#</Text>
              <Text style={{ width: '44%', paddingHorizontal: 4 }}>เอกสาร / Document</Text>
              <Text style={{ width: '16%' }}>วันที่</Text>
              <Text style={[s.cAmt, { width: '17%' }]}>ยอดเอกสาร</Text>
              <Text style={[s.cAmt, { width: '17%' }]}>ชำระครั้งนี้</Text>
            </View>
            {d.allocations.map((a, i) => (
              <View
                key={a.number}
                style={[s.tr, i % 2 === 1 ? { backgroundColor: C.zebra } : {}]}
                wrap={false}
              >
                <Text style={[s.cNo, s.muted]}>{i + 1}</Text>
                <Text style={{ width: '44%', paddingHorizontal: 4 }}>{a.number}</Text>
                <Text style={{ width: '16%' }}>{formatDate(a.doc_date, era)}</Text>
                <Text style={[s.cAmt, { width: '17%' }]}>{m(a.total)}</Text>
                <Text style={[s.cAmt, s.bold, { width: '17%' }]}>{m(a.amount)}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Words + notes | totals */}
        <View style={[s.row, { marginTop: 12, gap: 12 }]} wrap={false}>
          <View style={{ flex: 1.3, gap: 8 }}>
            <View style={{ backgroundColor: C.mintTint, borderRadius: 8, padding: 10 }}>
              <Text style={[s.label, { color: C.mintInk }]}>จำนวนเงินตัวอักษร / AMOUNT IN WORDS</Text>
              <Text style={[s.bold, { color: C.mintInk, marginTop: 2 }]}>
                ({bahtText(isPayment ? Number(d.amount) + Number(d.wht_amount) : d.total)})
              </Text>
            </View>
            {d.notes ? (
              <View style={s.card}>
                <Text style={s.label}>หมายเหตุ / NOTES</Text>
                <Text style={{ marginTop: 2 }}>{d.notes}</Text>
              </View>
            ) : null}
          </View>
          <View style={{ flex: 1 }}>
            {!isPayment ? (
              <>
                <TotalRow label="รวมเป็นเงิน" value={d.subtotal} />
                {company.vat_registered ? (
                  <TotalRow label={`ภาษีมูลค่าเพิ่ม ${Number(d.vat_rate)}%`} value={d.vat_total} />
                ) : null}
                <GrandTotal label="จำนวนเงินรวมทั้งสิ้น" value={d.total} />
                {Number(d.wht_total) > 0 ? (
                  <>
                    <View style={{ height: 4 }} />
                    <TotalRow label="หัก ณ ที่จ่าย" value={-Number(d.wht_total)} />
                    <View style={[s.between, { paddingVertical: 2.5, paddingHorizontal: 10 }]}>
                      <Text style={s.bold}>ยอดชำระสุทธิ</Text>
                      <Text style={[s.bold, { color: C.cobalt }]}>{m(d.net_total)}</Text>
                    </View>
                  </>
                ) : null}
              </>
            ) : (
              <>
                <TotalRow label="รวมชำระ" value={Number(d.amount) + Number(d.wht_amount)} />
                {Number(d.wht_amount) > 0 ? (
                  <TotalRow label="หัก ณ ที่จ่าย" value={-Number(d.wht_amount)} />
                ) : null}
                <GrandTotal
                  label={d.direction === 'received' ? 'รับเงินสุทธิ' : 'จ่ายเงินสุทธิ'}
                  value={d.amount}
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
        <View style={[s.row, { marginTop: 26, gap: 14 }]} wrap={false}>
          <View style={[s.card, s.sign]}>
            <View style={s.signLine} />
            <Text>{isPayment && d.direction === 'received' ? 'ผู้รับเงิน' : 'ผู้รับเอกสาร'}</Text>
            <Text style={[s.muted, { fontSize: 8 }]}>วันที่ ........................</Text>
          </View>
          <View style={[s.card, s.sign]}>
            <View style={s.signLine} />
            <Text>ผู้มีอำนาจลงนาม</Text>
            <Text style={[s.muted, { fontSize: 8 }]}>ในนาม {company.name}</Text>
          </View>
        </View>

        <PdfFooter label={`${title.th} ${d.number ?? ''}`} />
      </Page>
    </Document>
  )
}
