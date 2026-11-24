import { Route, Routes } from 'react-router-dom'
import { AppLayout } from '@/components/layout/AppLayout'
import { NAV_ITEMS } from '@/components/layout/nav-items'
import { ComingSoonPage } from '@/pages/ComingSoonPage'
import { HelloPage } from '@/pages/HelloPage'

export default function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<HelloPage />} />
        {NAV_ITEMS.filter((i) => i.to !== '/').map((i) => (
          <Route key={i.to} path={i.to} element={<ComingSoonPage titleKey={i.labelKey} />} />
        ))}
      </Route>
    </Routes>
  )
}
