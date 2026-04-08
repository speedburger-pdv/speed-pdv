import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import Layout from './components/Layout'
import LoginPage from './pages/LoginPage'
import PdvPage from './pages/PdvPage'
import PendentesPage from './pages/PendentesPage'
import AdminPage from './pages/AdminPage'
import RelatoriosPage from './pages/RelatoriosPage'

function AppRoutes() {
  const location = useLocation()
  const isLogin = location.pathname === '/login'

  if (isLogin) {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    )
  }

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Navigate to="/pdv" replace />} />
        <Route path="/pdv" element={<PdvPage />} />
        <Route path="/pendentes" element={<PendentesPage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/relatorios" element={<RelatoriosPage />} />
        <Route path="*" element={<Navigate to="/pdv" replace />} />
      </Routes>
    </Layout>
  )
}

export default function App() {
  return <AppRoutes />
}
