import { supabase, hasSupabase } from './supabase'
import { agora, formatarPedidoNumero, normalizarTexto, pagamentosDaVenda, parseNumero } from './utils'
import {
  carregarProdutos as carregarProdutosLocal,
  salvarProduto as salvarProdutoLocal,
  alternarProduto as alternarProdutoLocal,
  importarProdutosBase as importarProdutosBaseLocal,
  carregarPedidos as carregarPedidosLocal,
  atualizarPedido as atualizarPedidoLocal,
  salvarPedido as salvarPedidoLocal,
  carregarMovimentacoes as carregarMovimentacoesLocal,
  salvarMovimentacao as salvarMovimentacaoLocal,
  carregarCaixas as carregarCaixasLocal,
  abrirCaixa as abrirCaixaLocal,
  fecharCaixa as fecharCaixaLocal,
  caixaAbertoDoOperador as caixaAbertoDoOperadorLocal,
  carregarConfig as carregarConfigLocal,
  salvarConfig as salvarConfigLocal,
  carregarMotocasConfig as carregarMotocasConfigLocal,
  salvarMotocasConfig as salvarMotocasConfigLocal,
  carregarMotoboysFechamento as carregarMotoboysFechamentoLocal,
  salvarMotoboysFechamento as salvarMotoboysFechamentoLocal,
  substituirMotoboysFechamentoDoDia as substituirMotoboysFechamentoDoDiaLocal,
  salvarFechamentoMotoboyDoDia as salvarFechamentoMotoboyDoDiaLocal,
  carregarPrestacoesPortalMotoca as carregarPrestacoesPortalMotocaLocal,
  salvarPrestacaoPortalMotocaDoDia as salvarPrestacaoPortalMotocaDoDiaLocal,
  finalizarPrestacaoPortalMotocaDoDia as finalizarPrestacaoPortalMotocaDoDiaLocal,
  carregarMotoboys as carregarMotoboysLocal,
  cadastrarMotoboy as cadastrarMotoboyLocal,
  autenticarMotoboy as autenticarMotoboyLocal,
} from './storage'
import {
  carregarUsuarios as carregarUsuariosLocal,
  criarOperador as criarOperadorLocal,
  autenticarUsuario as autenticarUsuarioLocal,
  atualizarUsuario as atualizarUsuarioLocal,
  excluirUsuario as excluirUsuarioLocal,
} from './auth'

function ok(data) { return { ok: true, data } }
function fail(error) { return { ok: false, error: error?.message || error || 'Erro inesperado.' } }

function somarPagamentosPorForma(venda, forma) {
  return pagamentosDaVenda(venda)
    .filter((item) => item.forma_pagamento === forma || item.forma === forma)
    .reduce((soma, item) => soma + Number(item.valor_pago || item.valor || 0), 0)
}

function mapearUsuario(data) {
  if (!data) return null
  return {
    ...data,
    nome: data.operadores_caixa?.[0]?.nome || data.nome || data.usuario,
  }
}

function ehUuid(valor) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(valor || '').trim())
}

async function resolverUsuarioIdSupabase(usuario) {
  if (!hasSupabase) return usuario?.id || null
  if (ehUuid(usuario?.id)) return usuario.id
  if (!usuario?.usuario) return null
  const { data, error } = await supabase
    .from('usuarios_sistema')
    .select('id')
    .eq('usuario', usuario.usuario)
    .maybeSingle()
  if (error) throw error
  return data?.id || null
}

async function mapaUsuariosPorId() {
  if (!hasSupabase) return {}
  const { data, error } = await supabase
    .from('usuarios_sistema')
    .select('id, usuario, operadores_caixa(nome)')
  if (error) throw error
  return Object.fromEntries((data || []).map((item) => [item.id, { usuario_login: item.usuario, usuario_nome: item.operadores_caixa?.[0]?.nome || item.usuario }]))
}

function montarObservacaoComTroco(observacaoAtual = '', observacaoTroco = '') {
  const base = String(observacaoAtual || '')
    .split('| TROCO_MOTOBOY:')[0]
    .trim()
  return [base, observacaoTroco ? `TROCO_MOTOBOY: ${observacaoTroco}` : ''].filter(Boolean).join(' | ')
}

function erroTabelaAusente(error) {
  const texto = String(error?.message || error?.details || '')
  return /relation .* does not exist|Could not find the table|does not exist/i.test(texto)
}

async function carregarMotocasConfigSupabaseOuLocal() {
  try {
    const { data, error } = await supabase.from('motocas_config').select('*').eq('id', 1).maybeSingle()
    if (error) throw error
    if (!data) return carregarMotocasConfigLocal()
    return {
      quantidade_motoboys: Number(data.quantidade_motoboys || 4),
      valor_entrega_normal: Number(data.valor_entrega_normal || 7),
      valor_entrega_distante: Number(data.valor_entrega_distante || 10),
    }
  } catch (error) {
    if (erroTabelaAusente(error)) return carregarMotocasConfigLocal()
    return carregarMotocasConfigLocal()
  }
}

