import { Link, NavLink, useNavigate } from 'react-router-dom'

export default function Layout({ children }) {
  const navigate = useNavigate()

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div>
          <Link to="/" className="logo">
            <span className="logo-badge">SB</span>
            <div>
              <strong>Speed PDV</strong>
              <small>Complemento do Goomer</small>
            </div>
          </Link>
          <nav className="nav-list">
            <NavLink to="/pdv">PDV</NavLink>
            <NavLink to="/pendentes">Pendentes</NavLink>
            <NavLink to="/admin">Admin</NavLink>
            <NavLink to="/relatorios">Relatórios</NavLink>
          </nav>
        </div>
        <button className="secondary-btn" onClick={() => navigate('/login')}>
          Trocar usuário
        </button>
      </aside>
      <main className="content">{children}</main>
    </div>
  )
}
