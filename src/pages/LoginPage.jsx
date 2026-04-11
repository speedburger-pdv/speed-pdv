import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { deveMostrarDicaLogin, esconderDicaLogin, obterLoginLembrado, salvarSessao } from '../lib/auth'
import { autenticarUsuarioApi } from '../lib/api'

export default function LoginPage() {
  const navigate = useNavigate()
  const [login, setLogin] = useState(obterLoginLembrado())
  const [senha, setSenha] = useState('')
  const [lembrar, setLembrar] = useState(true)
  const [erro, setErro] = useState('')
  const [mostrarSenha, setMostrarSenha] = useState(false)
  const [mostrarDica, setMostrarDica] = useState(deveMostrarDicaLogin())

  async function entrar(e) {
    e.preventDefault()
    setErro('')
    const resposta = await autenticarUsuarioApi(login.trim(), senha)
    if (!resposta.ok) {
      setErro(resposta.erro)
      return
    }
    salvarSessao(resposta.usuario, lembrar)
    esconderDicaLogin()
    navigate('/pdv', { replace: true })
  }

  return (
    <div className="auth-page">
      <form className="auth-card" onSubmit={entrar}>
        <div className="brand-center">
          <img src="/logo-speedburger.png" alt="Logo Speed Burger" className="login-logo" />
          <h1>Speed PDV</h1>
          <p>
            Sistema de caixa para registrar entradas, saídas, pagamentos de mesas,
            balcão, retiradas e entregas no local.
          </p>
        </div>

        {mostrarDica && (
          <div className="info-box">
            <strong>Primeiro acesso</strong>
            <span>Use o administrador padrão apenas no primeiro login.</span>
            <span>Depois altere a senha na área Admin.</span>
            <button type="button" className="ghost-btn compact-btn" onClick={() => { setMostrarDica(false); esconderDicaLogin() }}>
              Ocultar dica
            </button>
          </div>
        )}

        <div className="panel compact-panel stack gap-sm" style={{ marginBottom: 10 }}>
          <strong>🛵 Portal do motoca</strong>
          <small className="muted">Acesso rápido para o motoca cadastrar, entrar e enviar a prestação de contas do dia.</small>
          <Link to="/portal-motoca" className="primary-btn compact-btn" style={{ display: 'inline-flex', justifyContent: 'center' }}>Abrir portal do motoca</Link>
        </div>

        <label>
          Usuário
          <input value={login} onChange={(e) => setLogin(e.target.value)} placeholder="Ex.: admin ou joao" required />
        </label>

        <label>
          Senha
          <div className="password-field">
            <input type={mostrarSenha ? 'text' : 'password'} value={senha} onChange={(e) => setSenha(e.target.value)} placeholder="Digite a senha" required />
            <button type="button" className="ghost-btn compact-btn" onClick={() => setMostrarSenha((v) => !v)}>
              {mostrarSenha ? 'Ocultar' : 'Mostrar'}
            </button>
          </div>
        </label>

        <label className="check-row">
          <input type="checkbox" checked={lembrar} onChange={(e) => setLembrar(e.target.checked)} />
          <span>Lembrar apenas o usuário neste navegador</span>
        </label>

        {erro && <div className="alert error">{erro}</div>}

        <button className="primary-btn btn-lg">Entrar</button>
      </form>
    </div>
  )
}
