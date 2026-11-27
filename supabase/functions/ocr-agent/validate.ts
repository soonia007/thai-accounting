// Minimal JSON Schema checker for the keywords ocr-document.v1.json uses (no npm deps, so the
// function boots anywhere): type, const, enum, required, properties, additionalProperties,
// items, maxItems, pattern, maxLength, minimum, maximum, $ref (#/$defs/...).
type Schema = Record<string, unknown>
export interface Issue {
  path: string
  message: string
}

function typeOf(v: unknown): string {
  if (v === null) return 'null'
  if (Array.isArray(v)) return 'array'
  if (typeof v === 'number') return Number.isInteger(v) ? 'integer' : 'number'
  return typeof v
}
function typeOk(v: unknown, t: string | string[]): boolean {
  const actual = typeOf(v)
  return ([] as string[])
    .concat(t)
    .some((x) => x === actual || (x === 'number' && actual === 'integer'))
}

export function validate(root: Schema, value: unknown): Issue[] {
  const issues: Issue[] = []
  const walk = (s: Schema, v: unknown, path: string) => {
    if (issues.length >= 30) return
    if (typeof s.$ref === 'string') {
      const name = s.$ref.replace('#/$defs/', '')
      walk((root.$defs as Record<string, Schema>)[name], v, path)
      return
    }
    const add = (message: string) => issues.push({ path: path || '/', message })
    if (s.type && !typeOk(v, s.type as string | string[])) return add(`must be ${String(s.type)}`)
    if ('const' in s && v !== s.const) return add(`must be ${JSON.stringify(s.const)}`)
    if (Array.isArray(s.enum) && !s.enum.includes(v))
      return add(`must be one of ${s.enum.join(', ')}`)
    if (typeof v === 'string') {
      if (typeof s.maxLength === 'number' && v.length > s.maxLength)
        add(`longer than ${s.maxLength}`)
      if (typeof s.pattern === 'string' && !new RegExp(s.pattern).test(v))
        add(`does not match ${s.pattern}`)
    }
    if (typeof v === 'number') {
      if (!Number.isFinite(v)) add('must be a finite number')
      if (typeof s.minimum === 'number' && v < s.minimum) add(`below ${s.minimum}`)
      if (typeof s.maximum === 'number' && v > s.maximum) add(`above ${s.maximum}`)
    }
    if (Array.isArray(v)) {
      if (typeof s.maxItems === 'number' && v.length > s.maxItems)
        add(`more than ${s.maxItems} items`)
      if (s.items) v.forEach((x, i) => walk(s.items as Schema, x, `${path}/${i}`))
    }
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      const o = v as Record<string, unknown>
      const props = (s.properties ?? {}) as Record<string, Schema>
      for (const r of (s.required as string[] | undefined) ?? []) if (!(r in o)) add(`missing ${r}`)
      for (const [k, x] of Object.entries(o)) {
        if (props[k]) walk(props[k], x, `${path}/${k}`)
        else if (s.additionalProperties === false)
          issues.push({ path: `${path}/${k}`, message: 'unknown field' })
        else if (s.additionalProperties && typeof s.additionalProperties === 'object')
          walk(s.additionalProperties as Schema, x, `${path}/${k}`)
      }
    }
  }
  walk(root, value, '')
  return issues
}