async function salvarMotocasConfigSupabaseOuLocal(config) {
  const local = salvarMotocasConfigLocal(config)
  try {
    const payload = {
      id: 1,
      quantidade_motoboys: Number(local.quantidade_motoboys || 4),
      valor_entrega_normal: Number(local.valor_entrega_normal || 7),
      valor_entrega_distante: Number(local.valor_entrega_distante || 10),
      updated_at: new Date().toISOString(),
    }
    const { data, error } = await supabase.from('motocas_config').upsert(payload).select().maybeSingle()
    if (error) throw error
    if (data) {
      return {
        quantidade_motoboys: Number(data.quantidade_motoboys || local.quantidade_motoboys || 4),
        valor_entrega_normal: Number(data.valor_entrega_normal || local.valor_entrega_normal || 7),
        valor_entrega_distante: Number(data.valor_entrega_distante || local.valor_entrega_distante || 10),
      }
    }
  } catch (error) {
    if (!erroTabelaAusente(error)) console.warn('Falha ao salvar motocas_config no Supabase:', error)
  }
  return local
}

async function listarPrestacoesPortalSupabaseOuLocal() {
  try {
    const { data, error } = await supabase.from('motocas_portal_prestacoes').select('*').order('created_at', { ascending: false })
    if (error) throw error
    return data || []
  } catch (error) {
    if (!erroTabelaAusente(error)) console.warn('Falha ao ler motocas_portal_prestacoes no Supabase:', error)
    return carregarPrestacoesPortalMotocaLocal()
  }
}

async function salvarPrestacaoPortalSupabaseOuLocal(registro) {
  const local = salvarPrestacaoPortalMotocaDoDiaLocal(registro)
  try {
    const nome = String(registro?.nome || '').trim()
    const { inicio, fim } = intervaloDeHoje()
    const { data: atual } = await supabase
      .from('motocas_portal_prestacoes')
      .select('*')
      .eq('nome', nome)
      .gte('created_at', inicio)
      .lte('created_at', fim)
      .maybeSingle()
    const { error: deleteError } = await supabase
      .from('motocas_portal_prestacoes')
      .delete()
      .eq('nome', nome)
      .gte('created_at', inicio)
      .lte('created_at', fim)
    if (deleteError) throw deleteError
    const payload = {
      motoboy_id: registro.motoboy_id || null,
      nome,
      entregas_normais: Number(registro.entregas_normais || 0),
      entregas_distantes: Number(registro.entregas_distantes || 0),
      entregas_dinheiro: Number(registro.entregas_dinheiro || 0),
      entregas_cartao: Number(registro.entregas_cartao || 0),
      entregas_pix: Number(registro.entregas_pix || 0),
      valor_normal: parseNumero(registro.valor_normal),
      valor_distante: parseNumero(registro.valor_distante),
      dinheiro_entregue: parseNumero(registro.dinheiro_entregue),
      forma_recebimento: registro.forma_recebimento || 'dinheiro',
      total: parseNumero(registro.total),
      numero_pedido: registro.numero_pedido || null,
      origem: registro.origem || null,
      cliente_nome: registro.cliente_nome || null,
      valor_total: parseNumero(registro.valor_total),
      forma_pagamento_principal: registro.forma_pagamento_principal || null,
      maquininha_usada: registro.maquininha_usada || null,
      maquininha_padrao: registro.maquininha_padrao || null,
      troco_para: parseNumero(registro.troco_para),
      troco_cliente: parseNumero(registro.troco_cliente),
      observacao: registro.observacao || null,
      observacao_geral: registro.observacao_geral || null,
      entregas_detalhe: Array.isArray(registro.entregas_detalhe) ? registro.entregas_detalhe : [],
      editado: Boolean(atual),
      editado_em: atual ? agora() : null,
      finalizado: Boolean(registro.finalizado),
      finalizado_em: registro.finalizado ? (registro.finalizado_em || agora()) : null,
    }
    const { data, error } = await supabase
      .from('motocas_portal_prestacoes')
      .insert(payload)
      .select()
      .single()
    if (error) throw error
    return data || local
  } catch (error) {
    if (!erroTabelaAusente(error)) console.warn('Falha ao salvar motocas_portal_prestacoes no Supabase:', error)
    return local
  }
}

async function finalizarPrestacaoPortalSupabaseOuLocal(nome) {
  const local = finalizarPrestacaoPortalMotocaDoDiaLocal(nome)
  try {
    const { inicio, fim } = intervaloDeHoje()
    const { data, error } = await supabase
      .from('motocas_portal_prestacoes')
      .update({ finalizado: true, finalizado_em: agora(), updated_at: agora() })
      .eq('nome', String(nome || '').trim())
      .gte('created_at', inicio)
      .lte('created_at', fim)
      .select()
      .maybeSingle()
    if (error) throw error
    return data || local
  } catch (error) {
    if (!erroTabelaAusente(error)) console.warn('Falha ao finalizar motocas_portal_prestacoes no Supabase:', error)
    return local
  }
}

function normalizarVendaLocal(item) {
  return {
    ...item,
    pagamentos_venda_pdv: item.pagamentos_venda_pdv || item.pagamentos || [],
    itens_venda_pdv: item.itens_venda_pdv || item.itens || [],
    criado_em: item.criado_em || item.created_at,
  }
}

