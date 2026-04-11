import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  autenticarMotoboyApi,
  cadastrarMotoboyApi,
  carregarMotocasConfigApi,
  listarPrestacoesPortalMotocaApi,
  salvarPrestacaoPortalMotocaApi,
  finalizarPrestacaoPortalMotocaApi,
} from '../lib/api'
import { dataHoraBR, formatarMoeda, mascararMoedaInput, nomeFormaPagamento, nomeOrigem, parseNumero } from '../lib/utils'

const SESSAO_KEY = 'speedpdv_motoca_portal'

function ehHoje(data) {
  const atual = new Date()
  const valor = new Date(data)
  if (Number.isNaN(valor.getTime())) return false
  return valor.getFullYear() === atual.getFullYear() && valor.getMonth() === atual.getMonth() && valor.getDate() === atual.getDate()
}

function moedaInput(valor) {
  if (!valor && valor !== 0) return ''
  return mascararMoedaInput(String(Math.round(Number(valor || 0) * 100)))
}

function criarEntrega(base = {}) {
  const id = base.id || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `entrega-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`)
  return {
    id,
    tipo_corrida: base.tipo_corrida || 'normal',
    numero_pedido: base.numero_pedido || '',
    origem: base.origem || 'goomer',
    cliente_nome: base.cliente_nome || '',
    valor_total: moedaInput(base.valor_total),
    pagamento_principal: base.pagamento_principal || base.forma_pagamento_principal || 'dinheiro',
    valor_dinheiro: moedaInput(base.valor_dinheiro),
    valor_cartao: moedaInput(base.valor_cartao),
    valor_pix: moedaInput(base.valor_pix),
    maquininha_usada: base.maquininha_usada || '',
    troco_para: moedaInput(base.troco_para),
    troco_cliente: moedaInput(base.troco_cliente),
    observacao: base.observacao || '',
  }
}

function criarDraft(salvoHoje = null) {
  const entregas = Array.isArray(salvoHoje?.entregas_detalhe) && salvoHoje.entregas_detalhe.length
    ? salvoHoje.entregas_detalhe.map((item) => aplicarRegrasEntrega(criarEntrega(item)))
    : [aplicarRegrasEntrega(criarEntrega())]
  return {
    forma_recebimento: salvoHoje?.forma_recebimento || 'dinheiro',
    maquininha_padrao: salvoHoje?.maquininha_padrao || salvoHoje?.maquininha_usada || '',
    observacao_geral: salvoHoje?.observacao_geral || '',
    entregas,
  }
}

function pagamentoTemDinheiro(item) {
  return item.pagamento_principal === 'dinheiro' || item.pagamento_principal === 'misto'
}

function baseTrocoEntrega(item) {
  if (item.pagamento_principal === 'misto') {
    return parseNumero(item.valor_dinheiro)
  }
  return parseNumero(item.valor_total)
}

function calcularTrocoEntrega(item) {
  if (!pagamentoTemDinheiro(item)) return 0
  const trocoPara = parseNumero(item.troco_para)
  const base = baseTrocoEntrega(item)
  if (trocoPara <= 0 || base <= 0 || trocoPara <= base) return 0
  return trocoPara - base
}

function aplicarRegrasEntrega(item) {
  const proximo = { ...item }
  if (proximo.pagamento_principal !== 'misto') {
    proximo.valor_dinheiro = ''
    proximo.valor_cartao = ''
    proximo.valor_pix = ''
  }
  if (!pagamentoTemDinheiro(proximo)) {
    proximo.troco_para = ''
    proximo.troco_cliente = ''
  } else {
    const trocoCalculado = calcularTrocoEntrega(proximo)
    proximo.troco_cliente = trocoCalculado > 0 ? moedaInput(trocoCalculado) : moedaInput(0)
  }
  return proximo
}

