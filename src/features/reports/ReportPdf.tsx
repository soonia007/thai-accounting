import { Document, Image, Page, StyleSheet, Text, View } from '@react-pdf/renderer'
import { formatMoney } from '@/lib/format'
import { C } from '@/features/pdf/colors'
import { PDF_FONT_FAMILY } from '@/features/pdf/fonts'
import { BrandBar, PdfFooter } from '@/features/pdf/theme'
import type { ReportTable } from './model'
import type { ReportMeta } from './export-xlsx'

const s = StyleSheet.create({
  page: {
    fontFamily: PDF_FONT_FAMILY,
    fontSize: 8,
    paddingTop: 34,
    paddingBottom: 54,
    paddingHorizontal: 36,
    color: C.ink,
    lineHeight: 1.35,
  },
})

const cellText = (v: string | number | null, zeroDash: boolean) => {
  if (v === null || v === undefined) return ''
  if (typeof v === 'number') return zeroDash && v === 0 ? '–' : formatMoney(v, 'en')
  return v
}

/** A4 report: brand bar, logo + company, title, period, then the table (header repeats per page). */
export function ReportPdf({
  table,
  meta,
  logo,
}: {
  table: ReportTable
  meta: ReportMeta
  logo: string | null
}) {
  const total = table.columns.reduce((t, c) => t + (c.weight ?? 1), 0)
  const w = (i: number) => `${(((table.columns[i].weight ?? 1) / total) * 100).toFixed(2)}%`
  const firstText = table.columns.findIndex((c) => !c.money)

  return (
    <Document title={meta.title} author="FINORA">
      <Page size="A4" style={s.page}>
        <BrandBar />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          {logo && <Image src={logo} style={{ height: 34, maxWidth: 110, objectFit: 'contain' }} />}
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 9, color: C.muted }}>{meta.companies.join(' · ')}</Text>
            <Text style={{ fontSize: 17, fontWeight: 700, color: C.cobalt, lineHeight: 1.7 }}>
              {meta.title}
            </Text>
            <Text style={{ fontSize: 8.5, color: C.muted, marginBottom: 4 }}>{meta.period}</Text>
          </View>
        </View>

        <View
          fixed
          style={{
            flexDirection: 'row',
            backgroundColor: C.cobalt,
            color: '#FFFFFF',
            borderTopLeftRadius: 5,
            borderTopRightRadius: 5,
            paddingVertical: 4,
            paddingHorizontal: 4,
            fontWeight: 700,
          }}
        >
          {table.columns.map((c, i) => (
            <Text
              key={c.key}
              style={{
                width: w(i),
                textAlign: c.align === 'right' ? 'right' : 'left',
                paddingHorizontal: 2,
              }}
            >
              {c.label}
            </Text>
          ))}
        </View>

        {table.rows.map((r, ri) => {
          const kind = r.kind ?? 'normal'
          const label = r.cells.find((c) => c !== null)
          return (
            <View
              key={ri}
              wrap={false}
              style={{
                flexDirection: 'row',
                paddingVertical: 3,
                paddingHorizontal: 4,
                borderBottomWidth: 0.5,
                borderColor: C.border,
                backgroundColor:
                  kind === 'section'
                    ? C.accent
                    : kind === 'total'
                      ? C.tint
                      : ri % 2
                        ? C.zebra
                        : '#FFFFFF',
                ...(kind === 'subtotal' || kind === 'total'
                  ? { borderTopWidth: 0.8, borderTopColor: C.muted }
                  : {}),
              }}
            >
              {kind === 'section' ? (
                <Text style={{ fontWeight: 700, color: C.cobalt, paddingHorizontal: 2 }}>
                  {String(label ?? '')}
                </Text>
              ) : (
                table.columns.map((c, i) => (
                  <Text
                    key={c.key}
                    style={{
                      width: w(i),
                      textAlign: c.align === 'right' ? 'right' : 'left',
                      paddingHorizontal: 2,
                      paddingLeft: r.indent && i === firstText ? 10 : 2,
                      fontWeight: kind === 'normal' ? 400 : 700,
                    }}
                  >
                    {cellText(r.cells[i], kind === 'normal')}
                  </Text>
                ))
              )}
            </View>
          )
        })}

        <PdfFooter label={meta.title} />
      </Page>
    </Document>
  )
}
