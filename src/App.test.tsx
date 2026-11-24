import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import App from './App'
import i18n from './i18n'

function renderApp(path = '/') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  )
}

describe('App shell', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('th')
  })

  it('renders the Hello page in Thai by default', () => {
    renderApp()
    expect(screen.getByText('สวัสดี 👋')).toBeInTheDocument()
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