function resumoDetalhado(entregas = [], config = {}) {
  return (entregas || []).reduce((acc, item) => {
    const tipoCorrida = item.tipo_corrida || 'normal'
    const valorTotal = parseNumero(item.valor_total)
    const valorDinheiro = item.pagamento_principal === 'misto'
      ? parseNumero(item.valor_dinheiro)
      : item.pagamento_principal === 'dinheiro'
        ? valorTotal
        : 0
    const valorCartao = item.pagamento_principal === 'misto' ? parseNumero(item.valor_cartao) : 0
    const valorPix = item.pagamento_principal === 'misto' ? parseNumero(item.valor_pix) : 0

    if (tipoCorrida === 'distante') acc.distantes += 1
    else acc.normais += 1

    if (item.pagamento_principal === 'dinheiro') acc.dinheiro += 1
    if (item.pagamento_principal === 'cartao') acc.cartao += 1
    if (item.pagamento_principal === 'pix') acc.pix += 1
    if (item.pagamento_principal === 'misto') {
      if (valorDinheiro > 0) acc.dinheiro += 1
      if (valorCartao > 0) acc.cartao += 1
      if (valorPix > 0) acc.pix += 1
      acc.mistas += 1
    }

    acc.totalEntregas += 1
    acc.totalReceber += tipoCorrida === 'distante'
      ? Number(config.valor_entrega_distante || 0)
      : Number(config.valor_entrega_normal || 0)
    acc.totalContas += valorTotal
    acc.dinheiroEntregue += valorDinheiro
    acc.totalTrocoPara += parseNumero(item.troco_para)
    acc.totalTrocoCliente += parseNumero(item.troco_cliente)
    if (item.observacao?.trim()) acc.observacoes += 1
    return acc
  }, {
    totalEntregas: 0,
    normais: 0,
    distantes: 0,
    dinheiro: 0,
    cartao: 0,
    pix: 0,
    mistas: 0,
    totalReceber: 0,
    totalContas: 0,
    dinheiroEntregue: 0,
    totalTrocoPara: 0,
    totalTrocoCliente: 0,
    observacoes: 0,
  })
}

function formaPredominante(entregas = []) {
  const totais = entregas.reduce((acc, item) => {
    const forma = item.pagamento_principal || 'nao_informado'
    acc[forma] = (acc[forma] || 0) + 1
    return acc
  }, {})
  return Object.entries(totais).sort((a, b) => b[1] - a[1])[0]?.[0] || 'dinheiro'
}

function entregaPreenchida(item) {
  return Boolean(
    item.numero_pedido
    || item.cliente_nome
    || parseNumero(item.valor_total)
    || item.maquininha_usada
    || item.observacao
    || parseNumero(item.troco_para)
    || parseNumero(item.troco_cliente)
  )
}

