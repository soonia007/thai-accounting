import { Font } from '@react-pdf/renderer'
import thai400 from '@fontsource/sarabun/files/sarabun-thai-400-normal.woff?url'
import thai700 from '@fontsource/sarabun/files/sarabun-thai-700-normal.woff?url'
import latin400 from '@fontsource/sarabun/files/sarabun-latin-400-normal.woff?url'
import latin700 from '@fontsource/sarabun/files/sarabun-latin-700-normal.woff?url'

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
  segmenter
    ? Array.from(segmenter.segment(word), (s) => s.segment).flatMap((seg) => [seg, ''])
    : [word],
)

export const PDF_FONT_FAMILY = ['SarabunLatin', 'SarabunThai']
