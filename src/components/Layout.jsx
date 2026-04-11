import { useEffect, useMemo, useState } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { listarPendentesApi, obterCaixaAbertoApi } from '../lib/api'
import { hasSupabase } from '../lib/supabase'
import { limparSessao, obterSessao, podeAcessarGestao, saudacaoEspecialAdmin, tipoUsuarioLabel } from '../lib/auth'

function LinkInterno({ to, children, className = '', onNavigateCheck }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) => `${isActive ? 'active ' : ''}${className}`.trim()}
      onClick={(e) => {
        if (onNavigateCheck && !onNavigateCheck(to)) {
          e.preventDefault()
        }
      }}
    >
      {children}
    </NavLink>
  )
}

export default function Layout({ children }) {
  const navigate = useNavigate()
  const location = useLocation()
  const usuario = obterSessao()
  const podeGestao = podeAcessarGestao(usuario)
  const isAdmin = usuario?.tipo === 'admin'
  const [pendentesQtd, setPendentesQtd] = useState(0)
  const [caixaAberto, setCaixaAberto] = useState(false)

  const perfilLabel = useMemo(() => tipoUsuarioLabel(usuario?.tipo), [usuario?.tipo])
  const saudacaoAdmin = useMemo(() => saudacaoEspecialAdmin(usuario), [usuario])

  useEffect(() => {
    async function carregarStatus() {
      if (!usuario) return
      try {
        const [pendentes, caixa] = await Promise.all([
          listarPendentesApi(),
          obterCaixaAbertoApi(usuario),
        ])
        setPendentesQtd((pendentes || []).length)
        setCaixaAberto(Boolean(caixa))
      } catch {
        setPendentesQtd(0)
        setCaixaAberto(false)
      }
    }
    carregarStatus()
    window.addEventListener('speedpdv:status-change', carregarStatus)
    return () => window.removeEventListener('speedpdv:status-change', carregarStatus)
  }, [location.pathname, usuario?.id])

  function confirmarSaidaTela(destino) {
    if (destino === location.pathname) return true
    const temRascunho = sessionStorage.getItem('speedpdv_pedido_em_edicao') === 'true'
    if (!temRascunho) return true
    return window.confirm('Existe um pedido em edição. Deseja sair desta tela mesmo assim?')
  }

  function sairSistema() {
    if (caixaAberto) {
      window.alert('Feche o caixa antes de sair ou trocar de usuário.')
      navigate('/pdv')
      return
    }
    limparSessao()
    sessionStorage.removeItem('speedpdv_pedido_em_edicao')
    navigate('/login', { replace: true })
  }

  return (
    <div className="app-shell compact-shell">
      <aside className="sidebar compact-sidebar">
        <div>
          <div className="logo logo-with-image">
            <img src="/logo-speedburger.png" alt="Logo Speed Burger" className="logo-image" />
            <div>
              <strong>Speed PDV</strong>
              <small>Complemento financeiro do Goomer</small>
            </div>
          </div>
          <div className={`user-chip ${isAdmin ? 'admin-chip' : ''}`}>
            <div className={hasSupabase ? 'badge success' : 'badge warning'}>{hasSupabase ? 'Supabase conectado' : 'Modo local (sem .env)'}</div>
            <span>Usuário atual</span>
            <strong>{usuario?.nome || usuario?.usuario || 'Sem sessão'}</strong>
            <small>{perfilLabel}</small>
            {saudacaoAdmin && <small className="text-warning">{saudacaoAdmin}</small>}
            <small className={caixaAberto ? 'text-success' : 'text-warning'}>{caixaAberto ? 'Caixa aberto' : 'Caixa fechado'}</small>
          </div>
          <nav className="nav-list">
            <LinkInterno to="/pdv" onNavigateCheck={confirmarSaidaTela}>🧾 PDV</LinkInterno>
            <LinkInterno to="/pendentes" className={pendentesQtd ? 'nav-danger filled blink' : ''} onNavigateCheck={confirmarSaidaTela}>
              💸 Pagamento pendente {pendentesQtd ? <span className="nav-count">{pendentesQtd}</span> : null}
            </LinkInterno>
            {podeGestao && <LinkInterno to="/admin" onNavigateCheck={confirmarSaidaTela}>⚙️ Gestão</LinkInterno>}
            {podeGestao && <LinkInterno to="/motocas" onNavigateCheck={confirmarSaidaTela}>🏍️ Motocas</LinkInterno>}
            {podeGestao && <LinkInterno to="/relatorios" onNavigateCheck={confirmarSaidaTela}>📊 Relatórios</LinkInterno>}
          </nav>
        </div>
        <div className="stack gap-sm">
          <button className="danger-btn compact-btn" onClick={sairSistema}>⏻ Sair</button>
          <button className="secondary-btn compact-btn" onClick={sairSistema}>⇄ Trocar usuário</button>
        </div>
      </aside>
      <main className="content compact-content">{children}</main>
    </div>
  )
}