export default function MotoboyPortalPage() {
  const [aba, setAba] = useState('login')
  const [mensagem, setMensagem] = useState('')
  const [motoboy, setMotoboy] = useState(() => {
    const bruto = sessionStorage.getItem(SESSAO_KEY)
    return bruto ? JSON.parse(bruto) : null
  })
  const [cadastro, setCadastro] = useState({ nome: '', senha: '', confirmarSenha: '' })
  const [login, setLogin] = useState({ nome: '', senha: '' })
  const [config, setConfig] = useState({ quantidade_motoboys: 4, valor_entrega_normal: 7, valor_entrega_distante: 10 })
  const [draft, setDraft] = useState(criarDraft())
  const [prestacaoSalva, setPrestacaoSalva] = useState(null)
  const [trampoFinalizado, setTrampoFinalizado] = useState(null)
  const [carregando, setCarregando] = useState(false)
  const [mostrarDetalhe, setMostrarDetalhe] = useState(false)
  const [modoEdicao, setModoEdicao] = useState(true)
  const [quantidadeAdicionar, setQuantidadeAdicionar] = useState('1')

  useEffect(() => {
    if (motoboy) sessionStorage.setItem(SESSAO_KEY, JSON.stringify(motoboy))
    else sessionStorage.removeItem(SESSAO_KEY)
  }, [motoboy])

  useEffect(() => {
    async function carregarDados() {
      if (!motoboy) return
      try {
        setCarregando(true)
        const [cfg, prestacoes] = await Promise.all([
          carregarMotocasConfigApi(),
          listarPrestacoesPortalMotocaApi(),
        ])
        setConfig(cfg)
        const salvoHoje = (prestacoes || []).find((item) => ehHoje(item.created_at || item.criado_em) && String(item.nome || '').trim().toLowerCase() === String(motoboy.nome || '').trim().toLowerCase())
        if (salvoHoje?.finalizado) {
          setTrampoFinalizado(salvoHoje)
          setPrestacaoSalva(null)
          setDraft(criarDraft())
          setModoEdicao(true)
          setMostrarDetalhe(false)
        } else {
          setTrampoFinalizado(null)
          setPrestacaoSalva(salvoHoje || null)
          setDraft(criarDraft(salvoHoje))
          setModoEdicao(true)
          setMostrarDetalhe(Boolean(salvoHoje))
        }
      } catch (error) {
        setMensagem(error.message || 'Falha ao carregar portal do motoca.')
      } finally {
        setCarregando(false)
      }
    }
    carregarDados()
  }, [motoboy])

  const resumoAtual = useMemo(() => resumoDetalhado(draft.entregas, config), [draft, config])

  function atualizarEntrega(id, campo, valor) {
    setDraft((atual) => ({
      ...atual,
      entregas: atual.entregas.map((item) => {
        if (item.id !== id) return item
        const tratado = ['valor_total', 'valor_dinheiro', 'valor_cartao', 'valor_pix', 'troco_para', 'troco_cliente'].includes(campo)
          ? mascararMoedaInput(valor)
          : valor
        return aplicarRegrasEntrega({ ...item, [campo]: tratado })
      }),
    }))
  }

  function adicionarEntregas(qtd = 1) {
    const quantidade = Math.max(1, Math.min(10, Number(qtd || 1)))
    setDraft((atual) => ({
      ...atual,
      entregas: [
        ...atual.entregas,
        ...Array.from({ length: quantidade }, () => aplicarRegrasEntrega(criarEntrega({ maquininha_usada: atual.maquininha_padrao || '' }))),
      ],
    }))
    setModoEdicao(true)
  }

  function removerEntrega(id) {
    setDraft((atual) => {
      const restantes = atual.entregas.filter((item) => item.id !== id)
      return { ...atual, entregas: restantes.length ? restantes : [criarEntrega({ maquininha_usada: atual.maquininha_padrao || '' })] }
    })
  }

  async function cadastrar(e) {
    e.preventDefault()
    setMensagem('')
    if (cadastro.nome.trim().length < 3) return setMensagem('Use nome ou apelido com pelo menos 3 caracteres.')
    if (!/^\d{4}$/.test(cadastro.senha.trim())) return setMensagem('A senha do motoca deve ter exatamente 4 dígitos numéricos.')
    if (cadastro.senha !== cadastro.confirmarSenha) return setMensagem('A confirmação de senha não confere.')
    const resposta = await cadastrarMotoboyApi({ nome: cadastro.nome.trim(), senha: cadastro.senha.trim() })
    if (!resposta.ok) return setMensagem(resposta.erro)
    setMensagem('Cadastro criado. Agora entre com seu nome e senha.')
    setCadastro({ nome: '', senha: '', confirmarSenha: '' })
    setLogin({ nome: resposta.motoboy?.nome || cadastro.nome.trim(), senha: '' })
    setAba('login')
  }

  async function entrar(e) {
    e.preventDefault()
    setMensagem('')
    const resposta = await autenticarMotoboyApi(login.nome.trim(), login.senha.trim())
    if (!resposta.ok) return setMensagem(resposta.erro)
    setMotoboy(resposta.motoboy)
  }

  async function salvarPrestacao(e) {
    e.preventDefault()
    if (!motoboy) return
    try {
      setCarregando(true)
      const entregasDetalhe = draft.entregas.map((item, index) => ({
        id: item.id,
        ordem: index + 1,
        tipo_corrida: item.tipo_corrida || 'normal',
        numero_pedido: item.numero_pedido || '',
        origem: item.origem || 'goomer',
        cliente_nome: item.cliente_nome || '',
        valor_total: parseNumero(item.valor_total),
        pagamento_principal: item.pagamento_principal || 'dinheiro',
        valor_dinheiro: parseNumero(item.valor_dinheiro),
        valor_cartao: parseNumero(item.valor_cartao),
        valor_pix: parseNumero(item.valor_pix),
        maquininha_usada: item.maquininha_usada || draft.maquininha_padrao || '',
        troco_para: parseNumero(item.troco_para),
        troco_cliente: parseNumero(item.troco_cliente),
        observacao: item.observacao || '',
      }))
      const resumo = resumoDetalhado(entregasDetalhe, config)
      const primeiroItem = entregasDetalhe[0] || {}
      const salvo = await salvarPrestacaoPortalMotocaApi({
        motoboy_id: motoboy.id,
        nome: motoboy.nome,
        entregas_normais: resumo.normais,
        entregas_distantes: resumo.distantes,
        entregas_dinheiro: resumo.dinheiro,
        entregas_cartao: resumo.cartao,
        entregas_pix: resumo.pix,
        valor_normal: Number(config.valor_entrega_normal || 0),
        valor_distante: Number(config.valor_entrega_distante || 0),
        dinheiro_entregue: resumo.dinheiroEntregue,
        forma_recebimento: draft.forma_recebimento,
        total: resumo.totalReceber,
        numero_pedido: primeiroItem.numero_pedido || '',
        origem: primeiroItem.origem || 'goomer',
        cliente_nome: primeiroItem.cliente_nome || '',
        valor_total: resumo.totalContas,
        forma_pagamento_principal: formaPredominante(entregasDetalhe),
        maquininha_usada: draft.maquininha_padrao || primeiroItem.maquininha_usada || '',
        troco_para: resumo.totalTrocoPara,
        troco_cliente: resumo.totalTrocoCliente,
        observacao: draft.observacao_geral || `Portal com ${resumo.totalEntregas} entrega(s) detalhada(s).`,
        observacao_geral: draft.observacao_geral,
        maquininha_padrao: draft.maquininha_padrao,
        entregas_detalhe: entregasDetalhe,
      })
      setTrampoFinalizado(null)
      setPrestacaoSalva(salvo)
      setDraft(criarDraft(salvo))
      setMostrarDetalhe(true)
      setModoEdicao(false)
      setMensagem(salvo?.editado ? 'Prestação atualizada com sucesso. Você pode continuar adicionando entregas até o fim da noite e finalizar o trampo depois.' : 'Prestação salva com sucesso. Você pode continuar lançando entregas, editar quando precisar e finalizar o trampo no fim da noite.')
    } catch (error) {
      setMensagem(error.message || 'Falha ao salvar prestação de contas.')
    } finally {
      setCarregando(false)
    }
  }

  async function finalizarTrampo() {
    if (!motoboy || !prestacaoSalva) return
    const confirmar = typeof window === 'undefined' || window.confirm('Finalizar trampo agora? O responsável ainda poderá puxar a sua última prestação, mas o seu portal vai zerar o histórico do dia.')
    if (!confirmar) return
    try {
      setCarregando(true)
      const finalizado = await finalizarPrestacaoPortalMotocaApi(motoboy.nome)
      setTrampoFinalizado(finalizado)
      setPrestacaoSalva(null)
      setDraft(criarDraft())
      setMostrarDetalhe(false)
      setModoEdicao(true)
      setMensagem('Trampo finalizado. O histórico do dia foi zerado no portal, mas o responsável ainda consegue puxar a sua última prestação.')
    } catch (error) {
      setMensagem(error.message || 'Falha ao finalizar o trampo.')
    } finally {
      setCarregando(false)
    }
  }

  function reabrirTrampo() {
    if (!trampoFinalizado) return
    setPrestacaoSalva({ ...trampoFinalizado, finalizado: false, finalizado_em: null })
    setDraft(criarDraft({ ...trampoFinalizado, finalizado: false, finalizado_em: null }))
    setTrampoFinalizado(null)
    setModoEdicao(true)
    setMostrarDetalhe(false)
    setMensagem('Turno reaberto. Você pode continuar lançando, editar e salvar de novo.')
  }

  return (
    <div className="auth-page">
      <div className="auth-card motoca-portal-card">
        <div className="brand-center">
          <img src="/logo-speedburger.png" alt="Logo Speed Burger" className="login-logo" />
          <h1>Portal do motoca</h1>
          <p>Preencha as entregas do seu dia. O responsável usa isso para conferir melhor e proteger você e o estabelecimento.</p>
          <small><Link to="/login">Voltar ao login principal</Link></small>
        </div>

        {mensagem && <div className="alert">{mensagem}</div>}

        {!motoboy ? (
          <>
            <div className="pill-group wrap-left">
              <button type="button" className={aba === 'login' ? 'pill active' : 'pill'} onClick={() => setAba('login')}>Entrar</button>
              <button type="button" className={aba === 'cadastro' ? 'pill active' : 'pill'} onClick={() => setAba('cadastro')}>Cadastrar</button>
            </div>

            {aba === 'login' ? (
              <form className="stack gap-sm" onSubmit={entrar}>
                <label>Nome ou apelido
                  <input value={login.nome} onChange={(e) => setLogin((atual) => ({ ...atual, nome: e.target.value }))} required />
                </label>
                <label>Senha de 4 dígitos
                  <input type="password" inputMode="numeric" maxLength={4} value={login.senha} onChange={(e) => setLogin((atual) => ({ ...atual, senha: e.target.value.replace(/\D/g, '').slice(0, 4) }))} required />
                </label>
                <button className="primary-btn btn-lg">Entrar no portal</button>
              </form>
            ) : (
              <form className="stack gap-sm" onSubmit={cadastrar}>
                <label>Nome ou apelido
                  <input value={cadastro.nome} onChange={(e) => setCadastro((atual) => ({ ...atual, nome: e.target.value }))} required />
                </label>
                <label>Senha de 4 dígitos
                  <input type="password" inputMode="numeric" maxLength={4} value={cadastro.senha} onChange={(e) => setCadastro((atual) => ({ ...atual, senha: e.target.value.replace(/\D/g, '').slice(0, 4) }))} required />
                </label>
                <label>Confirmar senha
                  <input type="password" inputMode="numeric" maxLength={4} value={cadastro.confirmarSenha} onChange={(e) => setCadastro((atual) => ({ ...atual, confirmarSenha: e.target.value.replace(/\D/g, '').slice(0, 4) }))} required />
                </label>
                <button className="primary-btn btn-lg">Criar meu acesso</button>
              </form>
            )}
          </>
        ) : (
          <div className="stack gap-md">
            <div className="item-actions wrap-actions between-actions">
              <div>
                <h2 className="portal-user-title">{motoboy.nome}</h2>
                <small className="muted">Os valores das corridas são definidos no menu Motocas. Aqui você registra as entregas do dia.</small>
              </div>
              <button type="button" className="ghost-btn" onClick={() => { setMotoboy(null); setPrestacaoSalva(null); setTrampoFinalizado(null); setDraft(criarDraft()); setMensagem('') }}>Sair do portal</button>
            </div>

            <div className="alert alert-soft">
              Faça uma entrega por vez. Você pode salvar durante a noite, voltar depois, editar e salvar de novo. Quando corrigir algo, o responsável verá que houve edição.
            </div>

            {trampoFinalizado && (
              <div className="panel compact-panel stack gap-sm">
                <div className="item-actions wrap-actions between-actions">
                  <div>
                    <h3>Trampo finalizado hoje</h3>
                    <small className="muted">Finalizado em {dataHoraBR(trampoFinalizado.finalizado_em || trampoFinalizado.updated_at || trampoFinalizado.created_at)}. O responsável ainda consegue puxar a última prestação salva.</small>
                  </div>
                  <button type="button" className="secondary-btn compact-btn" onClick={reabrirTrampo}>Reabrir turno</button>
                </div>
              </div>
            )}

            <div className="grid-4 compact-grid portal-summary-grid">
              <div className="mini-info"><span>Valor normal</span><strong>{formatarMoeda(config.valor_entrega_normal || 0)}</strong></div>
              <div className="mini-info"><span>Valor distante</span><strong>{formatarMoeda(config.valor_entrega_distante || 0)}</strong></div>
              <div className="mini-info"><span>Entregas lançadas</span><strong>{resumoAtual.totalEntregas}</strong><small>Normais {resumoAtual.normais} • Distantes {resumoAtual.distantes}</small></div>
              <div className="mini-info success-box"><span>Total a receber</span><strong>{formatarMoeda(resumoAtual.totalReceber)}</strong><small>Calculado automaticamente.</small></div>
            </div>

            <div className="pill-group wrap-left">
              <button type="button" className={modoEdicao ? 'pill active' : 'pill'} onClick={() => setModoEdicao(true)}>Editar / preencher</button>
              <button type="button" className={!modoEdicao ? 'pill active' : 'pill'} onClick={() => { setModoEdicao(false); setMostrarDetalhe(true) }} disabled={!prestacaoSalva}>Visualizar envio</button>
              <button type="button" className="pill warning" onClick={finalizarTrampo} disabled={!prestacaoSalva || carregando}>Finalizar trampo</button>
            </div>

            {modoEdicao && (
              <form className="stack gap-sm" onSubmit={salvarPrestacao}>
                <div className="panel compact-panel stack gap-sm">
                  <h3>Antes de começar</h3>
                  <div className="grid-3 compact-grid">
                    <label>Receber corridas em
                      <select value={draft.forma_recebimento} onChange={(e) => setDraft((atual) => ({ ...atual, forma_recebimento: e.target.value }))}>
                        <option value="dinheiro">Dinheiro</option>
                        <option value="pix">Pix</option>
                      </select>
                    </label>
                    <label>Maquininha inicial / padrão
                      <input value={draft.maquininha_padrao} onChange={(e) => setDraft((atual) => ({ ...atual, maquininha_padrao: e.target.value }))} placeholder="Ex.: azul, verde, Ton 1, balcão" />
                    </label>
                    <label>Adicionar mais entregas
                      <div className="inline-mini">
                        <input type="number" min="1" max="10" value={quantidadeAdicionar} onChange={(e) => setQuantidadeAdicionar(e.target.value)} />
                        <button type="button" className="secondary-btn compact-btn" onClick={() => adicionarEntregas(quantidadeAdicionar)}>Adicionar</button>
                      </div>
                    </label>
                  </div>
                  <label>Observação geral do turno (opcional)
                    <textarea value={draft.observacao_geral} onChange={(e) => setDraft((atual) => ({ ...atual, observacao_geral: e.target.value }))} rows={2} placeholder="Ex.: comecei com a maquininha azul, depois troquei para a verde por falta de bateria." />
                  </label>
                </div>

                <div className="stack gap-sm">
                  {draft.entregas.map((item, index) => {
                    const mostrarTroco = pagamentoTemDinheiro(item)
                    const mostrarMisto = item.pagamento_principal === 'misto'
                    return (
                      <div className="panel compact-panel stack gap-sm" key={item.id}>
                        <div className="item-actions wrap-actions between-actions">
                          <div>
                            <h3>Entrega {index + 1}</h3>
                            <small className="muted">{entregaPreenchida(item) ? 'Já tem dados lançados.' : 'Ainda vazia.'}</small>
                          </div>
                          <div className="pill-group wrap-left">
                            <span className={entregaPreenchida(item) ? 'badge success' : 'badge'}>{entregaPreenchida(item) ? 'Preenchida' : 'Em aberto'}</span>
                            <button type="button" className="ghost-btn compact-btn" onClick={() => atualizarEntrega(item.id, 'maquininha_usada', draft.maquininha_padrao || '')}>Usar maquininha padrão</button>
                            <button type="button" className="danger-btn compact-btn" onClick={() => removerEntrega(item.id)}>Remover</button>
                          </div>
                        </div>

                        <div className="grid-3 compact-grid">
                          <label>Nome do cliente
                            <input value={item.cliente_nome} onChange={(e) => atualizarEntrega(item.id, 'cliente_nome', e.target.value)} placeholder="Opcional, mas ajuda a conferir" />
                          </label>
                          <label>Número do pedido / comanda
                            <input value={item.numero_pedido} onChange={(e) => atualizarEntrega(item.id, 'numero_pedido', e.target.value.replace(/[^0-9]/g, ''))} placeholder="Ex.: 0058 ou 1534403" />
                          </label>
                          <label>Origem
                            <select value={item.origem} onChange={(e) => atualizarEntrega(item.id, 'origem', e.target.value)}>
                              <option value="goomer">Goomer</option>
                              <option value="ceofood">Ceofood</option>
                            </select>
                          </label>
                          <label>Corrida
                            <select value={item.tipo_corrida} onChange={(e) => atualizarEntrega(item.id, 'tipo_corrida', e.target.value)}>
                              <option value="normal">Normal</option>
                              <option value="distante">Distante</option>
                            </select>
                          </label>
                          <label>Valor da conta / entrega
                            <input value={item.valor_total} onChange={(e) => atualizarEntrega(item.id, 'valor_total', e.target.value)} inputMode="numeric" placeholder="0,00" />
                          </label>
                          <label>Pagamento
                            <select value={item.pagamento_principal} onChange={(e) => atualizarEntrega(item.id, 'pagamento_principal', e.target.value)}>
                              <option value="dinheiro">Dinheiro</option>
                              <option value="pix">Pix</option>
                              <option value="cartao">Cartão</option>
                              <option value="misto">Misto</option>
                            </select>
                          </label>
                          <label>Maquininha usada
                            <input value={item.maquininha_usada} onChange={(e) => atualizarEntrega(item.id, 'maquininha_usada', e.target.value)} placeholder="Ex.: azul, verde, Ton 1, balcão" />
                          </label>
                          {mostrarTroco ? (
                            <label>Troco para quanto?
                              <input value={item.troco_para} onChange={(e) => atualizarEntrega(item.id, 'troco_para', e.target.value)} inputMode="numeric" placeholder="Ex.: 50,00" />
                            </label>
                          ) : <div />}
                          {mostrarTroco ? (
                            <label>Troco calculado para o cliente
                              <input value={item.troco_cliente} readOnly inputMode="numeric" placeholder="Calculado automaticamente" />
                              <small className="muted">O sistema calcula sozinho com base no valor da conta e no “troco para quanto?”.</small>
                            </label>
                          ) : <div />}
                        </div>

                        {mostrarMisto && (
                          <div className="grid-3 compact-grid portal-misto-grid">
                            <label>Valor em dinheiro
                              <input value={item.valor_dinheiro} onChange={(e) => atualizarEntrega(item.id, 'valor_dinheiro', e.target.value)} inputMode="numeric" placeholder="0,00" />
                            </label>
                            <label>Valor em cartão
                              <input value={item.valor_cartao} onChange={(e) => atualizarEntrega(item.id, 'valor_cartao', e.target.value)} inputMode="numeric" placeholder="0,00" />
                            </label>
                            <label>Valor em pix
                              <input value={item.valor_pix} onChange={(e) => atualizarEntrega(item.id, 'valor_pix', e.target.value)} inputMode="numeric" placeholder="0,00" />
                            </label>
                          </div>
                        )}

                        <label>Observação da entrega
                          <textarea value={item.observacao} onChange={(e) => atualizarEntrega(item.id, 'observacao', e.target.value)} rows={2} placeholder="Ex.: cliente mudou a forma de pagamento, troquei a maquininha, pedido conferido por valor." />
                        </label>
                      </div>
                    )
                  })}
                </div>

                <div className="panel compact-panel stack gap-sm">
                  <h3>Resumo automático</h3>
                  <div className="grid-4 compact-grid portal-summary-grid">
                    <div className="mini-info"><span>Normais</span><strong>{resumoAtual.normais}</strong></div>
                    <div className="mini-info"><span>Distantes</span><strong>{resumoAtual.distantes}</strong></div>
                    <div className="mini-info"><span>Pagamentos</span><strong>Dinheiro {resumoAtual.dinheiro} • Cartão {resumoAtual.cartao} • Pix {resumoAtual.pix}</strong><small>{resumoAtual.mistas ? `${resumoAtual.mistas} entrega(s) mistas.` : 'Sem entrega mista.'}</small></div>
                    <div className="mini-info success-box"><span>Total a receber</span><strong>{formatarMoeda(resumoAtual.totalReceber)}</strong><small>Calculado pelas corridas do dia.</small></div>
                  </div>
                  <button className="primary-btn btn-lg" disabled={carregando}>Salvar minha prestação de contas</button>
                  <small className="muted">Ao salvar, você continua podendo adicionar mais entregas até o fim da noite. Quando acabar, use “Finalizar trampo” para zerar o histórico do dia no seu portal.</small>
                </div>
              </form>
            )}

            {prestacaoSalva && mostrarDetalhe && (
              <div className="panel compact-panel stack gap-sm">
                <div className="item-actions wrap-actions between-actions">
                  <div>
                    <h3>Visualizar envio</h3>
                    <small className="muted">Confira o que foi salvo hoje. Se precisar corrigir, volte em “Editar / preencher”.</small>
                  </div>
                  <span className={prestacaoSalva.editado ? 'badge warning' : 'badge success'}>{prestacaoSalva.editado ? 'Editado hoje' : 'Salvo hoje'}</span>
                </div>
                <div className="grid-4 compact-grid portal-summary-grid">
                  <div className="mini-info"><span>Horário</span><strong>{dataHoraBR(prestacaoSalva.updated_at || prestacaoSalva.created_at)}</strong></div>
                  <div className="mini-info"><span>Entregas</span><strong>{prestacaoSalva.entregas_detalhe?.length || (Number(prestacaoSalva.entregas_normais || 0) + Number(prestacaoSalva.entregas_distantes || 0))}</strong></div>
                  <div className="mini-info"><span>Receber em</span><strong>{nomeFormaPagamento(prestacaoSalva.forma_recebimento)}</strong></div>
                  <div className="mini-info success-box"><span>Total a receber</span><strong>{formatarMoeda(prestacaoSalva.total || 0)}</strong></div>
                </div>
                {prestacaoSalva.observacao_geral && <div className="alert alert-soft">{prestacaoSalva.observacao_geral}</div>}
                <div className="item-list compact-tall portal-delivery-list">
                  {(prestacaoSalva.entregas_detalhe || []).map((item, index) => (
                    <div className="item-row wrap-row readable-row portal-delivery-row" key={`salvo-${item.id || index}`}>
                      <div className="pedido-meta">
                        <strong>Entrega {index + 1} • {item.cliente_nome || 'Cliente opcional'}</strong>
                        <small>Pedido {item.numero_pedido || 'não informado'} • {nomeOrigem[item.origem] || item.origem || 'Sem origem'} • {item.tipo_corrida === 'distante' ? 'Distante' : 'Normal'}</small>
                        <small>{nomeFormaPagamento(item.pagamento_principal)} • Conta {formatarMoeda(item.valor_total || 0)} • Maquininha {item.maquininha_usada || 'não informada'}</small>
                        {(item.troco_para || item.troco_cliente) ? <small>Troco para {formatarMoeda(item.troco_para || 0)} • Troco dado {formatarMoeda(item.troco_cliente || 0)}</small> : null}
                        {item.observacao ? <small>{item.observacao}</small> : null}
                      </div>
                      <strong>{item.tipo_corrida === 'distante' ? formatarMoeda(config.valor_entrega_distante || 0) : formatarMoeda(config.valor_entrega_normal || 0)}</strong>
                    </div>
                  ))}
                </div>
                <div className="item-actions wrap-actions between-actions">
                  <button type="button" className="ghost-btn compact-btn" onClick={() => setModoEdicao(true)}>Editar o que salvei</button>
                  <button type="button" className="secondary-btn compact-btn" onClick={finalizarTrampo} disabled={carregando}>Finalizar trampo</button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