export async function autenticarUsuarioApi(login, senha) {
  if (!hasSupabase) return autenticarUsuarioLocal(login, senha)
  try {
    const { data, error } = await supabase
      .from('usuarios_sistema')
      .select('*, operadores_caixa(nome, observacao)')
      .eq('usuario', login)
      .eq('senha', senha)
      .eq('ativo', true)
      .maybeSingle()
    if (error) throw error
    if (!data) return { ok: false, erro: 'Usuário ou senha inválidos.' }
    return { ok: true, usuario: mapearUsuario(data) }
  } catch (error) {
    return { ok: false, erro: error.message || 'Falha ao autenticar no Supabase.' }
  }
}

export async function listarUsuariosApi() {
  if (!hasSupabase) return carregarUsuariosLocal()
  const { data, error } = await supabase
    .from('usuarios_sistema')
    .select('*, operadores_caixa(nome, observacao)')
    .order('criado_em', { ascending: false })
  if (error) throw error
  return (data || []).map(mapearUsuario)
}

export async function criarOperadorApi(payload) {
  if (!hasSupabase) return criarOperadorLocal(payload)
  try {
    const tipo = payload.tipo || 'operador'
    const { data: existe } = await supabase.from('usuarios_sistema').select('id').eq('usuario', payload.usuario).maybeSingle()
    if (existe) return { ok: false, erro: 'Já existe um usuário com esse login.' }
    if (tipo === 'admin') {
      const { data: adminExistente } = await supabase.from('usuarios_sistema').select('id').eq('tipo', 'admin').maybeSingle()
      if (adminExistente) return { ok: false, erro: 'Já existe um administrador cadastrado no sistema.' }
    }
    const { data, error } = await supabase
      .from('usuarios_sistema')
      .insert({ usuario: payload.usuario, senha: payload.senha, tipo, ativo: true })
      .select()
      .single()
    if (error) throw error
    await supabase.from('operadores_caixa').insert({ usuario_id: data.id, nome: payload.nome, observacao: null })
    return { ok: true, usuario: data }
  } catch (error) {
    return { ok: false, erro: error.message || 'Falha ao criar usuário.' }
  }
}

export async function atualizarUsuarioApi({ id, nome, senha, ativo }) {
  if (!hasSupabase) return atualizarUsuarioLocal(id, { nome, senha, ativo })
  try {
    const updates = {}
    if (typeof senha === 'string' && senha.trim()) updates.senha = senha.trim()
    if (typeof ativo === 'boolean') updates.ativo = ativo
    if (Object.keys(updates).length) {
      const { error } = await supabase.from('usuarios_sistema').update(updates).eq('id', id)
      if (error) throw error
    }
    if (typeof nome === 'string') {
      const { data: op } = await supabase.from('operadores_caixa').select('id').eq('usuario_id', id).maybeSingle()
      if (op?.id) {
        const { error } = await supabase.from('operadores_caixa').update({ nome }).eq('id', op.id)
        if (error) throw error
      }
    }
    return { ok: true }
  } catch (error) {
    return { ok: false, erro: error.message || 'Falha ao atualizar usuário.' }
  }
}

export async function excluirUsuarioApi(id) {
  if (!hasSupabase) return excluirUsuarioLocal(id)
  try {
    const { data: usuario, error: leituraError } = await supabase
      .from('usuarios_sistema')
      .select('id, tipo, usuario')
      .eq('id', id)
      .maybeSingle()
    if (leituraError) throw leituraError
    if (!usuario) return { ok: false, erro: 'Usuário não encontrado.' }
    if (usuario.tipo === 'admin' || usuario.usuario === 'admin') return { ok: false, erro: 'O administrador principal não pode ser excluído.' }
    await supabase.from('operadores_caixa').delete().eq('usuario_id', id)
    const { error } = await supabase.from('usuarios_sistema').delete().eq('id', id)
    if (error) throw error
    return { ok: true }
  } catch (error) {
    return { ok: false, erro: error.message || 'Falha ao excluir operador.' }
  }
}

export async function carregarProdutosApi() {
  if (!hasSupabase) return carregarProdutosLocal()
  const { data, error } = await supabase.from('produtos_cardapio').select('*').order('nome')
  if (error) throw error
  return data || []
}

export async function salvarProdutoApi(produto) {
  if (!hasSupabase) return salvarProdutoLocal(produto)
  const payload = { nome: produto.nome, categoria: produto.categoria, tipo: produto.tipo, preco: Number(parseNumero(produto.preco) || 0), ativo: produto.ativo !== false }
  if (produto.id) payload.id = produto.id
  const { data, error } = await supabase.from('produtos_cardapio').upsert(payload).select().single()
  if (error) throw error
  return data
}

export async function alternarProdutoApi(produto) {
  if (!hasSupabase) return alternarProdutoLocal(produto.id)
  const { data, error } = await supabase.from('produtos_cardapio').update({ ativo: produto.ativo === false }).eq('id', produto.id).select().single()
  if (error) throw error
  return data
}

export async function excluirProdutoApi(produtoId) {
  if (!hasSupabase) return alternarProdutoLocal(produtoId)
  const { data, error } = await supabase.from('produtos_cardapio').delete().eq('id', produtoId).select().maybeSingle()
  if (error) throw error
  return data
}



