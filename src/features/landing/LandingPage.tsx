import {
  ArrowRight,
  Camera,
  Check,
  FileBadge,
  History,
  Landmark,
  Lock,
  Minus,
  Receipt,
  Scale,
  Share2,
  ShieldCheck,
  Sparkles,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react'
import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { BrandLogo, BrandMark } from '@/components/layout/BrandMark'
import { LanguageSwitcher } from '@/components/layout/LanguageSwitcher'
import { useAuth } from '@/features/auth/AuthProvider'
import { cn } from '@/lib/utils'
import { useActiveStep, useReveal, useScrollVar } from './motion'

interface Item {
  title: string
  body: string
}
interface CompareRow {
  label: string
  manual: 'no' | 'partial'
}

const FEATURE_ICONS: LucideIcon[] = [Scale, Sparkles, Landmark, FileBadge, Share2, Camera]
const TRUST_ICONS: LucideIcon[] = [Scale, Lock, History, ShieldCheck]
const STEP_SHOTS = ['invoice', 'simulation', 'posted'] as const

/** Parallax helper: moves an element by `speed` × scroll distance. */
const parallax = (speed: number): CSSProperties => ({
  transform: `translate3d(0, calc(var(--sy, 0) * ${speed}px), 0)`,
})
const delay = (ms: number): CSSProperties => ({ '--d': `${ms}ms` }) as CSSProperties

function Eyebrow({ children, dark }: { children: ReactNode; dark?: boolean }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-2 rounded-full px-3.5 py-1 text-xs font-semibold tracking-wide uppercase',
        dark
          ? 'bg-white/10 text-finora-mint ring-1 ring-white/15'
          : 'bg-white/70 text-finora-cobalt ring-1 ring-finora-cobalt/10 backdrop-blur',
      )}
    >
      <span className={cn('size-1.5 rounded-full', dark ? 'bg-finora-mint' : 'bg-finora-sky')} />
      {children}
    </span>
  )
}

function SectionHead({
  eyebrow,
  title,
  subtitle,
  dark,
}: {
  eyebrow: string
  title: string
  subtitle?: string
  dark?: boolean
}) {
  return (
    <div className="mx-auto flex max-w-3xl flex-col items-center gap-4 text-center" data-reveal>
      <Eyebrow dark={dark}>{eyebrow}</Eyebrow>
      <h2
        className={cn(
          'text-[32px] leading-[1.12] font-bold tracking-[-0.025em] text-balance sm:text-5xl',
          dark ? 'text-white' : 'text-foreground',
        )}
      >
        {title}
      </h2>
      {subtitle && (
        <p
          className={cn(
            'max-w-2xl text-base leading-relaxed text-pretty sm:text-lg',
            dark ? 'text-white/70' : 'text-muted-foreground',
          )}
        >
          {subtitle}
        </p>
      )}
    </div>
  )
}

/** Product screenshot in a soft "app window" frame. */
function Shot({
  src,
  alt,
  className,
  priority,
}: {
  src: string
  alt: string
  className?: string
  priority?: boolean
}) {
  return (
    <div
      className={cn(
        'overflow-hidden rounded-[22px] bg-white/70 p-1.5 shadow-overlay ring-1 ring-black/5 backdrop-blur-xl sm:rounded-[28px] sm:p-2',
        className,
      )}
    >
      <div className="flex items-center gap-1.5 px-3 pt-1.5 pb-2.5" aria-hidden>
        <span className="size-2.5 rounded-full bg-[#ff5f57]" />
        <span className="size-2.5 rounded-full bg-[#febc2e]" />
        <span className="size-2.5 rounded-full bg-[#28c840]" />
      </div>
      <img
        src={src}
        alt={alt}
        width={2160}
        height={1350}
        loading={priority ? 'eager' : 'lazy'}
        decoding="async"
        className="block w-full rounded-[16px] ring-1 ring-black/5 sm:rounded-[20px]"
      />
    </div>
  )
}

function GlassChip({
  icon: Icon,
  children,
  className,
  style,
}: {
  icon: LucideIcon
  children: ReactNode
  className?: string
  style?: CSSProperties
}) {
  return (
    <div className={cn('absolute hidden lg:block', className)} style={style}>
      <div className="animate-float flex items-center gap-2.5 rounded-2xl bg-white/75 px-4 py-3 text-sm font-medium shadow-raised ring-1 ring-white/80 backdrop-blur-xl">
        <span className="flex size-8 items-center justify-center rounded-xl bg-gradient-to-br from-finora-sky to-finora-cobalt text-white">
          <Icon className="size-4" />
        </span>
        {children}
      </div>
    </div>
  )
}

