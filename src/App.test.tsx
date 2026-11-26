import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import App from './App'
import type { MyCompany } from './features/company/CompanyProvider'
import i18n from './i18n'

const auth = vi.hoisted(() => ({ session: null as unknown, loading: false }))
const company = vi.hoisted(() => ({
  companies: [] as MyCompany[],
  current: null as MyCompany | null,
  isLoading: false,
  switchCompany: () => {},
}))

vi.mock('./features/auth/AuthProvider', () => ({ useAuth: () => auth }))
vi.mock('./features/company/CompanyProvider', async (orig) => ({
  ...(await orig<object>()),
  useCompany: () => company,
}))
// Keep network out of unit tests
vi.mock('./lib/supabase', () => ({
  supabase: { rpc: async () => ({ data: [], error: null }), auth: { signOut: async () => {} } },
  isSupabaseConfigured: true,
}))

const ACME: MyCompany = {
  id: 'c1',
  name: 'ACME จำกัด',
  vat_registered: true,
  vat_rate: 7,
  date_era: 'BE',
  logo_path: null,
  tax_id: null,
  locked_through: null,
  fiscal_year_start_month: 1,
  role: 'owner',
}

function renderApp(path = '/') {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={[path]}>
        <App />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('App routing', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('th')
    auth.session = { user: { id: 'u1', email: 'a@test.com' } }
    company.companies = [ACME]
    company.current = ACME
  })

  it('sends signed-out users to the login page', () => {
    auth.session = null
    renderApp('/sales')
    expect(screen.getByRole('button', { name: 'เข้าสู่ระบบ' })).toBeInTheDocument()
  })

  it('shows the product page to signed-out visitors of the home page', async () => {
    auth.session = null
    renderApp('/')
    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent('แล้วบัญชีลงให้เอง')
    expect(screen.getAllByRole('link', { name: /เริ่มใช้งาน/ })[0]).toHaveAttribute(
      'href',
      '/login?mode=signUp',
    )
  })

  it('sends users without a company to onboarding', () => {
    company.companies = []
    company.current = null
    renderApp('/')
    expect(
      screen.getByText('สร้างบริษัท', { selector: '[data-slot="card-title"]' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /ธุรกิจบริการ/ })).toBeInTheDocument()
  })

  it('shows the dashboard with the current company', async () => {
    renderApp('/')
    expect(await screen.findByText('สวัสดี 👋')).toBeInTheDocument()
    expect(screen.getByText(/กำลังทำงานใน ACME จำกัด/)).toBeInTheDocument()
  })

  it('switches language to English', async () => {
    renderApp()
    await screen.findByText('สวัสดี 👋')
    await userEvent.click(screen.getAllByRole('button', { name: 'EN' })[0])
    expect(await screen.findByText('Hello 👋')).toBeInTheDocument()
  })

  it('lists unbuilt functions greyed out with their milestone, built ones as links', async () => {
    renderApp('/')
    await screen.findByText('สวัสดี 👋')
    const reports = screen.getByRole('button', { name: 'รายงาน' })
    expect(reports).toHaveAttribute('aria-expanded', 'false')
    await userEvent.click(reports)
    expect(reports).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('link', { name: 'งบทดลอง' })).toHaveAttribute(
      'href',
      '/reports/trial-balance',
    )
    await userEvent.click(screen.getByRole('button', { name: 'บัญชี' }))
    expect(screen.getByRole('link', { name: 'สมุดรายวันทั่วไป' })).toHaveAttribute(
      'href',
      '/accounting/journal',
    )
  })
})