export async function importarProdutosBaseApi() {
  if (!hasSupabase) return importarProdutosBaseLocal()
  const base = importarProdutosBaseLocal().produtos || []
  const atuais = await carregarProdutosApi()
  const mapaAtual = new Map((atuais || []).map((item) => [normalizarTexto(item.nome || ''), item]))
  let adicionados = 0
  let atualizados = 0

  for (const item of base) {
    const chave = normalizarTexto(item.nome || '')
    const existente = mapaAtual.get(chave)
    if (!existente) {
      await salvarProdutoApi(item)
      adicionados += 1
      continue
    }
    const updates = {}
    if ((!existente.categoria || existente.categoria === 'cardapio') && item.categoria) updates.categoria = item.categoria
    if ((!existente.tipo || existente.tipo === 'item') && item.tipo) updates.tipo = item.tipo
    if (Number(existente.preco || 0) <= 0 && Number(item.preco || 0) > 0) updates.preco = item.preco
    if (typeof existente.ativo !== 'boolean' && typeof item.ativo === 'boolean') updates.ativo = item.ativo
    if (Object.keys(updates).length) {
      await salvarProdutoApi({ ...existente, ...updates })
      atualizados += 1
    }
  }

  return { adicionados, atualizados, totalBase: base.length }
}

export async function obterCaixaAbertoApi(usuario) {
  if (!hasSupabase) return caixaAbertoDoOperadorLocal(usuario)
  const usuarioId = await resolverUsuarioIdSupabase(usuario)
  let query = supabase
    .from('caixas')
    .select('*')
    .eq('status', 'aberto')
    .order('data_abertura', { ascending: false })
    .limit(1)
  if (usuarioId) query = query.eq('usuario_id', usuarioId)
  const { data, error } = await query
  if (error) throw error
  return (data || [])[0] || null
}

export async function abrirCaixaApi({ usuario, valorAbertura, moedasNaoContadas = false }) {
  if (!hasSupabase) {
    const resposta = abrirCaixaLocal({
      operador: usuario?.usuario,
      usuario_id: usuario?.id,
      valor_inicial: valorAbertura,
      responsavel_nome: usuario?.nome || usuario?.usuario || '',
      responsavel_tipo: usuario?.tipo || '',
      moedas_nao_contadas: moedasNaoContadas,
    })
    if (!resposta?.ok) return resposta
    return { ok: true, data: resposta.caixa }
  }
  try {
    const usuarioId = await resolverUsuarioIdSupabase(usuario)
    const caixaAtual = await obterCaixaAbertoApi(usuario)
    if (caixaAtual) return { ok: false, erro: 'Já existe um caixa aberto para este operador.', caixaAtual }
    const payload = {
      usuario_id: usuarioId,
      valor_abertura: parseNumero(valorAbertura),
      status: 'aberto',
      responsavel_abertura_nome: usuario?.nome || usuario?.usuario || null,
      responsavel_abertura_tipo: usuario?.tipo || null,
      moedas_nao_contadas: Boolean(moedasNaoContadas),
    }
    const { data, error } = await supabase.from('caixas').insert(payload).select().single()
    if (error) throw error
    return { ok: true, data }
  } catch (error) {
    return { ok: false, erro: error.message || 'Falha ao abrir caixa.' }
  }
}

export async function fecharCaixaApi({ caixaId, valorContado, usuario, motivoFechamento = '' }) {
  if (!hasSupabase) return ok(fecharCaixaLocal({
    id: caixaId,
    valor_final: valorContado,
    responsavel_nome: usuario?.nome || usuario?.usuario || '',
    responsavel_tipo: usuario?.tipo || '',
    motivo_fechamento: motivoFechamento,
  }))
  try {
    const resumo = await obterResumoCaixaApi(caixaId)
    const valorSistema = Number(resumo?.valorSistema || 0)
    const diferenca = parseNumero(valorContado) - valorSistema
    const payload = {
      valor_fechamento: parseNumero(valorContado),
      valor_sistema: valorSistema,
      diferenca,
      data_fechamento: agora(),
      status: 'fechado',
      responsavel_fechamento_nome: usuario?.nome || usuario?.usuario || null,
      responsavel_fechamento_tipo: usuario?.tipo || null,
      motivo_fechamento: motivoFechamento || null,
    }
    const { data, error } = await supabase.from('caixas').update(payload).eq('id', caixaId).select().single()
    if (error) throw error
    return ok(data)
  } catch (error) {
    return fail(error)
  }
}

export async function existeNumeroPedidoNoCaixaApi({ caixaId, numeroPedido, vendaIdIgnorar = null }) {
  const numero = String(numeroPedido || '').trim()
  if (!numero) return false
  if (!hasSupabase) {
    return carregarPedidosLocal().some((item) => item.caixa_id === caixaId && item.numero_pedido === numero && item.id !== vendaIdIgnorar)
  }
  let query = supabase
    .from('vendas_pdv')
    .select('id')
    .eq('caixa_id', caixaId)
    .eq('numero_pedido', numero)
    .limit(1)
  if (vendaIdIgnorar) query = query.neq('id', vendaIdIgnorar)
  const { data, error } = await query
  if (error) throw error
  return Boolean((data || []).length)
}

