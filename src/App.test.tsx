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
    renderApp('/reports')
    expect(screen.getByRole('button', { name: 'เข้าสู่ระบบ' })).toBeInTheDocument()
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

  it('shows the dashboard with the current company', () => {
    renderApp('/')
    expect(screen.getByText('สวัสดี 👋')).toBeInTheDocument()
    expect(screen.getByText(/กำลังทำงานใน ACME จำกัด/)).toBeInTheDocument()
  })

  it('switches language to English', async () => {
    renderApp()
    await userEvent.click(screen.getAllByRole('button', { name: 'EN' })[0])
    expect(screen.getByText('Hello 👋')).toBeInTheDocument()
  })

  it('renders placeholder pages for nav routes', () => {
    renderApp('/reports')
    expect(screen.getByRole('heading', { name: 'รายงาน' })).toBeInTheDocument()
  })
})
