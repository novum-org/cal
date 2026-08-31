import { Navigate, Route, Routes } from 'react-router'

import { AllocationPage } from './pages/AllocationPage.tsx'
import { ClosePage } from './pages/ClosePage.tsx'
import { HomePage } from './pages/HomePage.tsx'
import { LoginPage } from './pages/LoginPage.tsx'
import { MonthPage } from './pages/MonthPage.tsx'
import { PolicyPage } from './pages/PolicyPage.tsx'
import { SessionLayout } from './pages/SessionLayout.tsx'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<HomePage />} />
      <Route path="/s/:id" element={<SessionLayout />}>
        <Route index element={<MonthPage />} />
        <Route path="politica" element={<PolicyPage />} />
        <Route path="reparto" element={<AllocationPage />} />
        <Route path="cierre" element={<ClosePage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