export async function existeTrocoMotoboyNoCaixaApi({ caixaId, numeroPedido }) {
  const numero = String(numeroPedido || '').trim()
  if (!numero) return false
  if (!hasSupabase) {
    return carregarMovimentacoesLocal().some((item) => item.caixa_id === caixaId && item.categoria === 'motoca' && String(item.descricao || item.observacao || '').includes(`Pedido: ${numero}`))
  }
  const { data, error } = await supabase.from('saidas_caixa').select('id, observacao').eq('caixa_id', caixaId).eq('tipo', 'troco_motoca')
  if (error) throw error
  return (data || []).some((item) => String(item.observacao || '').includes(`Pedido: ${numero}`))
}

export async function registrarSaidaCaixaApi({ caixaId, usuario, tipo, valor, observacao, motocaNome }) {
  if (!hasSupabase) {
    return salvarMovimentacaoLocal({ tipo, valor: parseNumero(valor), descricao: observacao, observacao, operador: usuario?.usuario, operador_nome: usuario?.nome || usuario?.usuario, categoria: tipo === 'troco_motoca' ? 'motoca' : 'caixa', motoca_nome: motocaNome || null, caixa_id: caixaId, criado_em: agora() })
  }
  const usuarioId = await resolverUsuarioIdSupabase(usuario)
  const { data, error } = await supabase.from('saidas_caixa').insert({ caixa_id: caixaId, usuario_id: usuarioId, tipo, motoca_nome: motocaNome || null, valor: parseNumero(valor), observacao: observacao || null }).select().single()
  if (error) throw error
  return data
}

export async function registrarVendaApi({ usuario, caixaId, venda, itens, pagamentos }) {
  const numeroDuplicado = await existeNumeroPedidoNoCaixaApi({ caixaId, numeroPedido: venda.numero_pedido })
  if (numeroDuplicado) {
    throw new Error('Já existe uma venda com esse número de pedido neste caixa. Use outro número ou feche o caixa atual antes de repetir a comanda.')
  }
  if (!hasSupabase) {
    return salvarPedidoLocal({ ...venda, caixa_id: caixaId, itens, pagamentos, valor_pago: venda.pago, nome_cliente: venda.cliente_nome, mesa: venda.mesa_nome, created_at: agora(), criado_em: agora(), operador: usuario?.usuario, operador_nome: usuario?.nome || usuario?.usuario, usuario_id: usuario?.id })
  }
  const usuarioId = await resolverUsuarioIdSupabase(usuario)
  const vendaPayload = { ...venda, caixa_id: caixaId, usuario_id: usuarioId }
  const { data: vendaData, error: vendaError } = await supabase.from('vendas_pdv').insert(vendaPayload).select().single()
  if (vendaError) throw vendaError
  if (itens.length) {
    const { error } = await supabase.from('itens_venda_pdv').insert(itens.map((item) => ({ venda_id: vendaData.id, produto_id: item.id || null, produto_nome: item.nome, quantidade: Number(item.quantidade || 0), preco_unitario: parseNumero(item.preco), subtotal: parseNumero(item.preco) * Number(item.quantidade || 0) })))
    if (error) throw error
  }
  if (pagamentos.length) {
    const { error } = await supabase.from('pagamentos_venda_pdv').insert(pagamentos.map((item) => ({ venda_id: vendaData.id, forma_pagamento: item.forma, valor_pago: parseNumero(item.valor), valor_recebido: item.valorRecebido ? parseNumero(item.valorRecebido) : null, troco: parseNumero(item.troco) })))
    if (error) throw error
  }
  return vendaData
}

export async function listarPendentesApi() {
  if (!hasSupabase) return carregarPedidosLocal().filter((item) => item.status !== 'pago' && item.status !== 'cancelado').map(normalizarVendaLocal)
  const { data, error } = await supabase.from('vendas_pdv').select('*, pagamentos_venda_pdv(*)').eq('status', 'pendente').order('criado_em', { ascending: false })
  if (error) throw error
  return data || []
}