export function LandingPage() {
  const { t, i18n } = useTranslation()
  const { session } = useAuth()
  const root = useRef<HTMLDivElement>(null)
  useReveal(root)
  useScrollVar(root)
  const { active, refs } = useActiveStep(STEP_SHOTS.length)

  // Smooth in-page anchor scrolling while on this page only
  useEffect(() => {
    const html = document.documentElement
    const prev = html.style.scrollBehavior
    if (!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      html.style.scrollBehavior = 'smooth'
    }
    return () => {
      html.style.scrollBehavior = prev
    }
  }, [])

  const lang = i18n.resolvedLanguage === 'en' ? 'en' : 'th'
  const shot = (name: string) => `/landing/${lang}-${name}.webp`
  const alt = (name: string) => t(`landing.imageAlt.${name}`)
  const startTo = session ? '/' : '/login?mode=signUp'
  const startLabel = session ? t('landing.openApp') : t('landing.getStarted')

  const stats = t('landing.stats', { returnObjects: true }) as { value: string; label: string }[]
  const features = t('landing.features.items', { returnObjects: true }) as Item[]
  const steps = t('landing.how.steps', { returnObjects: true }) as Item[]
  const trust = t('landing.trust.items', { returnObjects: true }) as Item[]
  const rows = t('landing.compare.rows', { returnObjects: true }) as CompareRow[]
  const roadmap = t('landing.roadmap.items', { returnObjects: true }) as string[]

  const nav = [
    ['features', t('landing.nav.features')],
    ['how', t('landing.nav.how')],
    ['trust', t('landing.nav.trust')],
    ['compare', t('landing.nav.compare')],
    ['roadmap', t('landing.nav.roadmap')],
  ] as const

  const primaryBtn =
    'inline-flex h-12 items-center justify-center gap-2 rounded-full bg-gradient-to-r from-finora-cobalt to-[#0b5fd0] px-7 text-[15px] font-semibold text-white shadow-[0_10px_30px_-10px_rgb(4_67_168/0.7)] transition-all hover:-translate-y-0.5 hover:shadow-[0_16px_36px_-12px_rgb(4_67_168/0.75)] active:translate-y-0'
  const secondaryBtn =
    'inline-flex h-12 items-center justify-center gap-2 rounded-full bg-white/70 px-7 text-[15px] font-semibold text-foreground ring-1 ring-black/10 backdrop-blur transition-all hover:bg-white'

  return (
    <div ref={root} className="relative min-h-dvh overflow-x-clip bg-[#f7fafd] text-foreground">
      {/* ---------- Header (glass) ---------- */}
      <header className="fixed inset-x-3 top-[calc(0.75rem+env(safe-area-inset-top))] z-40 sm:inset-x-6">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 rounded-full bg-white/70 pr-2 pl-4 shadow-raised ring-1 ring-black/5 backdrop-blur-xl backdrop-saturate-150 sm:pl-5">
          <Link to="/welcome" aria-label="FINORA" className="shrink-0 text-[17px]">
            <BrandLogo
              markClassName="size-7"
              className="[&>span:last-child]:hidden min-[400px]:[&>span:last-child]:inline"
            />
          </Link>
          <nav aria-label="FINORA" className="hidden items-center gap-1 lg:flex">
            {nav.map(([id, label]) => (
              <a
                key={id}
                href={`#${id}`}
                className="rounded-full px-3.5 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-white hover:text-foreground"
              >
                {label}
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-1.5 sm:gap-2">
            <LanguageSwitcher />
            {!session && (
              <Link
                to="/login"
                className="hidden h-10 items-center rounded-full px-4 text-sm font-semibold text-foreground transition-colors hover:bg-white sm:inline-flex"
              >
                {t('landing.signIn')}
              </Link>
            )}
            <Link
              to={startTo}
              className="inline-flex h-10 items-center gap-1.5 rounded-full bg-finora-cobalt px-4 text-sm font-semibold text-white transition-colors hover:bg-[#03388d] sm:px-5"
            >
              {startLabel}
              <ArrowRight className="hidden size-4 sm:block" />
            </Link>
          </div>
        </div>
      </header>

      <main>
        {/* ---------- Hero ---------- */}
        <section className="relative px-4 pt-[calc(8rem+env(safe-area-inset-top))] pb-16 sm:px-6 sm:pt-40 sm:pb-24">
          {/* colour mesh from the logo — moves slower than the page (parallax) */}
          <div aria-hidden className="pointer-events-none absolute inset-0 -z-0 overflow-hidden">
            <div
              className="absolute -top-40 left-1/2 h-[40rem] w-[40rem] -translate-x-[70%] rounded-full bg-finora-sky/25 blur-3xl"
              style={parallax(0.25)}
            />
            <div
              className="absolute top-20 left-1/2 h-[34rem] w-[34rem] translate-x-[5%] rounded-full bg-finora-mint/25 blur-3xl"
              style={parallax(0.15)}
            />
            <div
              className="absolute top-[28rem] left-1/2 h-[30rem] w-[30rem] -translate-x-1/2 rounded-full bg-finora-cobalt/15 blur-3xl"
              style={parallax(0.08)}
            />
          </div>

          <div className="relative mx-auto flex max-w-5xl flex-col items-center text-center">
            <div data-reveal>
              <Eyebrow>{t('landing.hero.eyebrow')}</Eyebrow>
            </div>
            <h1
              className="mt-6 text-[40px] leading-[1.05] font-bold tracking-[-0.035em] text-balance sm:text-6xl lg:text-[80px]"
              data-reveal
              style={delay(80)}
            >
              {t('landing.hero.title1')}{' '}
              <span className="bg-gradient-to-r from-finora-cobalt via-finora-sky to-[#1fc9b0] bg-clip-text text-transparent">
                {t('landing.hero.title2')}
              </span>
            </h1>
            <p
              className="mt-6 max-w-2xl text-base leading-relaxed text-pretty text-muted-foreground sm:text-xl"
              data-reveal
              style={delay(160)}
            >
              {t('landing.hero.subtitle')}
            </p>
            <div
              className="mt-9 flex w-full flex-col items-center justify-center gap-3 sm:w-auto sm:flex-row"
              data-reveal
              style={delay(240)}
            >
              <Link to={startTo} className={cn(primaryBtn, 'w-full sm:w-auto')}>
                {startLabel}
                <ArrowRight className="size-4" />
              </Link>
              <a href="#how" className={cn(secondaryBtn, 'w-full sm:w-auto')}>
                {t('landing.hero.secondary')}
              </a>
            </div>
            <p
              className="mt-5 flex items-center gap-2 text-sm text-muted-foreground"
              data-reveal
              style={delay(300)}
            >
              <Users className="size-4 text-finora-sky" />
              {t('landing.hero.note')}
            </p>
          </div>

          {/* Product shot: tilted back, flattens as you scroll (Apple-style) */}
          <div className="relative mx-auto mt-14 max-w-6xl sm:mt-20" data-reveal style={delay(200)}>
            <div
              className="origin-top [perspective:1800px]"
              style={{
                transform:
                  'perspective(1800px) rotateX(calc(max(0deg, 14deg - var(--sy, 0) * 0.035deg)))',
              }}
            >
              <Shot src={shot('list')} alt={alt('list')} priority />
            </div>
            <GlassChip icon={Check} className="top-[18%] -left-10" style={parallax(-0.06)}>
              {t('landing.hero.chipBalanced')}
            </GlassChip>
            <GlassChip icon={Receipt} className="top-[52%] -right-12" style={parallax(-0.1)}>
              {t('landing.hero.chipVat')}
            </GlassChip>
            <GlassChip icon={FileBadge} className="bottom-[8%] -left-6" style={parallax(-0.14)}>
              {t('landing.hero.chipWht')}
            </GlassChip>
            {/* Phone, floating over the corner */}
            <div
              className="absolute -right-4 -bottom-16 hidden w-[200px] xl:block"
              style={parallax(-0.12)}
            >
              <div className="overflow-hidden rounded-[34px] bg-[#0b1220] p-2 shadow-overlay ring-1 ring-black/20">
                <img
                  src={shot('mobile')}
                  alt={alt('mobile')}
                  width={1170}
                  height={1992}
                  loading="lazy"
                  className="block w-full rounded-[26px]"
                />
              </div>
            </div>
          </div>
        </section>

        {/* ---------- Stats strip ---------- */}
        <section className="px-4 sm:px-6" aria-label={t('landing.nav.features')}>
          <div className="mx-auto grid max-w-6xl grid-cols-2 gap-3 lg:grid-cols-4">
            {stats.map((s, i) => (
              <div
                key={s.label}
                className="rounded-3xl bg-white/80 p-5 text-center shadow-card ring-1 ring-black/5 backdrop-blur sm:p-6"
                data-reveal
                style={delay(i * 70)}
              >
                <div className="bg-gradient-to-r from-finora-cobalt to-finora-sky bg-clip-text text-2xl font-bold tracking-tight text-transparent sm:text-3xl">
                  {s.value}
                </div>
                <div className="mt-1 text-sm text-muted-foreground">{s.label}</div>
              </div>
            ))}
          </div>
        </section>

        {/* ---------- Features (bento, glass) ---------- */}
        <section id="features" className="relative scroll-mt-24 px-4 py-24 sm:px-6 sm:py-32">
          <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
            <div
              className="absolute top-1/3 -left-40 h-[30rem] w-[30rem] rounded-full bg-finora-mint/20 blur-3xl"
              style={parallax(-0.05)}
            />
            <div
              className="absolute -right-40 bottom-0 h-[30rem] w-[30rem] rounded-full bg-finora-sky/20 blur-3xl"
              style={parallax(-0.08)}
            />
          </div>
          <div className="relative mx-auto max-w-6xl">
            <SectionHead
              eyebrow={t('landing.features.eyebrow')}
              title={t('landing.features.title')}
              subtitle={t('landing.features.subtitle')}
            />
            <div className="mt-14 grid gap-4 md:grid-cols-3">
              {features.map((f, i) => {
                const Icon = FEATURE_ICONS[i] ?? Sparkles
                const big = i === 0
                return (
                  <article
                    key={f.title}
                    className={cn(
                      'group flex flex-col gap-4 overflow-hidden rounded-[28px] bg-white/65 p-6 shadow-card ring-1 ring-white backdrop-blur-xl transition-all hover:-translate-y-1 hover:shadow-raised sm:p-7',
                      big && 'md:col-span-2 md:row-span-2',
                    )}
                    data-reveal
                    style={delay((i % 3) * 90)}
                  >
                    <span className="flex size-11 items-center justify-center rounded-2xl bg-gradient-to-br from-finora-sky to-finora-cobalt text-white shadow-[0_8px_20px_-8px_rgb(20_136_238/0.8)]">
                      <Icon className="size-5" />
                    </span>
                    <h3 className="text-xl font-semibold tracking-tight">{f.title}</h3>
                    <p className="leading-relaxed text-muted-foreground">{f.body}</p>
                    {big && (
                      <div className="mt-auto -mr-6 -mb-6 overflow-hidden rounded-tl-2xl ring-1 ring-black/5 sm:-mr-7 sm:-mb-7">
                        <img
                          src={shot('simulation')}
                          alt={alt('simulation')}
                          width={2160}
                          height={1350}
                          loading="lazy"
                          className="block w-full transition-transform duration-700 group-hover:scale-[1.02]"
                        />
                      </div>
                    )}
                  </article>
                )
              })}
            </div>
          </div>
        </section>

        {/* ---------- How it works (sticky product shot) ---------- */}
        <section id="how" className="scroll-mt-24 bg-white px-4 py-24 sm:px-6 sm:py-32">
          <div className="mx-auto max-w-6xl">
            <SectionHead eyebrow={t('landing.how.eyebrow')} title={t('landing.how.title')} />
            <div className="mt-12 grid gap-10 lg:mt-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16">
              <ol className="flex flex-col">
                {steps.map((s, i) => (
                  <li
                    key={s.title}
                    ref={(el) => {
                      refs.current[i] = el
                    }}
                    data-step={i}
                    className="flex flex-col justify-center gap-4 py-8 lg:min-h-[75vh] lg:py-0"
                  >
                    <div data-reveal className="flex flex-col gap-4">
                      <span
                        className={cn(
                          'flex size-11 items-center justify-center rounded-full text-base font-bold transition-colors duration-500',
                          active === i
                            ? 'bg-finora-cobalt text-white'
                            : 'bg-accent text-finora-cobalt',
                        )}
                      >
                        {i + 1}
                      </span>
                      <h3 className="text-2xl font-bold tracking-tight text-balance sm:text-3xl">
                        {s.title}
                      </h3>
                      <p className="text-lg leading-relaxed text-pretty text-muted-foreground">
                        {s.body}
                      </p>
                    </div>
                    {/* Phones / tablets: the image follows its step */}
                    <div className="lg:hidden" data-reveal>
                      <Shot src={shot(STEP_SHOTS[i])} alt={alt(STEP_SHOTS[i])} />
                    </div>
                  </li>
                ))}
              </ol>
              {/* Desktop: the product stays on screen while the steps scroll past */}
              <div className="hidden lg:block">
                <div className="sticky top-[calc(50vh-15rem)]">
                  <div className="relative">
                    <div
                      aria-hidden
                      className="absolute -inset-10 -z-10 rounded-full bg-gradient-to-br from-finora-sky/25 via-finora-mint/20 to-transparent blur-3xl"
                    />
                    <div className="grid">
                      {STEP_SHOTS.map((name, i) => (
                        <div
                          key={name}
                          className={cn(
                            'col-start-1 row-start-1 transition-all duration-700 ease-out',
                            active === i
                              ? 'translate-y-0 scale-100 opacity-100'
                              : 'pointer-events-none translate-y-4 scale-[0.98] opacity-0',
                          )}
                          aria-hidden={active !== i}
                        >
                          <Shot src={shot(name)} alt={alt(name)} />
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="mt-6 flex justify-center gap-2" aria-hidden>
                    {STEP_SHOTS.map((n, i) => (
                      <span
                        key={n}
                        className={cn(
                          'h-1.5 rounded-full transition-all duration-500',
                          active === i ? 'w-8 bg-finora-cobalt' : 'w-1.5 bg-border',
                        )}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ---------- Accuracy (dark, glass) ---------- */}
        <section
          id="trust"
          className="relative scroll-mt-24 overflow-hidden bg-finora-obsidian px-4 py-24 text-white sm:px-6 sm:py-32"
        >
          <div aria-hidden className="pointer-events-none absolute inset-0">
            <div
              className="absolute -top-32 left-1/4 h-[28rem] w-[28rem] rounded-full bg-finora-mint/20 blur-3xl"
              style={parallax(-0.05)}
            />
            <div
              className="absolute right-0 -bottom-40 h-[32rem] w-[32rem] rounded-full bg-finora-sky/25 blur-3xl"
              style={parallax(-0.03)}
            />
            <div className="absolute inset-0 bg-[linear-gradient(rgb(255_255_255/0.04)_1px,transparent_1px),linear-gradient(90deg,rgb(255_255_255/0.04)_1px,transparent_1px)] [mask-image:radial-gradient(ellipse_at_center,black,transparent_70%)] bg-[size:48px_48px]" />
          </div>
          <div className="relative mx-auto max-w-6xl">
            <SectionHead
              dark
              eyebrow={t('landing.trust.eyebrow')}
              title={t('landing.trust.title')}
              subtitle={t('landing.trust.subtitle')}
            />
            <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {trust.map((item, i) => {
                const Icon = TRUST_ICONS[i] ?? ShieldCheck
                return (
                  <article
                    key={item.title}
                    className="flex flex-col gap-3 rounded-[24px] bg-white/[0.06] p-6 ring-1 ring-white/10 backdrop-blur-xl transition-colors hover:bg-white/[0.09]"
                    data-reveal
                    style={delay(i * 80)}
                  >
                    <Icon className="size-6 text-finora-mint" />
                    <h3 className="text-lg font-semibold">{item.title}</h3>
                    <p className="text-sm leading-relaxed text-white/70">{item.body}</p>
                  </article>
                )
              })}
            </div>
          </div>
        </section>

        {/* ---------- Comparison ---------- */}
        <section id="compare" className="scroll-mt-24 px-4 py-24 sm:px-6 sm:py-32">
          <div className="mx-auto max-w-4xl">
            <SectionHead
              eyebrow={t('landing.compare.eyebrow')}
              title={t('landing.compare.title')}
            />
            <div
              className="mt-12 overflow-hidden rounded-[28px] bg-white shadow-raised ring-1 ring-black/5"
              data-reveal
            >
              <table className="w-full text-left text-sm sm:text-base">
                <thead>
                  <tr>
                    <th className="w-1/2 px-4 py-5 sm:px-7" />
                    <th className="px-2 py-5 text-center text-xs font-semibold text-muted-foreground sm:text-sm">
                      {t('landing.compare.manual')}
                    </th>
                    <th className="bg-accent px-2 py-5 text-center">
                      <span className="inline-flex items-center gap-1.5 text-sm font-bold text-finora-cobalt sm:text-base">
                        <BrandMark className="size-5" />
                        {t('landing.compare.finora')}
                      </span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.label} className="border-t border-border/70">
                      <td className="px-4 py-4 font-medium sm:px-7">{r.label}</td>
                      <td className="px-2 py-4 text-center">
                        {r.manual === 'partial' ? (
                          <span
                            className="inline-flex items-center gap-1 text-xs text-warning-foreground"
                            title={t('landing.compare.partial')}
                          >
                            <Minus className="size-4" />
                            <span className="hidden sm:inline">{t('landing.compare.partial')}</span>
                          </span>
                        ) : (
                          <X className="mx-auto size-5 text-muted-foreground/60" aria-label="—" />
                        )}
                      </td>
                      <td className="bg-accent/60 px-2 py-4 text-center">
                        <span className="mx-auto flex size-7 items-center justify-center rounded-full bg-success/15">
                          <Check className="size-4 text-success-foreground" aria-label="✓" />
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* ---------- Roadmap ---------- */}
        <section id="roadmap" className="scroll-mt-24 px-4 pb-24 sm:px-6 sm:pb-32">
          <div className="mx-auto max-w-5xl">
            <SectionHead
              eyebrow={t('landing.roadmap.eyebrow')}
              title={t('landing.roadmap.title')}
            />
            <ul className="mt-10 flex flex-wrap justify-center gap-2.5">
              {roadmap.map((r, i) => (
                <li
                  key={r}
                  className="inline-flex items-center gap-2 rounded-full bg-white/80 px-4 py-2 text-sm font-medium shadow-card ring-1 ring-black/5 backdrop-blur"
                  data-reveal
                  style={delay(i * 40)}
                >
                  {r}
                  <span className="rounded-full bg-finora-mint/20 px-2 py-0.5 text-[11px] font-semibold text-[#08796a]">
                    {t('landing.roadmap.soon')}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ---------- Final CTA ---------- */}
        <section className="px-4 pb-20 sm:px-6">
          <div
            className="relative mx-auto max-w-6xl overflow-hidden rounded-[36px] bg-gradient-to-br from-finora-cobalt via-[#0b5fd0] to-finora-sky px-6 py-16 text-center text-white shadow-overlay sm:px-12 sm:py-24"
            data-reveal
          >
            <div
              aria-hidden
              className="absolute -top-24 -right-24 h-80 w-80 rounded-full bg-finora-mint/40 blur-3xl"
              style={parallax(-0.06)}
            />
            <div
              aria-hidden
              className="absolute -bottom-32 -left-20 h-80 w-80 rounded-full bg-white/20 blur-3xl"
            />
            <div className="relative mx-auto flex max-w-2xl flex-col items-center gap-5">
              <BrandMark className="size-14 rounded-2xl bg-white p-2 shadow-raised" />
              <h2 className="text-[32px] leading-tight font-bold tracking-[-0.025em] text-balance sm:text-5xl">
                {t('landing.cta.title')}
              </h2>
              <p className="text-lg text-pretty text-white/80">{t('landing.cta.subtitle')}</p>
              <div className="mt-3 flex w-full flex-col justify-center gap-3 sm:w-auto sm:flex-row">
                <Link
                  to={startTo}
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-white px-7 text-[15px] font-semibold text-finora-cobalt shadow-raised transition-transform hover:-translate-y-0.5"
                >
                  {startLabel}
                  <ArrowRight className="size-4" />
                </Link>
                {!session && (
                  <Link
                    to="/login"
                    className="inline-flex h-12 items-center justify-center rounded-full bg-white/10 px-7 text-[15px] font-semibold text-white ring-1 ring-white/30 backdrop-blur transition-colors hover:bg-white/20"
                  >
                    {t('landing.cta.secondary')}
                  </Link>
                )}
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* ---------- Footer ---------- */}
      <footer className="border-t border-border/70 bg-white px-4 py-10 pb-[calc(2.5rem+env(safe-area-inset-bottom))] sm:px-6">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 sm:flex-row">
          <div className="flex flex-col items-center gap-1.5 sm:items-start">
            <BrandLogo className="text-base" markClassName="size-6" />
            <span className="text-sm text-muted-foreground">{t('landing.footer.tagline')}</span>
          </div>
          <div className="flex items-center gap-4">
            <LanguageSwitcher />
            <span className="text-sm text-muted-foreground">{t('landing.footer.rights')}</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
