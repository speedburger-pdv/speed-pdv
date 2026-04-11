import { Navigate, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import LoginPage from './pages/LoginPage'
import PdvPage from './pages/PdvPage'
import PendentesPage from './pages/PendentesPage'
import AdminPage from './pages/AdminPage'
import RelatoriosPage from './pages/RelatoriosPage'
import MotocasPage from './pages/MotocasPage'
import MotoboyPortalPage from './pages/MotoboyPortalPage'
import { garantirUsuariosIniciais, obterSessao, podeAcessarGestao } from './lib/auth'
import { garantirBaseInicial } from './lib/storage'

garantirUsuariosIniciais()
garantirBaseInicial()

function RotaProtegida({ children, requireGestao = false }) {
  const usuario = obterSessao()
  if (!usuario) return <Navigate to="/login" replace />
  if (requireGestao && !podeAcessarGestao(usuario)) return <Navigate to="/pdv" replace />
  return children
}

function AppInterno() {
  return (
    <Layout>
      <Routes>
        <Route path="/pdv" element={<PdvPage />} />
        <Route path="/pendentes" element={<PendentesPage />} />
        <Route path="/admin" element={<RotaProtegida requireGestao><AdminPage /></RotaProtegida>} />
        <Route path="/relatorios" element={<RotaProtegida requireGestao><RelatoriosPage /></RotaProtegida>} />
        <Route path="/motocas" element={<RotaProtegida requireGestao><MotocasPage /></RotaProtegida>} />
        <Route path="*" element={<Navigate to="/pdv" replace />} />
      </Routes>
    </Layout>
  )
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/portal-motoca" element={<MotoboyPortalPage />} />
      <Route path="/motoboy-portal" element={<Navigate to="/portal-motoca" replace />} />
      <Route path="/*" element={<RotaProtegida><AppInterno /></RotaProtegida>} />
    </Routes>
  )
}