export async function marcarVendaComoPagaApi(vendaId, novosPagamentos = []) {
  if (!hasSupabase) {
    const vendas = carregarPedidosLocal()
    const venda = vendas.find((item) => item.id === vendaId)
    if (!venda) throw new Error('Venda não encontrada.')
    const pagosAtuais = (venda.pagamentos_venda_pdv || venda.pagamentos || []).map((item) => ({
      ...item,
      forma_pagamento: item.forma_pagamento || item.forma,
      valor_pago: Number(item.valor_pago ?? item.valor ?? 0),
      valor_recebido: item.valor_recebido ?? item.valorRecebido ?? null,
      troco: Number(item.troco || 0),
    }))
    const novos = (novosPagamentos || []).map((item) => ({
      forma_pagamento: item.forma,
      valor_pago: Number(item.valor || 0),
      valor_recebido: item.valorRecebido ?? null,
      troco: Number(item.troco || 0),
    }))
    const pagamentos = [...pagosAtuais, ...novos]
    const pago = pagamentos.reduce((soma, item) => soma + Number(item.valor_pago || 0), 0)
    const total = Number(venda.total || venda.valor_total || 0)
    const restante = Math.max(total - pago, 0)
    return atualizarPedidoLocal(vendaId, {
      status: restante <= 0.001 ? 'pago' : 'pendente',
      pago,
      valor_pago: pago,
      restante,
      pagamentos,
      pagamentos_venda_pdv: pagamentos,
    })
  }
  const { data: venda, error: vendaError } = await supabase.from('vendas_pdv').select('id,total,pago').eq('id', vendaId).single()
  if (vendaError) throw vendaError
  if (novosPagamentos.length) {
    const { error: insertError } = await supabase.from('pagamentos_venda_pdv').insert(novosPagamentos.map((item) => ({ venda_id: vendaId, forma_pagamento: item.forma, valor_pago: parseNumero(item.valor), valor_recebido: item.valorRecebido ? parseNumero(item.valorRecebido) : null, troco: parseNumero(item.troco) })))
    if (insertError) throw insertError
  }
  const pagoAtual = Number(venda.pago || 0)
  const adicional = novosPagamentos.reduce((soma, item) => soma + Number(item.valor || 0), 0)
  const pago = Math.min(Number(venda.total || 0), pagoAtual + adicional || Number(venda.total || 0))
  const status = pago + 0.001 >= Number(venda.total || 0) ? 'pago' : 'pendente'
  const { data, error } = await supabase.from('vendas_pdv').update({ status, restante: Math.max(Number(venda.total || 0) - pago, 0), pago }).eq('id', vendaId).select().single()
  if (error) throw error
  return data
}

export async function estornarVendaApi(vendaId, observacao = 'Extorno manual') {
  if (!hasSupabase) return atualizarPedidoLocal(vendaId, { status: 'cancelado', pago: 0, restante: 0, observacao: `EXTORNO: ${observacao}` })
  const { data: atual, error: leituraError } = await supabase.from('vendas_pdv').select('observacao').eq('id', vendaId).single()
  if (leituraError) throw leituraError
  const baseObs = String(atual.observacao || '').split('| EXTORNO:')[0].trim()
  const observacaoFinal = [baseObs, `EXTORNO: ${observacao}`].filter(Boolean).join(' | ')
  const { data, error } = await supabase.from('vendas_pdv').update({ status: 'cancelado', pago: 0, restante: 0, observacao: observacaoFinal }).eq('id', vendaId).select().single()
  if (error) throw error
  return data
}

export async function listarSaidasApi(caixaId = null) {
  if (!hasSupabase) {
    const saidas = carregarMovimentacoesLocal()
    return caixaId ? saidas.filter((item) => item.caixa_id === caixaId) : saidas
  }
  let query = supabase.from('saidas_caixa').select('*').order('criado_em', { ascending: false })
  if (caixaId) query = query.eq('caixa_id', caixaId)
  const [{ data, error }, mapa] = await Promise.all([query, mapaUsuariosPorId()])
  if (error) throw error
  return (data || []).map((item) => ({ ...item, ...mapa[item.usuario_id] }))
}

export async function listarCaixasApi() {
  if (!hasSupabase) return carregarCaixasLocal()
  const { data, error } = await supabase.from('caixas').select('*').order('data_abertura', { ascending: false })
  if (error) throw error
  return data || []
}

export async function listarVendasApi(caixaId = null) {
  if (!hasSupabase) {
    const vendas = carregarPedidosLocal().map(normalizarVendaLocal)
    return caixaId ? vendas.filter((item) => item.caixa_id === caixaId) : vendas
  }
  let query = supabase.from('vendas_pdv').select('*, pagamentos_venda_pdv(*), itens_venda_pdv(*)').order('criado_em', { ascending: false })
  if (caixaId) query = query.eq('caixa_id', caixaId)
  const [{ data, error }, mapa] = await Promise.all([query, mapaUsuariosPorId()])
  if (error) throw error
  return (data || []).map((item) => ({ ...item, ...mapa[item.usuario_id] }))
}

export async function buscarVendaPorNumeroPedidoApi({ caixaId = null, numeroPedido }) {
  const numero = formatarPedidoNumero(numeroPedido)
  if (!numero) return null
  if (!hasSupabase) {
    const vendas = carregarPedidosLocal().map(normalizarVendaLocal)
    return vendas.find((item) => item.numero_pedido === numero && (!caixaId || item.caixa_id === caixaId)) || null
  }
  let query = supabase
    .from('vendas_pdv')
    .select('*, pagamentos_venda_pdv(*), itens_venda_pdv(*)')
    .eq('numero_pedido', numero)
    .order('criado_em', { ascending: false })
    .limit(1)
  if (caixaId) query = query.eq('caixa_id', caixaId)
  const { data, error } = await query
  if (error) throw error
  return (data || [])[0] || null
}

