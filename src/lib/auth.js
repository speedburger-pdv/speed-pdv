import { agora } from './utils'

const CHAVE_USUARIOS = 'speedpdv_usuarios'
const CHAVE_LOGIN_LEMBRADO = 'speedpdv_login_lembrado'
const CHAVE_MOSTRAR_DICA_LOGIN = 'speedpdv_mostrar_dica_login'

export const TIPOS_USUARIO = {
  ADMIN: 'admin',
  GERENTE: 'gerente',
  SUPERVISOR: 'supervisor',
  OPERADOR: 'operador',
}

export const NOME_TIPO_USUARIO = {
  [TIPOS_USUARIO.ADMIN]: 'Administrador',
  [TIPOS_USUARIO.GERENTE]: 'Gerente',
  [TIPOS_USUARIO.SUPERVISOR]: 'Supervisor',
  [TIPOS_USUARIO.OPERADOR]: 'Operador',
}

const usuarioAdminPadrao = {
  id: 'admin-principal',
  nome: 'Administrador',
  usuario: 'admin',
  senha: 'kevin2236',
  tipo: TIPOS_USUARIO.ADMIN,
  ativo: true,
  created_at: agora(),
}

function tipoDe(usuarioOuTipo) {
  return typeof usuarioOuTipo === 'string' ? usuarioOuTipo : usuarioOuTipo?.tipo
}

function existeOutroAdmin(usuarios = [], idIgnorar = null) {
  return usuarios.some((item) => item.id !== idIgnorar && item.tipo === TIPOS_USUARIO.ADMIN)
}

export function tipoUsuarioLabel(tipo) {
  return NOME_TIPO_USUARIO[tipo] || 'Usuário'
}

export function tiposCadastraveisPor(usuarioOuTipo) {
  const tipo = tipoDe(usuarioOuTipo)
  if (tipo === TIPOS_USUARIO.ADMIN) return [TIPOS_USUARIO.GERENTE, TIPOS_USUARIO.SUPERVISOR, TIPOS_USUARIO.OPERADOR]
  if (tipo === TIPOS_USUARIO.GERENTE) return [TIPOS_USUARIO.SUPERVISOR, TIPOS_USUARIO.OPERADOR]
  return []
}

export function podeCadastrarTipo(usuarioOuTipo, tipoAlvo) {
  return tiposCadastraveisPor(usuarioOuTipo).includes(tipoAlvo)
}

export function podeGerenciarUsuarios(usuarioOuTipo) {
  return tiposCadastraveisPor(usuarioOuTipo).length > 0
}

export function podeAcessarGestao(usuarioOuTipo) {
  const tipo = tipoDe(usuarioOuTipo)
  return [TIPOS_USUARIO.ADMIN, TIPOS_USUARIO.GERENTE, TIPOS_USUARIO.SUPERVISOR].includes(tipo)
}

export function podeAbrirFecharCaixa(usuarioOuTipo) {
  return podeAcessarGestao(usuarioOuTipo)
}

export function saudacaoEspecialAdmin(usuario) {
  if (tipoDe(usuario) !== TIPOS_USUARIO.ADMIN) return ''
  const nome = usuario?.nome || usuario?.usuario || 'Administrador'
  return `Bem-vindo, ${nome} — o patrão, o foda master da SB 😄`
}

export function garantirUsuariosIniciais() {
  const atual = carregarUsuarios()
  if (atual.length) return atual
  salvarUsuarios([usuarioAdminPadrao])
  if (!localStorage.getItem(CHAVE_MOSTRAR_DICA_LOGIN)) {
    localStorage.setItem(CHAVE_MOSTRAR_DICA_LOGIN, 'true')
  }
  return [usuarioAdminPadrao]
}

export function carregarUsuarios() {
  const bruto = localStorage.getItem(CHAVE_USUARIOS)
  return bruto ? JSON.parse(bruto) : []
}

export function salvarUsuarios(usuarios) {
  localStorage.setItem(CHAVE_USUARIOS, JSON.stringify(usuarios))
}

export function criarOperador(dados) {
  const usuarios = garantirUsuariosIniciais()
  const tipo = dados.tipo || TIPOS_USUARIO.OPERADOR
  const existe = usuarios.some((item) => item.usuario === dados.usuario)
  if (existe) {
    return { ok: false, erro: 'Já existe um usuário com esse login.' }
  }
  if (tipo === TIPOS_USUARIO.ADMIN && existeOutroAdmin(usuarios)) {
    return { ok: false, erro: 'Já existe um administrador cadastrado no sistema.' }
  }
  const novo = {
    id: `user-${Date.now()}`,
    nome: dados.nome,
    usuario: dados.usuario,
    senha: dados.senha,
    tipo,
    ativo: true,
    created_at: agora(),
  }
  salvarUsuarios([...usuarios, novo])
  return { ok: true, usuario: novo }
}

export function atualizarUsuario(id, atualizacoes) {
  const usuariosAtuais = garantirUsuariosIniciais()
  if (atualizacoes?.tipo === TIPOS_USUARIO.ADMIN && existeOutroAdmin(usuariosAtuais, id)) return null
  const usuarios = usuariosAtuais.map((item) => (item.id === id ? { ...item, ...atualizacoes } : item))
  salvarUsuarios(usuarios)
  return usuarios.find((item) => item.id === id)
}

export function autenticarUsuario(login, senha) {
  const usuarios = garantirUsuariosIniciais()
  const usuario = usuarios.find((item) => item.usuario === login && item.senha === senha && item.ativo !== false)
  if (!usuario) return { ok: false, erro: 'Usuário ou senha inválidos.' }
  return { ok: true, usuario }
}

export function salvarSessao(usuario, lembrar) {
  sessionStorage.setItem('speedpdv_sessao', JSON.stringify(usuario))
  if (lembrar) {
    localStorage.setItem(CHAVE_LOGIN_LEMBRADO, usuario.usuario)
  } else {
    localStorage.removeItem(CHAVE_LOGIN_LEMBRADO)
  }
}

export function obterSessao() {
  const bruto = sessionStorage.getItem('speedpdv_sessao')
  return bruto ? JSON.parse(bruto) : null
}

export function limparSessao() {
  sessionStorage.removeItem('speedpdv_sessao')
}

export function obterLoginLembrado() {
  return localStorage.getItem(CHAVE_LOGIN_LEMBRADO) || ''
}

export function deveMostrarDicaLogin() {
  return localStorage.getItem(CHAVE_MOSTRAR_DICA_LOGIN) === 'true'
}

export function esconderDicaLogin() {
  localStorage.setItem(CHAVE_MOSTRAR_DICA_LOGIN, 'false')
}

export function excluirUsuario(id) {
  const usuarios = carregarUsuarios().filter((item) => item.id !== id || item.tipo === TIPOS_USUARIO.ADMIN)
  salvarUsuarios(usuarios)
  return { ok: true }
}
