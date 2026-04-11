export const formasPagamento = ['dinheiro', 'pix', 'credito', 'debito']

export const nomeTipoPedido = {
  mesa: 'Mesa',
  balcao: 'Balcão',
  retirada: 'Retirada',
  entrega: 'Entrega',
}

export const nomeOrigem = {
  goomer: 'Goomer',
  ceofood: 'Ceofood',
  balcao: 'Balcão',
}

export function agora() { return new Date().toISOString() }

export function formatarMoeda(valor = 0) {
  const numero = Number(valor || 0)
  return numero.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function horaBR(data) {
  if (!data) return '--:--'
  const d = new Date(data)
  if (Number.isNaN(d.getTime())) return '--:--'
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

export function dataHoraBR(data) {
  if (!data) return '--'
  const d = new Date(data)
  if (Number.isNaN(d.getTime())) return '--'
  return d.toLocaleString('pt-BR')
}

export function normalizarTexto(valor = '') {
  return String(valor || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
}

export function parseNumero(valor) {
  if (typeof valor === 'number') return Number.isFinite(valor) ? valor : 0
  const limpo = String(valor || '')
    .replace(/\./g, '')
    .replace(',', '.')
    .replace(/[^0-9.-]/g, '')
  const numero = Number(limpo)
  return Number.isFinite(numero) ? numero : 0
}

export function mascararMoedaInput(valor) {
  const digitos = String(valor || '').replace(/\D/g, '')
  if (!digitos) return ''
  const numero = Number(digitos) / 100
  return numero.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function limitarValorAoTotal(valor, total) {
  return Math.max(Math.min(Number(valor || 0), Number(total || 0)), 0)
}

function inicioDoDia(data) {
  const d = new Date(data)
  d.setHours(0, 0, 0, 0)
  return d
}

function fimDoDia(data) {
  const d = new Date(data)
  d.setHours(23, 59, 59, 999)
  return d
}

export function filtrarPorPeriodoPersonalizado(lista = [], campo = 'created_at', filtros = {}) {
  const { periodo = 'hoje', dataInicio, dataFim } = filtros
  if (periodo === 'todos' && !dataInicio && !dataFim) return lista

  const agoraData = new Date()
  let inicio = null
  let fim = null

  if (periodo === 'hoje') {
    inicio = inicioDoDia(agoraData)
    fim = fimDoDia(agoraData)
  }
  if (periodo === 'mes') {
    inicio = new Date(agoraData.getFullYear(), agoraData.getMonth(), 1, 0, 0, 0, 0)
    fim = new Date(agoraData.getFullYear(), agoraData.getMonth() + 1, 0, 23, 59, 59, 999)
  }
  if (periodo === 'personalizado') {
    if (dataInicio) inicio = inicioDoDia(`${dataInicio}T00:00:00`)
    if (dataFim) fim = fimDoDia(`${dataFim}T00:00:00`)
  }

  return lista.filter((item) => {
    const data = new Date(item?.[campo])
    if (Number.isNaN(data.getTime())) return false
    if (inicio && data < inicio) return false
    if (fim && data > fim) return false
    return true
  })
}

export function buscarPorPedidoOuCliente(lista = [], termo = '') {
  const t = normalizarTexto(termo)
  if (!t) return lista
  return lista.filter((item) => normalizarTexto(`${item.numero_pedido || ''} ${item.cliente_nome || ''} ${item.mesa_nome || ''} ${item.origem || ''} ${item.tipo || ''}`).includes(t))
}

export function extrairMotivoExtorno(observacao = '') {
  const texto = String(observacao || '')
  const marcador = 'EXTORNO:'
  const index = texto.indexOf(marcador)
  return index >= 0 ? texto.slice(index + marcador.length).trim() : ''
}

export function inicioDoDiaISO(data = new Date()) {
  const d = new Date(data)
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

export function pagamentosDaVenda(venda) {
  return venda?.pagamentos_venda_pdv || venda?.pagamentos || []
}

export function formatarPedidoNumero(valor, tamanho = 4) {
  const digitos = String(valor || '').replace(/\D/g, '')
  if (!digitos) return ''
  return digitos.slice(-tamanho).padStart(tamanho, '0')
}

export function formaPagamentoPrincipal(venda) {
  const pagamentos = pagamentosDaVenda(venda)
  if (!pagamentos.length) return 'nao_informado'
  const totais = pagamentos.reduce((acc, item) => {
    const forma = item.forma_pagamento || item.forma || 'nao_informado'
    acc[forma] = (acc[forma] || 0) + Number(item.valor_pago ?? item.valor ?? 0)
    return acc
  }, {})
  return Object.entries(totais).sort((a, b) => b[1] - a[1])[0]?.[0] || 'nao_informado'
}

export function nomeFormaPagamento(forma = '') {
  if (forma === 'credito') return 'Crédito'
  if (forma === 'debito') return 'Débito'
  if (forma === 'pix') return 'Pix'
  if (forma === 'dinheiro') return 'Dinheiro'
  if (forma === 'cartao') return 'Cartão'
  return 'Não informado'
}

export function pagamentosResumo(venda) {
  const pagamentos = pagamentosDaVenda(venda)
  if (!pagamentos.length) return 'Sem pagamento lançado'
  return pagamentos
    .map((item) => `${item.forma_pagamento || item.forma}: ${formatarMoeda(item.valor_pago ?? item.valor ?? 0)}${Number(item.troco || 0) > 0 ? ` • troco ${formatarMoeda(item.troco)}` : ''}`)
    .join(' • ')
}

export function resumoPagamentoCurto(venda) {
  const forma = formaPagamentoPrincipal(venda)
  return nomeFormaPagamento(forma)
}

export function vendasPorOrigemETipo(vendas = []) {
  const resumo = {
    origem: { goomer: 0, ceofood: 0, balcao: 0 },
    tipo: { mesa: 0, balcao: 0, retirada: 0, entrega: 0 },
  }
  vendas.forEach((venda) => {
    const valor = Number(venda.pago || venda.total || 0)
    if (venda.origem in resumo.origem) resumo.origem[venda.origem] += valor
    if (venda.tipo in resumo.tipo) resumo.tipo[venda.tipo] += valor
  })
  return resumo
}

export function extrairDadosTrocoMotoboy(observacao = '') {
  const texto = String(observacao || '')
  if (!texto) return null
  const pedido = texto.match(/Pedido:\s*([0-9]+)/i)?.[1] || ''
  const cliente = texto.match(/Cliente:\s*([^|]+)/i)?.[1]?.trim() || ''
  const conta = Number(texto.match(/Conta:\s*([0-9.,]+)/i)?.[1]?.replace(',', '.') || 0)
  const trocoPara = Number(texto.match(/Troco para:\s*([0-9.,]+)/i)?.[1]?.replace(',', '.') || 0)
  const trocoCliente = Number(texto.match(/Troco do cliente:\s*([0-9.,]+)/i)?.[1]?.replace(',', '.') || 0)
  if (!pedido && !cliente && !conta && !trocoPara && !trocoCliente) return null
  return {
    pedido: formatarPedidoNumero(pedido),
    cliente,
    conta,
    trocoPara,
    trocoCliente,
  }
}

export function toqueTrocoResumo(observacao = '') {
  const dados = extrairDadosTrocoMotoboy(observacao)
  if (!dados) return 'Sem troco detalhado'
  return `Troco para ${formatarMoeda(dados.trocoPara)} • troco ${formatarMoeda(dados.trocoCliente)}`
}

export function tocarSomAlerta(tipo = 'info') {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext
    if (!AudioCtx) return
    const ctx = new AudioCtx()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = tipo === 'error' ? 'sawtooth' : tipo === 'warning' ? 'square' : 'sine'
    osc.frequency.value = tipo === 'error' ? 220 : tipo === 'warning' ? 520 : 760
    gain.gain.value = 0.02
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start()
    setTimeout(() => {
      osc.stop()
      ctx.close().catch(() => {})
    }, tipo === 'error' ? 220 : 140)
  } catch {}
}

export function operadorDaVenda(item) {
  return item?.operador_nome || item?.usuario_nome || item?.operador || item?.usuario || item?.usuario_login || (item?.usuario_id ? String(item.usuario_id).slice(0, 8) : '---')
}
