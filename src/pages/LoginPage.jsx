import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { hasSupabase, supabase } from '../lib/supabase'

export default function LoginPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState('')
  const [carregando, setCarregando] = useState(false)

  async function entrar(e) {
    e.preventDefault()
    setErro('')

    if (!hasSupabase) {
      localStorage.setItem('usuario_mock', JSON.stringify({ email, tipo: email.includes('admin') ? 'admin' : 'operador' }))
      navigate('/pdv')
      return
    }

    setCarregando(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password: senha })
    setCarregando(false)

    if (error) {
      setErro(error.message)
      return
    }

    navigate('/pdv')
  }

  return (
    <div className="auth-page">
      <form className="auth-card" onSubmit={entrar}>
        <div className="brand-center">
          <div className="logo-badge big">SB</div>
          <h1>Speed PDV</h1>
          <p>PDV para complementar o Goomer com foco em caixa, retirada e fechamento.</p>
        </div>
        <label>
          E-mail
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label>
          Senha
          <input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} required={!(!hasSupabase)} />
        </label>
        {erro && <div className="alert error">{erro}</div>}
        {!hasSupabase && <div className="alert">Modo demonstração ativo. Configure o .env para usar o Supabase real.</div>}
        <button className="primary-btn" disabled={carregando}>{carregando ? 'Entrando...' : 'Entrar'}</button>
      </form>
    </div>
  )
}