export async function anexarTrocoMotoboyNaVendaApi({ caixaId = null, numeroPedido, observacaoTroco }) {
  const numero = formatarPedidoNumero(numeroPedido)
  if (!numero) return null
  if (!hasSupabase) {
    const venda = await buscarVendaPorNumeroPedidoApi({ caixaId, numeroPedido: numero })
    if (!venda?.id) return null
    return atualizarPedidoLocal(venda.id, { observacao: montarObservacaoComTroco(venda.observacao, observacaoTroco) })
  }
  const venda = await buscarVendaPorNumeroPedidoApi({ caixaId, numeroPedido: numero })
  if (!venda?.id) return null
  const { data, error } = await supabase
    .from('vendas_pdv')
    .update({ observacao: montarObservacaoComTroco(venda.observacao, observacaoTroco) })
    .eq('id', venda.id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function obterResumoCaixaApi(caixaId) {
  if (!hasSupabase) {
    const pedidos = carregarPedidosLocal().filter((item) => item.status === 'pago' && item.caixa_id === caixaId)
    const saidas = carregarMovimentacoesLocal().filter((item) => item.caixa_id === caixaId)
    const caixa = carregarCaixasLocal().find((item) => item.id === caixaId)
    const entradasDinheiro = pedidos.reduce((s, item) => s + somarPagamentosPorForma(item, 'dinheiro'), 0)
    const entradasPix = pedidos.reduce((s, item) => s + somarPagamentosPorForma(item, 'pix'), 0)
    const entradasCredito = pedidos.reduce((s, item) => s + somarPagamentosPorForma(item, 'credito'), 0)
    const entradasDebito = pedidos.reduce((s, item) => s + somarPagamentosPorForma(item, 'debito'), 0)
    const entradasTotais = entradasDinheiro + entradasPix + entradasCredito + entradasDebito
    const totalSaidas = saidas.reduce((s, item) => s + Number(item.valor || 0), 0)
    const abertura = Number(caixa?.valor_inicial || 0)
    return { abertura, entradasDinheiro, entradasPix, entradasCredito, entradasDebito, entradasTotais, totalSaidas, valorSistema: abertura + entradasDinheiro - totalSaidas }
  }
  const [vendasRes, saidasRes, caixaRes] = await Promise.all([
    supabase.from('vendas_pdv').select('pago,total,status,pagamentos_venda_pdv(forma_pagamento,valor_pago)').eq('caixa_id', caixaId).eq('status', 'pago'),
    supabase.from('saidas_caixa').select('valor').eq('caixa_id', caixaId),
    supabase.from('caixas').select('valor_abertura').eq('id', caixaId).maybeSingle(),
  ])
  if (vendasRes.error) throw vendasRes.error
  if (saidasRes.error) throw saidasRes.error
  if (caixaRes.error) throw caixaRes.error
  const vendas = vendasRes.data || []
  const entradasDinheiro = vendas.reduce((s, item) => s + somarPagamentosPorForma(item, 'dinheiro'), 0)
  const entradasPix = vendas.reduce((s, item) => s + somarPagamentosPorForma(item, 'pix'), 0)
  const entradasCredito = vendas.reduce((s, item) => s + somarPagamentosPorForma(item, 'credito'), 0)
  const entradasDebito = vendas.reduce((s, item) => s + somarPagamentosPorForma(item, 'debito'), 0)
  const entradasTotais = entradasDinheiro + entradasPix + entradasCredito + entradasDebito
  const totalSaidas = (saidasRes.data || []).reduce((s, item) => s + Number(item.valor || 0), 0)
  const abertura = Number(caixaRes.data?.valor_abertura || 0)
  return { abertura, entradasDinheiro, entradasPix, entradasCredito, entradasDebito, entradasTotais, totalSaidas, valorSistema: abertura + entradasDinheiro - totalSaidas }
}

function intervaloDeHoje() {
  const inicio = new Date()
  inicio.setHours(0, 0, 0, 0)
  const fim = new Date()
  fim.setHours(23, 59, 59, 999)
  return { inicio: inicio.toISOString(), fim: fim.toISOString() }
}



function montarPayloadFechamentoMotoca(item) {
  return {
    nome: item.nome,
    entregas_normais: Number(item.entregas_normais || 0),
    entregas_distantes: Number(item.entregas_distantes || 0),
    entregas_dinheiro: Number(item.entregas_dinheiro || 0),
    entregas_cartao: Number(item.entregas_cartao || 0),
    entregas_pix: Number(item.entregas_pix || 0),
    valor_normal: parseNumero(item.valor_normal),
    valor_distante: parseNumero(item.valor_distante),
    dinheiro_entregue: parseNumero(item.dinheiro_entregue),
    total: parseNumero(item.total),
    forma_recebimento: item.forma_recebimento || 'dinheiro',
    divergencia: Boolean(item.divergencia),
    motivo_divergencia: item.motivo_divergencia || null,
    conferido_por_nome: item.conferido_por_nome || null,
    conferido_por_tipo: item.conferido_por_tipo || null,
    total_entregas_sistema: Number(item.total_entregas_sistema || 0),
    total_entregas_informadas: Number(item.total_entregas_informadas || 0),
    pagamentos_dinheiro_sistema: Number(item.pagamentos_dinheiro_sistema || 0),
    pagamentos_cartao_sistema: Number(item.pagamentos_cartao_sistema || 0),
    pagamentos_pix_sistema: Number(item.pagamentos_pix_sistema || 0),
    pagamentos_dinheiro_informados: Number(item.pagamentos_dinheiro_informados || 0),
    pagamentos_cartao_informados: Number(item.pagamentos_cartao_informados || 0),
    pagamentos_pix_informados: Number(item.pagamentos_pix_informados || 0),
    portal_total_entregas: Number(item.portal_total_entregas || 0),
    portal_total_receber: Number(item.portal_total_receber || 0),
    portal_total_dinheiro_entregue: Number(item.portal_total_dinheiro_entregue || 0),
    portal_dinheiro: Number(item.portal_dinheiro || 0),
    portal_cartao: Number(item.portal_cartao || 0),
    portal_pix: Number(item.portal_pix || 0),
  }
}

export async function listarMotoboysFechamentoApi() {
  if (!hasSupabase) return carregarMotoboysFechamentoLocal()
  const { data, error } = await supabase.from('motoboys_fechamento').select('*').order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

export async function salvarMotoboysFechamentoApi(registros = []) {
  const payload = (registros || []).filter((item) => String(item.nome || '').trim())
  if (!payload.length) return []
  if (!hasSupabase) return salvarMotoboysFechamentoLocal(payload)
  const { data, error } = await supabase.from('motoboys_fechamento').insert(payload.map(montarPayloadFechamentoMotoca)).select()
  if (error) throw error
  return data || []
}

export async function substituirMotoboysFechamentoHojeApi(registros = []) {
  const payload = (registros || []).filter((item) => String(item.nome || '').trim())
  if (!payload.length) return []
  if (!hasSupabase) return substituirMotoboysFechamentoDoDiaLocal(payload)
  const { inicio, fim } = intervaloDeHoje()
  const { error: deleteError } = await supabase
    .from('motoboys_fechamento')
    .delete()
    .gte('created_at', inicio)
    .lte('created_at', fim)
  if (deleteError) throw deleteError
  const { data, error } = await supabase.from('motoboys_fechamento').insert(payload.map(montarPayloadFechamentoMotoca)).select()
  if (error) throw error
  return data || []
}

export async function listarMotoboysApi() {
  if (!hasSupabase) return carregarMotoboysLocal()
  const { data, error } = await supabase.from('motoboys').select('*').order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

export async function cadastrarMotoboyApi(payload) {
  if (!hasSupabase) return cadastrarMotoboyLocal(payload)
  try {
    const nome = String(payload?.nome || '').trim()
    const senha = String(payload?.senha || '').trim()
    const { data: existe } = await supabase.from('motoboys').select('id').eq('nome', nome).maybeSingle()
    if (existe) return { ok: false, erro: 'Já existe um motoboy com esse nome/apelido.' }
    const { data, error } = await supabase.from('motoboys').insert({ nome, senha, ativo: true }).select().single()
    if (error) throw error
    return { ok: true, motoboy: data }
  } catch (error) {
    return { ok: false, erro: error.message || 'Falha ao cadastrar motoboy.' }
  }
}

export async function autenticarMotoboyApi(nome, senha) {
  if (!hasSupabase) return autenticarMotoboyLocal(nome, senha)
  try {
    const { data, error } = await supabase.from('motoboys').select('*').eq('nome', String(nome || '').trim()).eq('senha', String(senha || '').trim()).eq('ativo', true).maybeSingle()
    if (error) throw error
    if (!data) return { ok: false, erro: 'Motoboy ou senha inválidos.' }
    return { ok: true, motoboy: data }
  } catch (error) {
    return { ok: false, erro: error.message || 'Falha ao entrar como motoboy.' }
  }
}

export async function salvarFechamentoMotoboyApi(registro) {
  const nome = String(registro?.nome || '').trim()
  if (!nome) throw new Error('Informe o nome do motoboy.')
  if (!hasSupabase) return salvarFechamentoMotoboyDoDiaLocal(registro)
  const { inicio, fim } = intervaloDeHoje()
  const { error: deleteError } = await supabase.from('motoboys_fechamento').delete().eq('nome', nome).gte('created_at', inicio).lte('created_at', fim)
  if (deleteError) throw deleteError
  const { data, error } = await supabase.from('motoboys_fechamento').insert(montarPayloadFechamentoMotoca(registro)).select().single()
  if (error) throw error
  return data
}

export async function carregarConfigApi() { return carregarConfigLocal() }
export async function salvarConfigApi(config) { return salvarConfigLocal(config) }
export async function carregarMotocasConfigApi() {
  if (!hasSupabase) return carregarMotocasConfigLocal()
  return carregarMotocasConfigSupabaseOuLocal()
}
export async function salvarMotocasConfigApi(config) {
  if (!hasSupabase) return salvarMotocasConfigLocal(config)
  return salvarMotocasConfigSupabaseOuLocal(config)
}

export async function listarPrestacoesPortalMotocaApi() {
  if (!hasSupabase) return carregarPrestacoesPortalMotocaLocal()
  return listarPrestacoesPortalSupabaseOuLocal()
}

export async function salvarPrestacaoPortalMotocaApi(registro) {
  if (!hasSupabase) return salvarPrestacaoPortalMotocaDoDiaLocal(registro)
  return salvarPrestacaoPortalSupabaseOuLocal(registro)
}

export async function finalizarPrestacaoPortalMotocaApi(nome) {
  if (!hasSupabase) return finalizarPrestacaoPortalMotocaDoDiaLocal(nome)
  return finalizarPrestacaoPortalSupabaseOuLocal(nome)
}
