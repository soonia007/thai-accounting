import { C } from './colors'
import { Defs, LinearGradient, Rect, Stop, Svg, Text, View } from '@react-pdf/renderer'

/** Thin cobalt → sky → mint band across the top of the page (the logo's colours). */
export function BrandBar({ width = 595.28 }: { width?: number }) {
  return (
    <Svg width={width} height={6} style={{ position: 'absolute', top: 0, left: 0 }} fixed>
      <Defs>
        <LinearGradient id="bar" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor={C.cobalt} />
          <Stop offset="0.6" stopColor={C.sky} />
          <Stop offset="1" stopColor={C.mint} />
        </LinearGradient>
      </Defs>
      <Rect x={0} y={0} width={width} height={6} fill="url(#bar)" />
    </Svg>
  )
}

/** Bottom of every page: document number · "Made with FINORA" · page x/y. */
export function PdfFooter({ label }: { label: string }) {
  return (
    <View
      fixed
      style={{
        position: 'absolute',
        top: 841.89 - 40, // A4 height − footer band (react-pdf: top is reliable for fixed items)
        left: 36,
        right: 36,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderTopWidth: 0.6,
        borderColor: C.border,
        paddingTop: 6,
        fontSize: 7.5,
        color: C.muted,
      }}
    >
      {/* react-pdf drops static text in this fixed bottom band; render-prop text is kept */}
      <Text style={{ width: '40%' }} render={() => label} />
      <Text style={{ width: '30%', textAlign: 'center' }} render={() => 'สร้างด้วย FINORA'} />
      <Text
        style={{ width: '30%', textAlign: 'right' }}
        render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`}
      />
    </View>
  )
}

/** Large faint diagonal "VOID" behind the content of a voided document. */
export function VoidWatermark() {
  return (
    <Text
      fixed
      style={{
        position: 'absolute',
        top: 360,
        left: 110,
        fontSize: 110,
        fontWeight: 700,
        color: C.red,
        opacity: 0.08,
        transform: 'rotate(-28deg)',
      }}
    >
      VOID
    </Text>
  )
}
