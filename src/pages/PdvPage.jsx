import { useEffect, useMemo, useRef, useState } from 'react'
import ItemPedidoList from '../components/ItemPedidoList'
import NativeModal from '../components/NativeModal'
import InfoHint from '../components/InfoHint'
import PagamentoBox from '../components/PagamentoBox'
import { menuBase } from '../lib/menuBase'
import { obterSessao, podeAbrirFecharCaixa, tipoUsuarioLabel } from '../lib/auth'
import { abrirCaixaApi, anexarTrocoMotoboyNaVendaApi, autenticarUsuarioApi, buscarVendaPorNumeroPedidoApi, carregarConfigApi, carregarProdutosApi, existeTrocoMotoboyNoCaixaApi, fecharCaixaApi, listarSaidasApi, listarVendasApi, obterCaixaAbertoApi, obterResumoCaixaApi, registrarSaidaCaixaApi, registrarVendaApi } from '../lib/api'
import { dataHoraBR, extrairDadosTrocoMotoboy, formatarMoeda, formatarPedidoNumero, horaBR, mascararMoedaInput, nomeOrigem, normalizarTexto, parseNumero, pagamentosResumo, resumoPagamentoCurto, tocarSomAlerta } from '../lib/utils'

const tiposPedido = [
  { id: 'mesa', label: 'Mesa', resumo: 'Cliente pede no tablet, consome e paga no final.' },
  { id: 'balcao', label: 'Balcão', resumo: 'Cliente pede e paga no balcão.' },
  { id: 'retirada', label: 'Retirada', resumo: 'Pedido pronto para retirada, pago antes ou na retirada.' },
  { id: 'entrega', label: 'Entrega', resumo: 'Pedido recebido do Goomer ou Ceofood com taxa de entrega destacada.' },
]
const origens = ['goomer', 'ceofood', 'balcao']
const qtdOptions = Array.from({ length: 15 }, (_, i) => i + 1)

