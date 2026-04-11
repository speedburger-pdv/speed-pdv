import { menuBase } from './menuBase'
import { agora, normalizarTexto } from './utils'

const CHAVES = {
  produtos: 'speedpdv_produtos',
  pedidos: 'speedpdv_pedidos',
  movimentacoes: 'speedpdv_movimentacoes',
  caixas: 'speedpdv_caixas',
  config: 'speedpdv_config',
  motoboysFechamento: 'speedpdv_motoboys_fechamento',
  motocasConfig: 'speedpdv_motocas_config',
  motoboys: 'speedpdv_motoboys',
  portalPrestacoes: 'speedpdv_motocas_portal_prestacoes',
}

const configPadrao = {
  valor_entrega_motoca: 7,
  alerta_sangria: 400,
  mesas_ativas: ['2', '3', '4', '5', '6', '7', '8', '9'],
}

const motocasConfigPadrao = {
  quantidade_motoboys: 4,
  valor_entrega_normal: 7,
  valor_entrega_distante: 10,
}

function ler(chave, fallback) {
  const bruto = localStorage.getItem(chave)
  return bruto ? JSON.parse(bruto) : fallback
}

function gravar(chave, valor) {
  localStorage.setItem(chave, JSON.stringify(valor))
}

function gerarId(prefixo) {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `${prefixo}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

function mesmaData(a, b = new Date()) {
  const dataA = new Date(a)
  const dataB = new Date(b)
  if (Number.isNaN(dataA.getTime()) || Number.isNaN(dataB.getTime())) return false
  return dataA.getFullYear() === dataB.getFullYear()
    && dataA.getMonth() === dataB.getMonth()
    && dataA.getDate() === dataB.getDate()
}

export function garantirBaseInicial() {
  const produtos = ler(CHAVES.produtos, null)
  if (!produtos || !produtos.length) gravar(CHAVES.produtos, menuBase)
  const config = ler(CHAVES.config, null)
  if (!config) gravar(CHAVES.config, configPadrao)
  const motocasConfig = ler(CHAVES.motocasConfig, null)
  if (!motocasConfig) gravar(CHAVES.motocasConfig, motocasConfigPadrao)
  if (!ler(CHAVES.pedidos, null)) gravar(CHAVES.pedidos, [])
  if (!ler(CHAVES.movimentacoes, null)) gravar(CHAVES.movimentacoes, [])
  if (!ler(CHAVES.caixas, null)) gravar(CHAVES.caixas, [])
  if (!ler(CHAVES.motoboysFechamento, null)) gravar(CHAVES.motoboysFechamento, [])
  if (!ler(CHAVES.motoboys, null)) gravar(CHAVES.motoboys, [])
  if (!ler(CHAVES.portalPrestacoes, null)) gravar(CHAVES.portalPrestacoes, [])
}

export function carregarProdutos() {
  garantirBaseInicial()
  return ler(CHAVES.produtos, [])
}

export function salvarProduto(produto) {
  const produtos = carregarProdutos()
  const novo = { ...produto, id: produto.id || `prod-${Date.now()}`, created_at: produto.created_at || agora() }
  const indice = produtos.findIndex((item) => item.id === novo.id)
  if (indice >= 0) produtos[indice] = novo
  else produtos.push(novo)
  gravar(CHAVES.produtos, produtos)
  return novo
}

export function alternarProduto(id) {
  const produtos = carregarProdutos().map((item) => (item.id === id ? { ...item, ativo: !item.ativo } : item))
  gravar(CHAVES.produtos, produtos)
  return produtos
}



export function importarProdutosBase() {
  const produtosAtuais = carregarProdutos()
  const mapaAtual = new Map(produtosAtuais.map((item) => [normalizarTexto(item.nome || ''), item]))
  let adicionados = 0
  let atualizados = 0

  const mesclados = [...produtosAtuais]

  menuBase.forEach((base) => {
    const chave = normalizarTexto(base.nome || '')
    const existente = mapaAtual.get(chave)
    if (!existente) {
      mesclados.push({ ...base, created_at: base.created_at || agora() })
      mapaAtual.set(chave, base)
      adicionados += 1
      return
    }

    const updates = {}
    if ((!existente.categoria || existente.categoria === 'cardapio') && base.categoria) updates.categoria = base.categoria
    if ((!existente.tipo || existente.tipo === 'item') && base.tipo) updates.tipo = base.tipo
    if ((Number(existente.preco || 0) <= 0) && Number(base.preco || 0) > 0) updates.preco = base.preco
    if (typeof existente.ativo !== 'boolean' && typeof base.ativo === 'boolean') updates.ativo = base.ativo

    if (Object.keys(updates).length) {
      const indice = mesclados.findIndex((item) => item.id === existente.id)
      if (indice >= 0) mesclados[indice] = { ...existente, ...updates }
      atualizados += 1
    }
  })

  gravar(CHAVES.produtos, mesclados)
  return { produtos: mesclados, adicionados, atualizados, totalBase: menuBase.length }
}

export function carregarPedidos() {
  garantirBaseInicial()
  return ler(CHAVES.pedidos, [])
}

export function salvarPedido(pedido) {
  const pedidos = carregarPedidos()
  const criadoEm = pedido.created_at || pedido.criado_em || agora()
  const pagamentos = (pedido.pagamentos || []).map((item) => ({
    ...item,
    forma_pagamento: item.forma_pagamento || item.forma || '',
    valor_pago: Number(item.valor_pago ?? item.valor ?? 0),
  }))
  pedidos.unshift({
    ...pedido,
    id: pedido.id || `ped-${Date.now()}`,
    created_at: criadoEm,
    criado_em: criadoEm,
    numero_pedido: pedido.numero_pedido || pedido.numeroPedido || '',
    cliente_nome: pedido.cliente_nome || pedido.nome_cliente || '',
    mesa_nome: pedido.mesa_nome || pedido.mesa || '',
    valor_pago: Number(pedido.valor_pago ?? pedido.pago ?? 0),
    valor_total: Number(pedido.valor_total ?? pedido.total ?? 0),
    taxa_entrega: Number(pedido.taxa_entrega ?? 0),
    pagamentos,
    pagamentos_venda_pdv: pagamentos,
  })
  gravar(CHAVES.pedidos, pedidos)
  return pedidos[0]
}

export function atualizarPedido(id, atualizacoes) {
  const pedidos = carregarPedidos().map((item) => (item.id === id ? { ...item, ...atualizacoes } : item))
  gravar(CHAVES.pedidos, pedidos)
  return pedidos.find((item) => item.id === id)
}

export function carregarMovimentacoes() {
  garantirBaseInicial()
  return ler(CHAVES.movimentacoes, [])
}

export function salvarMovimentacao(mov) {
  const movimentos = carregarMovimentacoes()
  const criadoEm = mov.created_at || mov.criado_em || agora()
  movimentos.unshift({ ...mov, id: mov.id || `mov-${Date.now()}`, created_at: criadoEm, criado_em: criadoEm })
  gravar(CHAVES.movimentacoes, movimentos)
  return movimentos[0]
}

export function carregarCaixas() {
  garantirBaseInicial()
  return ler(CHAVES.caixas, [])
}

export function abrirCaixa({ operador, usuario_id, valor_inicial, responsavel_nome = '', responsavel_tipo = '', moedas_nao_contadas = false }) {
  const caixas = carregarCaixas()
  const aberto = caixas.find((item) => item.status === 'aberto' && (item.usuario_id === usuario_id || item.operador === operador))
  if (aberto) return { ok: false, erro: 'Já existe um caixa aberto para este operador.' }
  const abertura = agora()
  const novo = {
    id: `caixa-${Date.now()}`,
    usuario_id: usuario_id || operador,
    operador,
    abertura,
    data_abertura: abertura,
    fechamento: null,
    data_fechamento: null,
    valor_inicial: Number(valor_inicial || 0),
    valor_abertura: Number(valor_inicial || 0),
    valor_final: null,
    valor_fechamento: null,
    status: 'aberto',
    responsavel_abertura_nome: responsavel_nome || operador || '',
    responsavel_abertura_tipo: responsavel_tipo || '',
    moedas_nao_contadas: Boolean(moedas_nao_contadas),
  }
  caixas.unshift(novo)
  gravar(CHAVES.caixas, caixas)
  return { ok: true, caixa: novo }
}

export function fecharCaixa({ id, valor_final, responsavel_nome = '', responsavel_tipo = '', motivo_fechamento = '' }) {
  const fechamento = agora()
  const caixas = carregarCaixas().map((item) => (
    item.id === id
      ? { ...item, fechamento, data_fechamento: fechamento, valor_final: Number(valor_final || 0), valor_fechamento: Number(valor_final || 0), status: 'fechado', responsavel_fechamento_nome: responsavel_nome || item.responsavel_fechamento_nome || '', responsavel_fechamento_tipo: responsavel_tipo || item.responsavel_fechamento_tipo || '', motivo_fechamento: motivo_fechamento || item.motivo_fechamento || '' }
      : item
  ))
  gravar(CHAVES.caixas, caixas)
  return caixas.find((item) => item.id === id)
}

export function caixaAbertoDoOperador(usuario) {
  const usuarioId = typeof usuario === 'object' ? usuario?.id : null
  const operador = typeof usuario === 'object' ? usuario?.usuario : usuario
  return carregarCaixas().find((item) => item.status === 'aberto' && (item.usuario_id === usuarioId || item.operador === operador)) || null
}

export function carregarConfig() {
  garantirBaseInicial()
  return ler(CHAVES.config, configPadrao)
}

export function salvarConfig(config) {
  const merged = { ...carregarConfig(), ...config }
  gravar(CHAVES.config, merged)
  return merged
}

export function carregarMotocasConfig() {
  garantirBaseInicial()
  return ler(CHAVES.motocasConfig, motocasConfigPadrao)
}

export function salvarMotocasConfig(config) {
  const atual = carregarMotocasConfig()
  const merged = {
    ...atual,
    ...config,
    quantidade_motoboys: Math.max(1, Math.min(10, Number(config.quantidade_motoboys ?? atual.quantidade_motoboys ?? 4) || 4)),
  }
  gravar(CHAVES.motocasConfig, merged)
  return merged
}

export function carregarMotoboysFechamento() {
  garantirBaseInicial()
  return ler(CHAVES.motoboysFechamento, [])
}

export function salvarMotoboysFechamento(registros = []) {
  const atuais = carregarMotoboysFechamento()
  const novos = (registros || []).map((item) => ({
    ...item,
    id: item.id || gerarId('motoboy'),
    created_at: item.created_at || agora(),
  }))
  const merged = [...novos, ...atuais]
  gravar(CHAVES.motoboysFechamento, merged)
  return novos
}

export function substituirMotoboysFechamentoDoDia(registros = [], referencia = new Date()) {
  const atuais = carregarMotoboysFechamento().filter((item) => !mesmaData(item.created_at || item.criado_em, referencia))
  const novos = (registros || []).map((item) => ({
    ...item,
    id: item.id || gerarId('motoboy'),
    created_at: item.created_at || agora(),
  }))
  const merged = [...novos, ...atuais]
  gravar(CHAVES.motoboysFechamento, merged)
  return novos
}

export function salvarFechamentoMotoboyDoDia(registro, referencia = new Date()) {
  const nome = String(registro?.nome || '').trim()
  if (!nome) throw new Error('Nome do motoboy é obrigatório para salvar.')
  const atuais = carregarMotoboysFechamento().filter((item) => {
    const mesmoDia = mesmaData(item.created_at || item.criado_em, referencia)
    const mesmoNome = String(item.nome || '').trim().toLowerCase() === nome.toLowerCase()
    return !(mesmoDia && mesmoNome)
  })
  const novo = {
    ...registro,
    id: registro.id || gerarId('motoboy'),
    created_at: registro.created_at || agora(),
  }
  const merged = [novo, ...atuais]
  gravar(CHAVES.motoboysFechamento, merged)
  return novo
}

export function carregarMotoboys() {
  garantirBaseInicial()
  return ler(CHAVES.motoboys, [])
}

export function salvarMotoboys(motoboys) {
  gravar(CHAVES.motoboys, motoboys)
  return motoboys
}

export function cadastrarMotoboy(dados) {
  const atuais = carregarMotoboys()
  const nome = String(dados?.nome || '').trim()
  if (!nome) return { ok: false, erro: 'Informe o nome do motoboy.' }
  const existe = atuais.some((item) => String(item.nome || '').trim().toLowerCase() === nome.toLowerCase())
  if (existe) return { ok: false, erro: 'Já existe um motoboy com esse nome/apelido.' }
  const novo = {
    id: gerarId('motoboy-cadastro'),
    nome,
    senha: String(dados?.senha || '').trim(),
    ativo: true,
    created_at: agora(),
  }
  gravar(CHAVES.motoboys, [novo, ...atuais])
  return { ok: true, motoboy: novo }
}

export function autenticarMotoboy(nome, senha) {
  const motoboy = carregarMotoboys().find((item) => String(item.nome || '').trim().toLowerCase() === String(nome || '').trim().toLowerCase() && item.senha === senha && item.ativo !== false)
  if (!motoboy) return { ok: false, erro: 'Motoboy ou senha inválidos.' }
  return { ok: true, motoboy }
}


export function carregarPrestacoesPortalMotoca() {
  garantirBaseInicial()
  return ler(CHAVES.portalPrestacoes, [])
}

export function salvarPrestacaoPortalMotocaDoDia(registro, referencia = new Date()) {
  const nome = String(registro?.nome || '').trim()
  if (!nome) throw new Error('Nome do motoca é obrigatório para salvar.')
  const existentes = carregarPrestacoesPortalMotoca()
  const salvoAnterior = existentes.find((item) => {
    const mesmoDia = mesmaData(item.created_at || item.criado_em, referencia)
    const mesmoNome = String(item.nome || '').trim().toLowerCase() === nome.toLowerCase()
    return mesmoDia && mesmoNome
  })
  const atuais = existentes.filter((item) => {
    const mesmoDia = mesmaData(item.created_at || item.criado_em, referencia)
    const mesmoNome = String(item.nome || '').trim().toLowerCase() === nome.toLowerCase()
    return !(mesmoDia && mesmoNome)
  })
  const finalizado = Boolean(registro.finalizado)
  const novo = {
    ...salvoAnterior,
    ...registro,
    id: registro.id || salvoAnterior?.id || gerarId('portal-motoca'),
    entregas_detalhe: Array.isArray(registro.entregas_detalhe) ? registro.entregas_detalhe : (salvoAnterior?.entregas_detalhe || []),
    maquininha_padrao: registro.maquininha_padrao ?? salvoAnterior?.maquininha_padrao ?? '',
    observacao_geral: registro.observacao_geral ?? salvoAnterior?.observacao_geral ?? '',
    created_at: salvoAnterior?.created_at || registro.created_at || agora(),
    updated_at: agora(),
    editado: Boolean(salvoAnterior),
    editado_em: salvoAnterior ? agora() : null,
    finalizado,
    finalizado_em: finalizado ? (registro.finalizado_em || agora()) : null,
  }
  const merged = [novo, ...atuais]
  gravar(CHAVES.portalPrestacoes, merged)
  return novo
}

export function finalizarPrestacaoPortalMotocaDoDia(nome, referencia = new Date()) {
  const alvo = String(nome || '').trim()
  if (!alvo) throw new Error('Nome do motoca é obrigatório para finalizar o trampo.')
  const existentes = carregarPrestacoesPortalMotoca()
  const indice = existentes.findIndex((item) => {
    const mesmoDia = mesmaData(item.created_at || item.criado_em, referencia)
    const mesmoNome = String(item.nome || '').trim().toLowerCase() === alvo.toLowerCase()
    return mesmoDia && mesmoNome
  })
  if (indice < 0) throw new Error('Nenhuma prestação salva hoje para finalizar.')
  const atual = existentes[indice]
  const atualizado = {
    ...atual,
    finalizado: true,
    finalizado_em: agora(),
    updated_at: agora(),
  }
  const copia = [...existentes]
  copia[indice] = atualizado
  gravar(CHAVES.portalPrestacoes, copia)
  return atualizado
}