export default function PdvPage() {
  const usuario = obterSessao()
  const [abaCaixa, setAbaCaixa] = useState('operacao')
  const [config, setConfig] = useState({ mesas_ativas: ['2', '3', '4', '5'] })
  const [produtos, setProdutos] = useState([])
  const [tipoPedido, setTipoPedido] = useState('mesa')
  const [categoriaAtiva, setCategoriaAtiva] = useState('todos')
  const [busca, setBusca] = useState('')
  const [numeroPedido, setNumeroPedido] = useState('')
  const [mesa, setMesa] = useState('2')
  const [nomeCliente, setNomeCliente] = useState('')
  const [origem, setOrigem] = useState('goomer')
  const [observacao, setObservacao] = useState('')
  const [taxaEntrega, setTaxaEntrega] = useState('')
  const [itens, setItens] = useState([])
  const [pagamentos, setPagamentos] = useState([])
  const [mensagem, setMensagem] = useState('')
  const [valorAbertura, setValorAbertura] = useState('')
  const [valorFechamento, setValorFechamento] = useState('')
  const [moedasNaoContadas, setMoedasNaoContadas] = useState(false)
  const [caixaAtual, setCaixaAtual] = useState(null)
  const [resumoCaixa, setResumoCaixa] = useState(null)
  const [carregando, setCarregando] = useState(true)
  const [produtoSelecionado, setProdutoSelecionado] = useState(null)
  const [quantidadeSelecionada, setQuantidadeSelecionada] = useState(1)
  const [sangriaValor, setSangriaValor] = useState('')
  const [sangriaObs, setSangriaObs] = useState('')
  const [trocoMotoca, setTrocoMotoca] = useState({ motoboy: '', cliente: '', numeroPedido: '', valorConta: '', valorPara: '' })
  const [pedidoTrocoInfo, setPedidoTrocoInfo] = useState(null)
  const [trocosHistorico, setTrocosHistorico] = useState([])
  const [vendasCaixa, setVendasCaixa] = useState([])
  const [mensagemTipo, setMensagemTipo] = useState('info')
  const [senhaModal, setSenhaModal] = useState({ open: false, modo: 'abrir', senha: '', motivo: '' })
  const numeroPedidoRef = useRef(null)
  const clienteRef = useRef(null)
  const observacaoRef = useRef(null)
  const valorAberturaRef = useRef(null)
  const valorFechamentoRef = useRef(null)
  const draftKey = `speedpdv_draft_${usuario?.id || usuario?.usuario || 'anon'}`

  async function carregarApoioCaixa(caixaId = null) {
    if (!caixaId) {
      setVendasCaixa([])
      setTrocosHistorico([])
      return
    }
    const [vendas, saidas] = await Promise.all([
      listarVendasApi(caixaId),
      listarSaidasApi(caixaId),
    ])
    setVendasCaixa(vendas || [])
    setTrocosHistorico((saidas || []).filter((item) => item.tipo === 'troco_motoca'))
  }

  async function recarregarCaixa() {
    const caixaData = await obterCaixaAbertoApi(usuario)
    const caixaFormatado = caixaData ? { ...caixaData, valor_abertura: caixaData.valor_abertura ?? caixaData.valor_inicial ?? 0, data_abertura: caixaData.data_abertura || caixaData.abertura || null } : null
    setCaixaAtual(caixaFormatado)
    if (caixaData?.id) {
      const resumo = await obterResumoCaixaApi(caixaData.id)
      setResumoCaixa(resumo)
      await carregarApoioCaixa(caixaData.id)
    } else {
      setResumoCaixa(null)
      await carregarApoioCaixa(null)
    }
    return caixaFormatado
  }

  function avisar(texto, tipo = 'info', focusRef = null) {
    setMensagem(texto)
    setMensagemTipo(tipo)
    tocarSomAlerta(tipo)
    if (focusRef?.current) {
      setTimeout(() => { focusRef.current?.focus(); focusRef.current?.classList.add('field-error-flash'); setTimeout(() => focusRef.current?.classList.remove('field-error-flash'), 1600) }, 20)
    }
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function limparRascunhoPersistido() {
    sessionStorage.removeItem(draftKey)
    sessionStorage.setItem('speedpdv_pedido_em_edicao', 'false')
    window.dispatchEvent(new CustomEvent('speedpdv:rascunho', { detail: { emEdicao: false } }))
  }

  useEffect(() => {
    async function carregar() {
      try {
        const [configData, produtosData] = await Promise.all([
          carregarConfigApi(),
          carregarProdutosApi(),
        ])
        setConfig(configData)
        setMesa(configData.mesas_ativas?.[0] || '2')
        setProdutos((produtosData || []).filter((item) => item.ativo !== false))
        const salvo = sessionStorage.getItem(draftKey)
        if (salvo) {
          try {
            const draft = JSON.parse(salvo)
            setTipoPedido(draft.tipoPedido || 'mesa')
            setCategoriaAtiva(draft.categoriaAtiva || 'todos')
            setBusca(draft.busca || '')
            setNumeroPedido(draft.numeroPedido || '')
            setMesa(draft.mesa || configData.mesas_ativas?.[0] || '2')
            setNomeCliente(draft.nomeCliente || '')
            setOrigem(draft.origem || 'goomer')
            setObservacao(draft.observacao || '')
            setTaxaEntrega(draft.taxaEntrega || '')
            setItens(draft.itens || [])
            setPagamentos(draft.pagamentos || [])
          } catch {}
        }
        await recarregarCaixa()
      } catch (error) {
        setMensagem(error.message || 'Falha ao carregar dados do PDV.')
        setProdutos(menuBase)
      } finally {
        setCarregando(false)
      }
    }
    carregar()
  }, [usuario?.id])

  useEffect(() => {
    const temRascunho = Boolean(numeroPedido || nomeCliente || observacao || itens.length || pagamentos.length)
    sessionStorage.setItem('speedpdv_pedido_em_edicao', temRascunho ? 'true' : 'false')
    window.dispatchEvent(new CustomEvent('speedpdv:rascunho', { detail: { emEdicao: temRascunho } }))
    if (temRascunho) {
      sessionStorage.setItem(draftKey, JSON.stringify({
        tipoPedido,
        categoriaAtiva,
        busca,
        numeroPedido,
        mesa,
        nomeCliente,
        origem,
        observacao,
        taxaEntrega,
        itens,
        pagamentos,
      }))
    } else {
      sessionStorage.removeItem(draftKey)
    }
  }, [draftKey, tipoPedido, categoriaAtiva, busca, numeroPedido, mesa, nomeCliente, origem, observacao, itens, pagamentos])

  useEffect(() => {
    if (tipoPedido === 'mesa' || tipoPedido === 'balcao') {
      if (origem !== 'goomer') setOrigem('goomer')
      return
    }
    if ((tipoPedido === 'retirada' || tipoPedido === 'entrega') && origem === 'balcao') {
      setOrigem('goomer')
    }
  }, [tipoPedido, origem])

  const categoriasDisponiveis = useMemo(() => {
    const fonte = produtos.length ? produtos : menuBase
    return ['todos', ...Array.from(new Set(fonte.map((item) => item.categoria).filter(Boolean)))]
  }, [produtos])

  const produtosFiltrados = useMemo(() => {
    const termo = normalizarTexto(busca)
    return (produtos.length ? produtos : menuBase).filter((produto) => {
      if (categoriaAtiva !== 'todos' && produto.categoria !== categoriaAtiva) return false
      if (!termo) return true
      return normalizarTexto(`${produto.nome} ${produto.categoria} ${produto.tipo || ''}`).includes(termo)
    })
  }, [busca, categoriaAtiva, produtos])

  const subtotalPedido = useMemo(() => itens.reduce((soma, item) => soma + Number(item.preco || 0) * Number(item.quantidade || 0), 0), [itens])
  const taxaEntregaNumero = useMemo(() => (tipoPedido === 'entrega' ? parseNumero(taxaEntrega) : 0), [tipoPedido, taxaEntrega])
  const total = useMemo(() => subtotalPedido + taxaEntregaNumero, [subtotalPedido, taxaEntregaNumero])
  const valorPago = useMemo(() => pagamentos.reduce((soma, item) => soma + Number(item.valor || 0), 0), [pagamentos])
  const restante = Math.max(total - valorPago, 0)
  const trocoMotocaCalculado = Math.max(parseNumero(trocoMotoca.valorPara) - parseNumero(trocoMotoca.valorConta), 0)
  const vendasEntregaHoje = useMemo(() => vendasCaixa.filter((item) => item.tipo === 'entrega'), [vendasCaixa])
  const trocosHistoricoOrdenado = useMemo(() => trocosHistorico.slice().sort((a, b) => new Date(b.criado_em || b.created_at || 0) - new Date(a.criado_em || a.created_at || 0)), [trocosHistorico])

  useEffect(() => {
    const limite = Number(config?.alerta_sangria || 0)
    const saldoDinheiro = Number(resumoCaixa?.valorSistema || 0)
    if (caixaAtual && limite > 0 && saldoDinheiro > limite) {
      avisar(`Atenção: o dinheiro em caixa chegou a ${formatarMoeda(saldoDinheiro)}. O limite configurado é ${formatarMoeda(limite)}. Faça uma sangria.`, 'warning')
    }
  }, [caixaAtual?.id, resumoCaixa?.valorSistema, config?.alerta_sangria])

  useEffect(() => {
    const numero = formatarPedidoNumero(trocoMotoca.numeroPedido)
    if (!numero) {
      setPedidoTrocoInfo(null)
      return
    }
    let ativo = true
    const encontradoLocal = vendasCaixa.find((item) => item.numero_pedido === numero)
    if (encontradoLocal) {
      setPedidoTrocoInfo(encontradoLocal)
      setTrocoMotoca((atual) => ({
        ...atual,
        numeroPedido: numero,
        cliente: atual.cliente || encontradoLocal.cliente_nome || '',
        valorConta: atual.valorConta || mascararMoedaInput(String(Math.round(Number((encontradoLocal.total || 0) * 100)))),
      }))
      return undefined
    }
    const timer = setTimeout(async () => {
      try {
        const venda = await buscarVendaPorNumeroPedidoApi({ caixaId: caixaAtual?.id || null, numeroPedido: numero })
        if (!ativo) return
        setPedidoTrocoInfo(venda || null)
        if (venda) {
          setTrocoMotoca((atual) => ({
            ...atual,
            numeroPedido: numero,
            cliente: atual.cliente || venda.cliente_nome || '',
            valorConta: atual.valorConta || mascararMoedaInput(String(Math.round(Number((venda.total || 0) * 100)))),
          }))
        }
      } catch {}
    }, 120)
    return () => {
      ativo = false
      clearTimeout(timer)
    }
  }, [trocoMotoca.numeroPedido, caixaAtual?.id, vendasCaixa])

  function selecionarProduto(produto) {
    setProdutoSelecionado(produto)
    setQuantidadeSelecionada(1)
    document.querySelector('.add-item-box')?.scrollIntoView({ block: 'nearest' })
  }

  function adicionarItem() {
    if (!produtoSelecionado) return avisar('Selecione um item antes de adicionar.', 'error')
    setItens((atual) => {
      const indice = atual.findIndex((item) => item.nome === produtoSelecionado.nome)
      if (indice >= 0) {
        return atual.map((item, i) => (i === indice ? { ...item, quantidade: item.quantidade + Number(quantidadeSelecionada) } : item))
      }
      return [...atual, { id: produtoSelecionado.id, nome: produtoSelecionado.nome, preco: Number(produtoSelecionado.preco || 0), quantidade: Number(quantidadeSelecionada), categoria: produtoSelecionado.categoria }]
    })
    avisar(`${produtoSelecionado.nome} adicionado ao pedido.`, 'success')
    setProdutoSelecionado(null)
    setQuantidadeSelecionada(1)
  }

  function removerItem(index) { setItens((atual) => atual.filter((_, i) => i !== index)) }

  function adicionarPagamento(pagamento) {
    if (valorPago + Number(pagamento.valor || 0) > total + 0.001) return avisar('O pagamento não pode passar do valor total do pedido.', 'error')
    setPagamentos((atual) => [...atual, pagamento])
    avisar('Pagamento adicionado.', 'success')
  }

  function limparPedido() {
    setNumeroPedido('')
    setNomeCliente('')
    setObservacao('')
    setTaxaEntrega('')
    setBusca('')
    setItens([])
    setPagamentos([])
    setProdutoSelecionado(null)
    setQuantidadeSelecionada(1)
    limparRascunhoPersistido()
  }

  function abrirModalSenha(modo) {
    setSenhaModal({ open: true, modo, senha: '', motivo: '' })
  }

  function fecharModalSenha() {
    setSenhaModal((atual) => ({ ...atual, open: false, senha: '', motivo: '' }))
  }

  async function confirmarModalSenha() {
    if (!podeAbrirFecharCaixa(usuario)) return avisar('Seu perfil não tem permissão para abrir ou fechar caixa.', 'error')
    const respostaSenha = await autenticarUsuarioApi(usuario?.usuario?.trim(), senhaModal.senha)
    if (!respostaSenha.ok || respostaSenha.usuario?.tipo !== usuario?.tipo) {
      return avisar(`Senha de ${tipoUsuarioLabel(usuario?.tipo).toLowerCase()} inválida.`, 'error')
    }

    if (senhaModal.modo === 'abrir') {
      const resposta = await abrirCaixaApi({ usuario, valorAbertura: parseNumero(valorAbertura), moedasNaoContadas })
      if (!resposta.ok) {
        if (resposta.caixaAtual) {
          setCaixaAtual(resposta.caixaAtual)
          const resumo = await obterResumoCaixaApi(resposta.caixaAtual.id)
          setResumoCaixa(resumo)
        }
        return avisar(resposta.erro || resposta.error, 'warning')
      }
      avisar(`Caixa aberto com sucesso por ${usuario?.nome || usuario?.usuario}.`, 'success')
      setValorAbertura('')
      setMoedasNaoContadas(false)
      setCaixaAtual(resposta.data)
      const resumo = await obterResumoCaixaApi(resposta.data.id)
      setResumoCaixa(resumo)
      setAbaCaixa('operacao')
      fecharModalSenha()
      window.dispatchEvent(new CustomEvent('speedpdv:status-change'))
      return
    }

    let caixa = caixaAtual
    if (!caixa) caixa = await recarregarCaixa()
    if (!caixa) return avisar('Não existe caixa aberto para fechamento.', 'error')
    const valorContado = parseNumero(valorFechamento)
    const esperado = Number(resumoCaixa?.valorSistema || 0)
    const diferenca = valorContado - esperado
    if (Math.abs(diferenca) > 0.009 && !String(senhaModal.motivo || '').trim()) {
      return avisar('Explique o motivo da diferença antes de fechar o caixa.', 'error')
    }
    const resposta = await fecharCaixaApi({ caixaId: caixa.id, valorContado, usuario, motivoFechamento: senhaModal.motivo })
    if (!resposta.ok) return avisar(resposta.erro || resposta.error, 'error')
    avisar(`Caixa fechado com sucesso por ${usuario?.nome || usuario?.usuario}. Esperado ${formatarMoeda(esperado)} | informado ${formatarMoeda(valorContado)} | diferença ${formatarMoeda(diferenca)}.${senhaModal.motivo ? ` Motivo: ${senhaModal.motivo}.` : ''}`, 'success')
    setValorFechamento('')
    setCaixaAtual(null)
    setResumoCaixa(null)
    fecharModalSenha()
    await recarregarCaixa()
    window.dispatchEvent(new CustomEvent('speedpdv:status-change'))
  }

  async function abrirCaixaAtual() {
    if (!podeAbrirFecharCaixa(usuario)) return avisar('Somente administrador, gerente ou supervisor podem abrir o caixa.', 'error')
    if (caixaAtual) return avisar('Este operador já está com um caixa aberto.', 'warning')
    if (!parseNumero(valorAbertura)) return avisar('Informe o valor inicial do caixa.', 'error', valorAberturaRef)
    abrirModalSenha('abrir')
  }

  async function registrarSangria() {
    let caixa = caixaAtual
    if (!caixa) caixa = await recarregarCaixa()
    if (!caixa) return avisar('Abra o caixa antes de lançar sangria.', 'error')
    if (!parseNumero(sangriaValor)) return avisar('Informe o valor da sangria.', 'error')
    const saldoAtual = Number(resumoCaixa?.valorSistema || 0)
    const valorSangria = parseNumero(sangriaValor)
    if (valorSangria > saldoAtual + 0.001) return avisar(`A sangria não pode passar do dinheiro disponível em caixa (${formatarMoeda(saldoAtual)}).`, 'error')
    await registrarSaidaCaixaApi({ caixaId: caixa.id, usuario, tipo: 'sangria', valor: sangriaValor, observacao: sangriaObs || 'Retirada de dinheiro do caixa' })
    setSangriaValor('')
    setSangriaObs('')
    avisar('Sangria registrada com sucesso.', 'success')
    await recarregarCaixa()
    window.dispatchEvent(new CustomEvent('speedpdv:status-change'))
  }

  async function fecharCaixa() {
    if (!podeAbrirFecharCaixa(usuario)) return avisar('Somente administrador, gerente ou supervisor podem fechar o caixa.', 'error')
    let caixa = caixaAtual
    if (!caixa) caixa = await recarregarCaixa()
    if (!caixa) return avisar('Não existe caixa aberto para fechamento.', 'error')
    if (!parseNumero(valorFechamento)) return avisar('Informe o valor contado no caixa para fechar.', 'error', valorFechamentoRef)
    abrirModalSenha('fechar')
  }

  function validarPedido(finalizando) {
    if (!caixaAtual) return { mensagem: 'Abra o caixa antes de lançar vendas.', focusRef: null }
    if (!itens.length) return { mensagem: 'Adicione pelo menos 1 item ao pedido.', focusRef: null }
    if (tipoPedido === 'mesa' && !mesa) return { mensagem: 'Escolha a mesa.', focusRef: null }
    if (!numeroPedido.trim()) return { mensagem: 'Digite o número do pedido/comanda para salvar ou finalizar.', focusRef: numeroPedidoRef }
    if (tipoPedido !== 'mesa' && !nomeCliente.trim()) return { mensagem: 'Digite o nome do cliente.', focusRef: clienteRef }
    if (tipoPedido === 'entrega' && !parseNumero(taxaEntrega) && parseNumero(taxaEntrega) !== 0) return { mensagem: 'Informe a taxa de entrega.', focusRef: null }
    if (finalizando && valorPago <= 0) return { mensagem: 'Adicione pelo menos 1 pagamento para concluir.', focusRef: null }
    return null
  }

  async function registrarPedido(finalizando) {
    const erro = validarPedido(finalizando)
    if (erro) return avisar(erro.mensagem, 'error', erro.focusRef)
    try {
      const status = finalizando ? 'pago' : 'pendente'
      const origemFinal = tipoPedido === 'mesa' || tipoPedido === 'balcao' ? 'goomer' : origem
      await registrarVendaApi({
        usuario,
        caixaId: caixaAtual.id,
        venda: {
          numero_pedido: formatarPedidoNumero(numeroPedido.trim()),
          origem: origemFinal,
          tipo: tipoPedido,
          cliente_nome: tipoPedido === 'mesa' ? (nomeCliente || null) : nomeCliente,
          mesa_nome: tipoPedido === 'mesa' ? mesa : null,
          observacao,
          taxa_entrega: taxaEntregaNumero,
          total,
          pago: valorPago,
          restante: Math.max(total - valorPago, 0),
          status,
        },
        itens,
        pagamentos,
      })
      limparPedido()
      avisar(status === 'pago' ? 'Pedido finalizado e marcado como pago.' : 'Pedido salvo com pagamento pendente.', 'success')
      await recarregarCaixa()
      window.dispatchEvent(new CustomEvent('speedpdv:status-change'))
      if (!finalizando) setTimeout(() => numeroPedidoRef.current?.focus(), 20)
    } catch (error) {
      avisar(error.message || 'Falha ao registrar pedido.', 'error')
    }
  }

  async function registrarTrocoMotoca(e) {
    e.preventDefault()
    let caixa = caixaAtual
    if (!caixa) caixa = await recarregarCaixa()
    if (!caixa) return avisar('Abra o caixa antes de lançar troco do motoboy.', 'error')
    if (!trocoMotoca.cliente.trim() || !trocoMotoca.numeroPedido.trim() || !parseNumero(trocoMotoca.valorConta) || !parseNumero(trocoMotoca.valorPara)) {
      return avisar('Preencha cliente, pedido, valor da conta e troco para quanto.', 'error')
    }
    if (trocoMotocaCalculado <= 0) return avisar('O troco do motoboy precisa ser maior que zero.', 'error')
    const saldoAtual = Number(resumoCaixa?.valorSistema || 0)
    if (trocoMotocaCalculado > saldoAtual + 0.001) return avisar(`O caixa ficaria negativo. Disponível em dinheiro: ${formatarMoeda(saldoAtual)}.`, 'error')
    try {
      const numeroMotoboy = formatarPedidoNumero(trocoMotoca.numeroPedido)
      const repetido = await existeTrocoMotoboyNoCaixaApi({ caixaId: caixa.id, numeroPedido: numeroMotoboy })
      if (repetido) return avisar('Já existe troco de motoboy com esse número de pedido neste caixa.', 'error')
      const trocoValor = trocoMotocaCalculado
      const observacaoTroco = `Cliente: ${trocoMotoca.cliente} | Pedido: ${numeroMotoboy} | Conta: ${parseNumero(trocoMotoca.valorConta).toFixed(2)} | Troco para: ${parseNumero(trocoMotoca.valorPara).toFixed(2)} | Troco do cliente: ${trocoValor.toFixed(2)}`
      await registrarSaidaCaixaApi({
        caixaId: caixa.id,
        usuario,
        tipo: 'troco_motoca',
        valor: trocoValor,
        observacao: observacaoTroco,
        motocaNome: trocoMotoca.motoboy || null,
      })
      await anexarTrocoMotoboyNaVendaApi({ caixaId: caixa.id, numeroPedido: numeroMotoboy, observacaoTroco })
      setTrocoMotoca({ motoboy: '', cliente: '', numeroPedido: '', valorConta: '', valorPara: '' })
      setPedidoTrocoInfo(null)
      avisar('Troco do motoboy registrado e vinculado ao pedido.', 'success')
      await recarregarCaixa()
      window.dispatchEvent(new CustomEvent('speedpdv:status-change'))
    } catch (error) {
      avisar(error.message || 'Falha ao registrar troco do motoboy.', 'error')
    }
  }

  if (carregando) return <div className="panel"><p>Carregando PDV...</p></div>

  return (
    <div className="page-grid pdv-layout improved-pdv compact-page-grid">
      <section className="panel stack gap-sm compact-panel main-pdv-panel">
        {mensagem && <div className={`alert top-alert ${mensagemTipo === 'error' ? 'error strong-alert' : mensagemTipo === 'success' ? 'success strong-alert' : 'warning strong-alert'}`}>{mensagem}</div>}
        <div className="page-header compact-header">
          <div>
            <h1>PDV Speed Burger</h1>
            <p>Visual simples, rápido e seguro para operador registrar pedidos sem confusão.</p>
          </div>
          <div className="pill-group">
            {tiposPedido.map((item) => (
              <button key={item.id} className={tipoPedido === item.id ? 'pill active' : 'pill'} onClick={() => setTipoPedido(item.id)}>
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <div className="pill-group wrap-left small-tabs compact-tabs">
          {['operacao', 'abertura', 'sangria', 'motoboy'].map((item) => (
            <button key={item} className={abaCaixa === item ? 'pill active' : 'pill'} onClick={() => setAbaCaixa(item)}>
              {item === 'operacao' ? '🧾 Operação' : item === 'abertura' ? '🔐 Abertura / fechamento' : item === 'sangria' ? '💸 Sangria' : '🏍️ Troco motoboy'}
            </button>
          ))}
        </div>

        {abaCaixa === 'operacao' && (
          <>
            {caixaAtual ? (
              <div className="compact-status-bar">
                <span className="status-card status-blue"><strong>Operador</strong><small>{usuario?.nome || usuario?.usuario}</small></span>
                <span className="status-card status-green"><strong>Caixa aberto às</strong><small>{horaBR(caixaAtual.data_abertura || caixaAtual.abertura)}</small></span>
                <span className="status-card status-gold"><strong>Valor inicial</strong><small>{formatarMoeda(caixaAtual.valor_abertura ?? caixaAtual.valor_inicial ?? 0)}</small></span>
              </div>
            ) : (
              <div className="alert error">Caixa fechado. Vá em <strong>Abertura / fechamento</strong> para abrir o caixa.</div>
            )}

            <div className="quick-guide panel soft-panel compact-panel">
              <strong>{tiposPedido.find((item) => item.id === tipoPedido)?.label}</strong>
              <p>{tiposPedido.find((item) => item.id === tipoPedido)?.resumo}</p>
            </div>

            <div className="grid-4 compact-grid colored-fields compact-fields">
              <label className="field-order">Nº pedido<input ref={numeroPedidoRef} id="numeroPedido" value={numeroPedido} onChange={(e) => setNumeroPedido(formatarPedidoNumero(e.target.value))} placeholder="Ex.: 0058" /></label>
              {tipoPedido === 'mesa' ? (
                <label className="field-table">Mesa<select value={mesa} onChange={(e) => setMesa(e.target.value)}>{(config.mesas_ativas || ['2']).map((numero) => <option key={numero} value={numero}>{`Mesa ${numero}`}</option>)}</select></label>
              ) : (
                <label className="field-client">Cliente<input ref={clienteRef} value={nomeCliente} onChange={(e) => setNomeCliente(e.target.value)} placeholder={tipoPedido === 'entrega' ? 'Nome do cliente da entrega' : 'Nome do cliente'} /></label>
              )}
              <label className="field-origin">Origem<select value={origem} onChange={(e) => setOrigem(e.target.value)}>{origens.map((item) => <option key={item} value={item}>{nomeOrigem[item]}</option>)}</select></label>
              {tipoPedido === 'entrega' && <label className="field-note">Taxa de entrega<input value={taxaEntrega} onChange={(e) => setTaxaEntrega(mascararMoedaInput(e.target.value))} inputMode="numeric" placeholder="0,00" /></label>}
              <label className="field-note">Observação<input ref={observacaoRef} value={observacao} onChange={(e) => setObservacao(e.target.value)} placeholder={tipoPedido === 'entrega' ? 'Bairro, referência, taxa externa...' : 'Sem cebola, nome no pacote...'} /></label>
            </div>

            <div className="panel soft-panel stack gap-sm compact-panel products-panel">
              <div className="grid-2 compact-grid">
                <label>Buscar item<input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Ex.: cheddar, coca, combo" /></label>
                <label><div className="label-inline-help"><span>Categoria</span><InfoHint text="Você pode filtrar pelos grupos já cadastrados no cardápio. Novas categorias criadas no Admin aparecem aqui automaticamente." /></div><select value={categoriaAtiva} onChange={(e) => setCategoriaAtiva(e.target.value)}>{categoriasDisponiveis.map((categoria) => <option key={categoria} value={categoria}>{categoria === 'todos' ? 'Todos' : categoria}</option>)}</select></label>
              </div>
              <div className="product-grid searchable-grid compact-products">
                {produtosFiltrados.map((produto) => (
                  <button key={produto.id || produto.nome} className={`product-card category-${produto.categoria} ${produtoSelecionado?.nome === produto.nome ? 'selected' : ''}`} onClick={() => selecionarProduto(produto)}>
                    <span className="product-tag">{produto.categoria}</span>
                    <strong>{produto.nome}</strong>
                    <span>{formatarMoeda(produto.preco)}</span>
                  </button>
                ))}
              </div>
              <div className="grid-3 compact-grid add-item-box sticky-add-box">
                <label>Item selecionado<input value={produtoSelecionado?.nome || ''} readOnly placeholder="Clique em um item acima" /></label>
                <label>Quantidade<select value={quantidadeSelecionada} onChange={(e) => setQuantidadeSelecionada(Number(e.target.value))}>{qtdOptions.map((q) => <option key={q} value={q}>{q}</option>)}</select></label>
                <div className="stack end"><button className="primary-btn compact-btn" onClick={adicionarItem}>Adicionar item</button></div>
              </div>
            </div>
          </>
        )}

        {abaCaixa === 'abertura' && (
          <div className="grid-2 compact-grid">
            <div className="panel stack gap-sm compact-panel">
              <h3>🔓 Abertura do caixa <span className="title-help-inline"><InfoHint text="Informe o valor inicial em espécie e confirme com a senha do perfil responsável. Administrador, gerente e supervisor podem abrir ou fechar o caixa com a própria senha." /></span></h3>
              {caixaAtual ? (
                <div className="stack gap-sm">
                  <div className="mini-info success-box"><span>Caixa já aberto</span><strong>{formatarMoeda(caixaAtual.valor_abertura ?? caixaAtual.valor_inicial ?? 0)}</strong></div>
                  <div className="mini-info"><span>Aberto às</span><strong>{horaBR(caixaAtual.data_abertura || caixaAtual.abertura)}</strong></div>
                  <button className="secondary-btn compact-btn" disabled>Caixa já aberto</button>
                </div>
              ) : (
                <>
                  <label>Valor inicial do caixa<input ref={valorAberturaRef} value={valorAbertura} onChange={(e) => setValorAbertura(mascararMoedaInput(e.target.value))} inputMode="numeric" placeholder="0,00" /></label>
                  <label className="check-row">
                    <input type="checkbox" checked={moedasNaoContadas} onChange={(e) => setMoedasNaoContadas(e.target.checked)} />
                    <span>Moedas não foram contadas nesta abertura</span>
                  </label>
                  <small className="muted">Marque quando a contagem inicial considerar apenas cédulas. Isso fica registrado no fechamento e no PDF.</small>
                  <button className="secondary-btn compact-btn" onClick={abrirCaixaAtual}>Abrir caixa</button>
                </>
              )}
            </div>
            <div className="panel stack gap-sm compact-panel">
              <h3>🔒 Fechamento do caixa <span className="title-help-inline"><InfoHint text="Confira o saldo previsto em dinheiro e digite o valor contado no fechamento. Quando houver diferença, informe o motivo antes de concluir." /></span></h3>
              {!caixaAtual ? <p className="muted">Nenhum caixa aberto para este operador.</p> : (
                <>
                  <div className="grid-3 compact-grid">
                    <div className="mini-info"><span>Abertura</span><strong>{formatarMoeda(resumoCaixa?.abertura || 0)}</strong></div>
                    <div className="mini-info success-box"><span>Entradas em dinheiro</span><strong>{formatarMoeda(resumoCaixa?.entradasDinheiro || 0)}</strong></div>
                    <div className="mini-info danger-box"><span>Saídas do caixa</span><strong>{formatarMoeda(resumoCaixa?.totalSaidas || 0)}</strong></div>
                  </div>
                  <div className="mini-info"><span>Saldo previsto em dinheiro</span><strong>{formatarMoeda(resumoCaixa?.valorSistema || 0)}</strong></div>
                  <label>Valor contado no caixa<input ref={valorFechamentoRef} value={valorFechamento} onChange={(e) => setValorFechamento(mascararMoedaInput(e.target.value))} inputMode="numeric" placeholder={formatarMoeda(resumoCaixa?.valorSistema || 0).replace('R$ ', '')} /></label>
                  <button className="danger-btn compact-btn" onClick={fecharCaixa}>Fechar caixa</button>
                </>
              )}
            </div>
          </div>
        )}

        {abaCaixa === 'sangria' && (
          <div className="panel stack gap-sm compact-panel">
            <h3>💸 Retirada de dinheiro (sangria)</h3>
            <p className="muted">Use esta área para retirar dinheiro em espécie do caixa. Informe o valor e o motivo. Essa saída aparece no relatório do administrador.</p>
            {caixaAtual && Number(config?.alerta_sangria || 0) > 0 && Number(resumoCaixa?.valorSistema || 0) > Number(config?.alerta_sangria || 0) && (
              <div className="mini-info warning-box"><span>Sugestão de sangria</span><strong>{formatarMoeda(Math.max(Number(resumoCaixa?.valorSistema || 0) - Number(config?.alerta_sangria || 0), 0))}</strong></div>
            )}
            {!caixaAtual && <div className="alert">Abra o caixa antes de lançar sangria.</div>}
            <div className="grid-2 compact-grid">
              <label>Valor retirado do caixa<input value={sangriaValor} onChange={(e) => setSangriaValor(mascararMoedaInput(e.target.value))} inputMode="numeric" placeholder="0,00" /></label>
              <label>Motivo da retirada<input value={sangriaObs} onChange={(e) => setSangriaObs(e.target.value)} placeholder="Ex.: excesso de dinheiro em espécie" /></label>
            </div>
            <button className="danger-btn compact-btn" onClick={registrarSangria} disabled={!caixaAtual}>Registrar retirada</button>
          </div>
        )}

        {abaCaixa === 'motoboy' && (
          <div className="stack gap-sm">
            <form className="panel stack gap-sm compact-panel" onSubmit={registrarTrocoMotoca}>
              <h3>🏍️ Troco para entrega <span className="title-help-inline"><InfoHint text="Digite o número do pedido para o sistema localizar a entrega e já sugerir cliente e valor da conta. O nome do motoboy é opcional." /></span></h3>
              <p className="muted">Use quando o entregador precisa sair com troco. O valor fica gravado como saída do caixa e também é vinculado ao pedido da entrega.</p>
              {!caixaAtual && <div className="alert">Abra o caixa antes de lançar troco do motoboy.</div>}
              <div className="grid-2 compact-grid">
                <label><div className="label-inline-help"><span>Motoboy (opcional)</span><InfoHint text="Preencha quando souber quem saiu com o troco. Se os bairros foram revezados, pode deixar em branco." /></div><input value={trocoMotoca.motoboy} onChange={(e) => setTrocoMotoca({ ...trocoMotoca, motoboy: e.target.value })} placeholder="Ex.: Guilherme" /></label>
                <label>Nº do pedido<input value={trocoMotoca.numeroPedido} onChange={(e) => setTrocoMotoca({ ...trocoMotoca, numeroPedido: formatarPedidoNumero(e.target.value) })} placeholder="Ex.: 0058" /></label>
                <label>Nome do cliente<input value={trocoMotoca.cliente} onChange={(e) => setTrocoMotoca({ ...trocoMotoca, cliente: e.target.value })} placeholder="Preenchido automaticamente quando possível" /></label>
                <label>Valor da conta<input value={trocoMotoca.valorConta} onChange={(e) => setTrocoMotoca({ ...trocoMotoca, valorConta: mascararMoedaInput(e.target.value) })} inputMode="numeric" /></label>
                <label>Cliente vai pagar com quanto?<input value={trocoMotoca.valorPara} onChange={(e) => setTrocoMotoca({ ...trocoMotoca, valorPara: mascararMoedaInput(e.target.value) })} inputMode="numeric" placeholder="Ex.: 100,00" /></label>
                <div className="mini-info warning-box"><span>Valor do troco enviado</span><strong>{formatarMoeda(trocoMotocaCalculado)}</strong><small>{trocoMotoca.valorPara ? `Troco para ${formatarMoeda(parseNumero(trocoMotoca.valorPara))}` : 'Informe quanto o cliente vai entregar.'}</small></div>
              </div>
              {pedidoTrocoInfo && (
                <div className="grid-3 compact-grid">
                  <div className="mini-info success-box"><span>Pedido localizado</span><strong>#{pedidoTrocoInfo.numero_pedido}</strong><small>{pedidoTrocoInfo.cliente_nome || 'Sem cliente'} • {nomeOrigem[pedidoTrocoInfo.origem] || pedidoTrocoInfo.origem || 'Sem origem'}</small></div>
                  <div className="mini-info"><span>Total da entrega</span><strong>{formatarMoeda(pedidoTrocoInfo.total || 0)}</strong><small>Pagamento principal: {resumoPagamentoCurto(pedidoTrocoInfo)}</small></div>
                  <div className="mini-info"><span>Resumo do pedido</span><strong>{formatarMoeda(Number(pedidoTrocoInfo.taxa_entrega || 0))}</strong><small>Taxa de entrega • {pagamentosResumo(pedidoTrocoInfo)}</small></div>
                </div>
              )}
              <button className="secondary-btn compact-btn" disabled={!caixaAtual}>Salvar troco para entrega</button>
            </form>

            <div className="panel compact-panel stack gap-sm">
              <h3>Histórico de troco de motoboy <span className="title-help-inline"><InfoHint text="Lista dos trocos já lançados neste caixa, com pedido, cliente, valor do troco e horário." /></span></h3>
              <div className="item-list compact-tall">
                {!trocosHistoricoOrdenado.length && <p className="muted">Nenhum troco de motoboy lançado neste caixa.</p>}
                {trocosHistoricoOrdenado.slice(0, 12).map((item) => {
                  const troco = extrairDadosTrocoMotoboy(item.observacao || item.descricao || '')
                  return (
                    <div className="item-row wrap-row readable-row" key={item.id}>
                      <div className="pedido-meta">
                        <strong>Pedido {troco?.pedido || '----'} • {item.motoca_nome || 'Motoboy não informado'}</strong>
                        <small>{troco?.cliente || 'Cliente não informado'} • {dataHoraBR(item.criado_em || item.created_at)}</small>
                        <small>{troco ? `Conta ${formatarMoeda(troco.conta)} • Troco para ${formatarMoeda(troco.trocoPara)} • Troco do cliente ${formatarMoeda(troco.trocoCliente)}` : (item.observacao || item.descricao || 'Sem observação')}</small>
                      </div>
                      <strong>{formatarMoeda(item.valor || 0)}</strong>
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="panel compact-panel stack gap-sm">
              <h3>Entregas de hoje para conferência <span className="title-help-inline"><InfoHint text="Apoio visual para o operador conferir número do pedido, cliente, origem, valor, forma de pagamento e eventual troco já lançado." /></span></h3>
              <div className="item-list compact-tall">
                {!vendasEntregaHoje.length && <p className="muted">Nenhuma entrega registrada neste caixa até agora.</p>}
                {vendasEntregaHoje.slice(0, 20).map((item) => {
                  const trocoObservacao = extrairDadosTrocoMotoboy(item.observacao || '')
                  return (
                    <div className="item-row wrap-row readable-row" key={`entrega-${item.id}`}>
                      <div className="pedido-meta">
                        <strong>Pedido {item.numero_pedido || 'Sem número'} • {item.cliente_nome || 'Sem cliente'}</strong>
                        <small>{nomeOrigem[item.origem] || item.origem || 'Sem origem'} • {pagamentosResumo(item)}</small>
                        <small>Total {formatarMoeda(item.total || 0)} • Taxa {formatarMoeda(item.taxa_entrega || 0)} • {dataHoraBR(item.criado_em || item.created_at)}</small>
                        {trocoObservacao && <small>Troco lançado: para {formatarMoeda(trocoObservacao.trocoPara)} • troco do cliente {formatarMoeda(trocoObservacao.trocoCliente)}</small>}
                      </div>
                      <button type="button" className="ghost-btn compact-btn" onClick={() => setTrocoMotoca((atual) => ({ ...atual, numeroPedido: item.numero_pedido || '', cliente: item.cliente_nome || '', valorConta: mascararMoedaInput(String(Math.round(Number((item.total || 0) * 100)))) }))}>Usar pedido</button>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}
      </section>

      <section className="stack gap-sm compact-side-column">
        <ItemPedidoList itens={itens} onRemover={removerItem} />
        <div className="grid-3 compact-grid">
          <div className="mini-info"><span>{tipoPedido === 'entrega' ? 'Subtotal do pedido' : 'Total do pedido'}</span><strong>{formatarMoeda(subtotalPedido)}</strong></div>
          <div className="mini-info"><span>Taxa de entrega</span><strong>{formatarMoeda(taxaEntregaNumero)}</strong></div>
          <div className="mini-info success-box"><span>Total final</span><strong>{formatarMoeda(total)}</strong></div>
        </div>
        <div className="grid-2 compact-grid">
          <div className="mini-info success-box"><span>Já recebido</span><strong>{formatarMoeda(valorPago)}</strong></div>
          <div className="mini-info warning-box"><span>Falta receber</span><strong>{formatarMoeda(restante)}</strong></div>
        </div>
        <PagamentoBox total={total} pagamentos={pagamentos} onAdicionarPagamento={adicionarPagamento} />
        <div className="panel stack gap-sm compact-panel">
          <button className="ghost-btn compact-btn" onClick={() => registrarPedido(false)}>Salvar pedido</button>
          <button className="primary-btn compact-btn" onClick={() => registrarPedido(true)}>Finalizar e marcar como pago</button>
          <button className="secondary-btn compact-btn" onClick={limparPedido}>Limpar tela</button>
        </div>
        {mensagem && <div className={`alert ${mensagemTipo === 'error' ? 'error strong-alert' : mensagemTipo === 'success' ? 'success strong-alert' : 'warning strong-alert'}`}>{mensagem}</div>}
      </section>


      <NativeModal
        open={senhaModal.open}
        title={senhaModal.modo === 'abrir' ? 'Confirmar abertura do caixa' : 'Confirmar fechamento do caixa'}
        confirmLabel={senhaModal.modo === 'abrir' ? 'Abrir caixa' : 'Fechar caixa'}
        cancelLabel="Cancelar"
        onConfirm={confirmarModalSenha}
        onClose={fecharModalSenha}
      >
        <div className="stack gap-sm">
          <div className="info-box">
            <strong>{senhaModal.modo === 'abrir' ? `Senha do ${tipoUsuarioLabel(usuario?.tipo).toLowerCase()}` : `Confirmação do ${tipoUsuarioLabel(usuario?.tipo).toLowerCase()}`}</strong>
            <span>
              {senhaModal.modo === 'abrir'
                ? `Digite a senha de ${usuario?.nome || usuario?.usuario} para abrir o caixa.`
                : `Digite a senha de ${usuario?.nome || usuario?.usuario} para fechar o caixa.`}
            </span>
          </div>
          {senhaModal.modo === 'fechar' && (
            <div className="grid-3 compact-grid">
              <div className="mini-info"><span>Esperado</span><strong>{formatarMoeda(resumoCaixa?.valorSistema || 0)}</strong></div>
              <div className="mini-info"><span>Informado</span><strong>{formatarMoeda(parseNumero(valorFechamento))}</strong></div>
              <div className={`mini-info ${Math.abs(parseNumero(valorFechamento) - Number(resumoCaixa?.valorSistema || 0)) > 0.009 ? 'warning-box' : 'success-box'}`}><span>Diferença</span><strong>{formatarMoeda(parseNumero(valorFechamento) - Number(resumoCaixa?.valorSistema || 0))}</strong></div>
            </div>
          )}
          <label>
            Senha do responsável
            <input
              type="password"
              value={senhaModal.senha}
              onChange={(e) => setSenhaModal((atual) => ({ ...atual, senha: e.target.value }))}
              placeholder="Digite a senha"
              autoComplete="new-password"
            />
          </label>
          {senhaModal.modo === 'fechar' && Math.abs(parseNumero(valorFechamento) - Number(resumoCaixa?.valorSistema || 0)) > 0.009 && (
            <label>
              <div className="label-inline-help"><span>Motivo da diferença</span><InfoHint text="Campo opcional para registrar por que o valor contado ficou diferente do esperado." /></div>
              <input
                value={senhaModal.motivo}
                onChange={(e) => setSenhaModal((atual) => ({ ...atual, motivo: e.target.value }))}
                placeholder="Ex.: faltou troco, sangria não lançada, conferência em andamento"
              />
            </label>
          )}
        </div>
      </NativeModal>
    </div>
  )
}
