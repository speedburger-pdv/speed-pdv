import { useEffect, useMemo, useState } from 'react'
import InfoHint from '../components/InfoHint'
import NativeModal from '../components/NativeModal'
import {
  carregarMotocasConfigApi,
  listarMotoboysFechamentoApi,
  listarPrestacoesPortalMotocaApi,
  listarVendasApi,
  salvarMotocasConfigApi,
  substituirMotoboysFechamentoHojeApi,
} from '../lib/api'
import { obterSessao, tipoUsuarioLabel } from '../lib/auth'
import { dataHoraBR, formatarMoeda, mascararMoedaInput, nomeFormaPagamento, nomeOrigem, pagamentosDaVenda, pagamentosResumo, parseNumero } from '../lib/utils'

function criarId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  return `motoca-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

function ehHoje(data) {
  const atual = new Date()
  const valor = new Date(data)
  if (Number.isNaN(valor.getTime())) return false
  return valor.getFullYear() === atual.getFullYear()
    && valor.getMonth() === atual.getMonth()
    && valor.getDate() === atual.getDate()
}

function moedaPadrao(valor) {
  return mascararMoedaInput(String(Math.round(Number(valor || 0) * 100)))
}

function criarLinha(config, salvo = {}) {
  return {
    id: salvo.id || criarId(),
    nome: salvo.nome || '',
    entregas_normais: String(salvo.entregas_normais ?? ''),
    entregas_distantes: String(salvo.entregas_distantes ?? ''),
    entregas_dinheiro: String(salvo.entregas_dinheiro ?? ''),
    entregas_cartao: String(salvo.entregas_cartao ?? ''),
    entregas_pix: String(salvo.entregas_pix ?? ''),
    valor_normal: salvo.valor_normal ? moedaPadrao(salvo.valor_normal) : moedaPadrao(config.valor_entrega_normal || 7),
    valor_distante: salvo.valor_distante ? moedaPadrao(salvo.valor_distante) : moedaPadrao(config.valor_entrega_distante || 10),
    dinheiro_entregue: salvo.dinheiro_entregue ? moedaPadrao(salvo.dinheiro_entregue) : '',
    forma_recebimento: salvo.forma_recebimento || 'dinheiro',
  }
}

function sincronizarLinhas(atuais, quantidade, config, salvosHoje = []) {
  const base = Array.isArray(atuais) ? [...atuais] : []
  while (base.length < quantidade) {
    const salvo = salvosHoje[base.length]
    base.push(criarLinha(config, salvo))
  }
  return base.slice(0, quantidade)
}

function totalLinha(item) {
  return (Number(item.entregas_normais || 0) * parseNumero(item.valor_normal))
    + (Number(item.entregas_distantes || 0) * parseNumero(item.valor_distante))
}

function contarFormaPrincipal(venda) {
  const pagamentos = pagamentosDaVenda(venda)
  if (!pagamentos.length) return 'nao_informado'
  const resumo = pagamentos.reduce((acc, item) => {
    const forma = item.forma_pagamento || item.forma || 'nao_informado'
    acc[forma] = (acc[forma] || 0) + Number(item.valor_pago ?? item.valor ?? 0)
    return acc
  }, {})
  const principal = Object.entries(resumo).sort((a, b) => b[1] - a[1])[0]?.[0] || 'nao_informado'
  if (principal === 'credito' || principal === 'debito') return 'cartao'
  if (principal === 'pix') return 'pix'
  if (principal === 'dinheiro') return 'dinheiro'
  return 'nao_informado'
}

function resumoEntregasSistema(vendas = []) {
  return vendas.reduce((acc, item) => {
    acc.total += 1
    const forma = contarFormaPrincipal(item)
    if (forma in acc) acc[forma] += 1
    return acc
  }, { total: 0, dinheiro: 0, cartao: 0, pix: 0 })
}

function resumoFormaTexto(resumo = {}) {
  return `Dinheiro ${Number(resumo.dinheiro || 0)} • Cartão ${Number(resumo.cartao || 0)} • Pix ${Number(resumo.pix || 0)}`
}

function resumoPrestacoes(lista = []) {
  return (lista || []).reduce((acc, item) => {
    acc.totalEntregas += Number(item.entregas_normais || 0) + Number(item.entregas_distantes || 0)
    acc.totalReceber += Number(item.total || 0)
    acc.totalDinheiroEntregue += Number(item.dinheiro_entregue || 0)
    acc.dinheiro += Number(item.entregas_dinheiro || 0)
    acc.cartao += Number(item.entregas_cartao || 0)
    acc.pix += Number(item.entregas_pix || 0)
    return acc
  }, { totalEntregas: 0, totalReceber: 0, totalDinheiroEntregue: 0, dinheiro: 0, cartao: 0, pix: 0 })
}

function resumoEntregaPortal(item = {}) {
  const linhas = []
  linhas.push(`Pedido ${item.numero_pedido || 'não informado'} • ${nomeOrigem[item.origem] || item.origem || 'Sem origem'} • ${item.tipo_corrida === 'distante' ? 'Distante' : 'Normal'}`)

  const pagamento = item.pagamento_principal === 'misto'
    ? `Misto${parseNumero(item.valor_dinheiro) ? ` • Dinheiro ${formatarMoeda(item.valor_dinheiro)}` : ''}${parseNumero(item.valor_cartao) ? ` • Cartão ${formatarMoeda(item.valor_cartao)}` : ''}${parseNumero(item.valor_pix) ? ` • Pix ${formatarMoeda(item.valor_pix)}` : ''}`
    : nomeFormaPagamento(item.pagamento_principal || 'dinheiro')

  linhas.push(`${pagamento} • Conta ${formatarMoeda(item.valor_total || 0)} • Maquininha ${item.maquininha_usada || 'não informada'}`)

  if (parseNumero(item.troco_para) || parseNumero(item.troco_cliente)) {
    linhas.push(`Troco para ${formatarMoeda(item.troco_para || 0)} • Troco dado ${formatarMoeda(item.troco_cliente || 0)}`)
  }

  if (String(item.observacao || '').trim()) {
    linhas.push(item.observacao.trim())
  }

  return linhas
}

function MotocaRow({ item, index, onChange }) {
  const recebe = totalLinha(item)
  return (
    <div className="motoboy-row motocas-row">
      <div className="motoboy-row-header">
        <span className="motoboy-row-title">Motoca {index + 1}</span>
        <strong className="motoboy-row-total">Recebe {formatarMoeda(recebe)}</strong>
      </div>
      <div className="motocas-row-grid">
        <label className="motoboy-col motoboy-name-col">
          <span>Nome</span>
          <input value={item.nome} onChange={(e) => onChange(item.id, 'nome', e.target.value)} placeholder="Nome ou apelido" autoComplete="off" />
        </label>
        <label className="motoboy-col"><span>Normais</span><input type="number" min="0" value={item.entregas_normais} onChange={(e) => onChange(item.id, 'entregas_normais', e.target.value)} /></label>
        <label className="motoboy-col"><span>Distantes</span><input type="number" min="0" value={item.entregas_distantes} onChange={(e) => onChange(item.id, 'entregas_distantes', e.target.value)} /></label>
        <label className="motoboy-col"><span>Dinheiro</span><input type="number" min="0" value={item.entregas_dinheiro} onChange={(e) => onChange(item.id, 'entregas_dinheiro', e.target.value)} /></label>
        <label className="motoboy-col"><span>Cartão</span><input type="number" min="0" value={item.entregas_cartao} onChange={(e) => onChange(item.id, 'entregas_cartao', e.target.value)} /></label>
        <label className="motoboy-col"><span>Pix</span><input type="number" min="0" value={item.entregas_pix} onChange={(e) => onChange(item.id, 'entregas_pix', e.target.value)} /></label>
        <label className="motoboy-col"><span>R$ normal</span><input value={item.valor_normal} onChange={(e) => onChange(item.id, 'valor_normal', e.target.value)} inputMode="numeric" /></label>
        <label className="motoboy-col"><span>R$ distante</span><input value={item.valor_distante} onChange={(e) => onChange(item.id, 'valor_distante', e.target.value)} inputMode="numeric" /></label>
        <label className="motoboy-col"><span>Dinheiro entregue</span><input value={item.dinheiro_entregue} onChange={(e) => onChange(item.id, 'dinheiro_entregue', e.target.value)} inputMode="numeric" placeholder="0,00" /></label>
        <label className="motoboy-col"><span>Receber em</span><select value={item.forma_recebimento} onChange={(e) => onChange(item.id, 'forma_recebimento', e.target.value)}><option value="dinheiro">Dinheiro</option><option value="pix">Pix</option></select></label>
      </div>
    </div>
  )
}

export default function MotocasPage() {
  const usuarioAtual = obterSessao()
  const [mensagem, setMensagem] = useState('')
  const [config, setConfig] = useState({ quantidade_motoboys: 4, valor_entrega_normal: 7, valor_entrega_distante: 10 })
  const [configDraft, setConfigDraft] = useState({ quantidade_motoboys: '4', valor_entrega_normal: '7,00', valor_entrega_distante: '10,00' })
  const [motoboysHoje, setMotoboysHoje] = useState(4)
  const [linhas, setLinhas] = useState([])
  const [vendasHoje, setVendasHoje] = useState([])
  const [prestacoesPortalHoje, setPrestacoesPortalHoje] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [modalDivergenciaOpen, setModalDivergenciaOpen] = useState(false)
  const [motivoDivergencia, setMotivoDivergencia] = useState('')

  async function carregar() {
    try {
      setCarregando(true)
      const [cfg, vendas, fechamentos, prestacoesPortal] = await Promise.all([
        carregarMotocasConfigApi(),
        listarVendasApi(),
        listarMotoboysFechamentoApi(),
        listarPrestacoesPortalMotocaApi(),
      ])
      const configAtual = {
        quantidade_motoboys: Math.max(1, Math.min(10, Number(cfg?.quantidade_motoboys || 4))),
        valor_entrega_normal: Number(cfg?.valor_entrega_normal || 7),
        valor_entrega_distante: Number(cfg?.valor_entrega_distante || 10),
      }
      const hojeVendas = (vendas || []).filter((item) => item.status === 'pago' && item.tipo === 'entrega' && ehHoje(item.criado_em || item.created_at))
      const fechamentosHoje = (fechamentos || []).filter((item) => ehHoje(item.created_at || item.criado_em))
      const portalHoje = (prestacoesPortal || []).filter((item) => ehHoje(item.created_at || item.criado_em))
      const quantidadeBase = fechamentosHoje.length || portalHoje.length || configAtual.quantidade_motoboys
      const quantidadeHoje = Math.max(1, Math.min(10, quantidadeBase))
      setConfig(configAtual)
      setConfigDraft({
        quantidade_motoboys: String(configAtual.quantidade_motoboys),
        valor_entrega_normal: moedaPadrao(configAtual.valor_entrega_normal),
        valor_entrega_distante: moedaPadrao(configAtual.valor_entrega_distante),
      })
      setMotoboysHoje(quantidadeHoje)
      setLinhas(sincronizarLinhas([], quantidadeHoje, configAtual, fechamentosHoje))
      setVendasHoje(hojeVendas)
      setPrestacoesPortalHoje(portalHoje)
    } catch (error) {
      setMensagem(error.message || 'Falha ao carregar motocas.')
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => { carregar() }, [])

  function atualizarLinha(id, campo, valor) {
    setLinhas((atuais) => atuais.map((item) => {
      if (item.id !== id) return item
      return {
        ...item,
        [campo]: campo.startsWith('valor_') || campo === 'dinheiro_entregue' ? mascararMoedaInput(valor) : valor,
      }
    }))
  }

  async function salvarConfiguracao(e) {
    e.preventDefault()
    try {
      const payload = {
        quantidade_motoboys: Math.max(1, Math.min(10, Number(configDraft.quantidade_motoboys || 4))),
        valor_entrega_normal: Number(parseNumero(configDraft.valor_entrega_normal) || 0),
        valor_entrega_distante: Number(parseNumero(configDraft.valor_entrega_distante) || 0),
      }
      const salvo = await salvarMotocasConfigApi(payload)
      setConfig(salvo)
      setConfigDraft({
        quantidade_motoboys: String(salvo.quantidade_motoboys),
        valor_entrega_normal: moedaPadrao(salvo.valor_entrega_normal),
        valor_entrega_distante: moedaPadrao(salvo.valor_entrega_distante),
      })
      setMotoboysHoje((atual) => Math.max(1, Math.min(salvo.quantidade_motoboys, atual)))
      setLinhas((atuais) => sincronizarLinhas(atuais, Math.max(1, Math.min(salvo.quantidade_motoboys, motoboysHoje)), salvo).map((item) => ({
        ...item,
        valor_normal: moedaPadrao(parseNumero(item.valor_normal) || salvo.valor_entrega_normal),
        valor_distante: moedaPadrao(parseNumero(item.valor_distante) || salvo.valor_entrega_distante),
      })))
      setMensagem('Configuração dos motocas salva com sucesso. O portal passa a ler esses valores.')
    } catch (error) {
      setMensagem(error.message || 'Falha ao salvar configuração dos motocas.')
    }
  }

  function puxarDoPortal() {
    if (!prestacoesPortalHoje.length) {
      setMensagem('Nenhuma prestação do portal foi enviada hoje.')
      return
    }
    const quantidade = Math.max(1, Math.min(config.quantidade_motoboys, prestacoesPortalHoje.length))
    setMotoboysHoje(quantidade)
    setLinhas((atuais) => sincronizarLinhas(atuais, quantidade, config).map((item, index) => {
      const portal = prestacoesPortalHoje[index]
      if (!portal) return item
      return {
        ...item,
        nome: portal.nome || item.nome,
        entregas_normais: String(portal.entregas_normais || 0),
        entregas_distantes: String(portal.entregas_distantes || 0),
        entregas_dinheiro: String(portal.entregas_dinheiro || 0),
        entregas_cartao: String(portal.entregas_cartao || 0),
        entregas_pix: String(portal.entregas_pix || 0),
        valor_normal: moedaPadrao(portal.valor_normal || config.valor_entrega_normal),
        valor_distante: moedaPadrao(portal.valor_distante || config.valor_entrega_distante),
        dinheiro_entregue: portal.dinheiro_entregue ? moedaPadrao(portal.dinheiro_entregue) : '',
        forma_recebimento: portal.forma_recebimento || 'dinheiro',
      }
    }))
    setMensagem('Prestação do portal puxada para a tela do responsável. Agora confira e ajuste se precisar.')
  }

  const linhasVisiveis = useMemo(() => linhas.slice(0, motoboysHoje), [linhas, motoboysHoje])
  const entregasSistema = useMemo(() => resumoEntregasSistema(vendasHoje), [vendasHoje])
  const resumoAtual = useMemo(() => resumoPrestacoes(linhasVisiveis.map((item) => ({
    ...item,
    total: totalLinha(item),
    dinheiro_entregue: parseNumero(item.dinheiro_entregue),
  }))), [linhasVisiveis])
  const resumoPortal = useMemo(() => resumoPrestacoes(prestacoesPortalHoje), [prestacoesPortalHoje])

  const fechamentoPronto = useMemo(() => linhasVisiveis
    .filter((item) => String(item.nome || '').trim() && (
      Number(item.entregas_normais || 0)
      || Number(item.entregas_distantes || 0)
      || Number(item.entregas_dinheiro || 0)
      || Number(item.entregas_cartao || 0)
      || Number(item.entregas_pix || 0)
      || parseNumero(item.dinheiro_entregue)
    ))
    .map((item) => ({
      ...item,
      nome: String(item.nome || '').trim(),
      valor_normal: parseNumero(item.valor_normal),
      valor_distante: parseNumero(item.valor_distante),
      dinheiro_entregue: parseNumero(item.dinheiro_entregue),
      total: totalLinha(item),
    })), [linhasVisiveis])

  const bateEntregas = resumoAtual.totalEntregas === entregasSistema.total
  const batePagamentos = resumoAtual.dinheiro === entregasSistema.dinheiro && resumoAtual.cartao === entregasSistema.cartao && resumoAtual.pix === entregasSistema.pix
  const portalBateSistema = resumoPortal.totalEntregas === entregasSistema.total
  const portalBateResponsavel = resumoPortal.totalEntregas === resumoAtual.totalEntregas
  const haDivergenciaAtual = !bateEntregas || !batePagamentos

  async function executarSalvarFechamento(motivo = '') {
    try {
      const payload = fechamentoPronto.map((item) => ({
        ...item,
        divergencia: haDivergenciaAtual,
        motivo_divergencia: motivo || '',
        conferido_por_nome: usuarioAtual?.nome || usuarioAtual?.usuario || '',
        conferido_por_tipo: usuarioAtual?.tipo || '',
        total_entregas_sistema: entregasSistema.total,
        total_entregas_informadas: resumoAtual.totalEntregas,
        pagamentos_dinheiro_sistema: entregasSistema.dinheiro,
        pagamentos_cartao_sistema: entregasSistema.cartao,
        pagamentos_pix_sistema: entregasSistema.pix,
        pagamentos_dinheiro_informados: resumoAtual.dinheiro,
        pagamentos_cartao_informados: resumoAtual.cartao,
        pagamentos_pix_informados: resumoAtual.pix,
        portal_total_entregas: resumoPortal.totalEntregas,
        portal_total_receber: resumoPortal.totalReceber,
        portal_total_dinheiro_entregue: resumoPortal.totalDinheiroEntregue,
        portal_dinheiro: resumoPortal.dinheiro,
        portal_cartao: resumoPortal.cartao,
        portal_pix: resumoPortal.pix,
      }))
      await substituirMotoboysFechamentoHojeApi(payload)
      setModalDivergenciaOpen(false)
      setMotivoDivergencia('')
      setMensagem(haDivergenciaAtual
        ? 'Fechamento oficial dos motocas salvo com divergência justificada. O motivo já ficou registrado para o relatório e o PDF.'
        : 'Fechamento oficial dos motocas salvo com sucesso. O PDF e o lastro usam este fechamento do responsável.')
      carregar()
    } catch (error) {
      setMensagem(error.message || 'Falha ao salvar fechamento dos motocas.')
    }
  }

  function salvarFechamento() {
    if (!fechamentoPronto.length) {
      setMensagem('Preencha pelo menos um motoca antes de salvar.')
      return
    }
    if (haDivergenciaAtual) {
      setModalDivergenciaOpen(true)
      return
    }
    executarSalvarFechamento('')
  }

  function confirmarDivergencia() {
    if (!motivoDivergencia.trim()) {
      setMensagem('Explique o motivo da divergência antes de concluir.')
      return
    }
    executarSalvarFechamento(motivoDivergencia.trim())
  }

  return (
    <div className="stack gap-md compact-page">
      <div className="panel page-header compact-panel">
        <div>
          <h1>Motocas <span className="title-help-inline"><InfoHint text="Tela para conferência e fechamento oficial dos motocas. O portal do motoca envia uma prestação separada; aqui o responsável confere, ajusta e salva o fechamento final." /></span></h1>
          <p>Fechamento separado dos motocas, baseado nas notinhas impressas de entrega.</p>
        </div>
        <div className="mini-info warning-box motocas-note-box">
          <span>Aviso operacional</span>
          <strong>O sistema depende do preenchimento feito com base nas comandas impressas.</strong>
        </div>
      </div>

      {mensagem && <div className="alert">{mensagem}</div>}

      <div className="page-grid admin-layout compact-page-grid motocas-page-grid">
        <form className="panel stack gap-sm compact-panel" onSubmit={salvarConfiguracao}>
          <h3>Configuração dos motocas <span className="title-help-inline"><InfoHint text="Os valores definidos aqui são os valores oficiais do dia. O portal do motoca lê estes valores para calcular o total a receber." /></span></h3>
          <small className="muted">Esses valores ficam salvos no navegador e também servem de base para o portal do motoca.</small>
          <div className="grid-2 compact-grid compact-form-grid">
            <label><div className="label-inline-help"><span>Quantidade máxima de motoboys</span><InfoHint text="Limite máximo de motocas que podem ser usados na tela em um único dia." /></div><input type="number" min="1" max="10" value={configDraft.quantidade_motoboys} onChange={(e) => setConfigDraft((atual) => ({ ...atual, quantidade_motoboys: e.target.value }))} /></label>
            <label><div className="label-inline-help"><span>Valor normal</span><InfoHint text="Valor oficial pago por corrida normal." /></div><input value={configDraft.valor_entrega_normal} onChange={(e) => setConfigDraft((atual) => ({ ...atual, valor_entrega_normal: mascararMoedaInput(e.target.value) }))} inputMode="numeric" /></label>
            <label><div className="label-inline-help"><span>Valor distante</span><InfoHint text="Valor oficial pago por corrida distante ou especial." /></div><input value={configDraft.valor_entrega_distante} onChange={(e) => setConfigDraft((atual) => ({ ...atual, valor_entrega_distante: mascararMoedaInput(e.target.value) }))} inputMode="numeric" /></label>
            <label><div className="label-inline-help"><span>Motocas hoje</span><InfoHint text="Quantidade real de motocas que trabalharam hoje. A tela abre exatamente essa quantidade de linhas." /></div><input type="number" min="1" max={config.quantidade_motoboys} value={motoboysHoje} onChange={(e) => {
              const quantidade = Math.max(1, Math.min(config.quantidade_motoboys, Number(e.target.value || 1)))
              setMotoboysHoje(quantidade)
              setLinhas((atuais) => sincronizarLinhas(atuais, quantidade, config))
            }} /></label>
          </div>
          <button className="primary-btn compact-btn">Salvar configuração</button>
        </form>

        <div className="panel compact-panel stack gap-sm">
          <h3>Conferência do responsável <span className="title-help-inline"><InfoHint text="Este quadro compara o fechamento editável do responsável com o que o PDV registrou no dia." /></span></h3>
          <div className="grid-2 compact-grid">
            <div className="mini-info success-box"><span>Informações esperadas do sistema</span><strong>{entregasSistema.total} entrega(s)</strong><small>{resumoFormaTexto(entregasSistema)}</small></div>
            <div className="mini-info"><span>Informações confirmadas pelo responsável</span><strong>{resumoAtual.totalEntregas} entrega(s)</strong><small>{resumoFormaTexto(resumoAtual)}</small></div>
            <div className={`mini-info ${portalBateSistema ? 'success-box' : 'warning-box'}`}><span>Informações enviadas pelo motoca</span><strong>{resumoPortal.totalEntregas} entrega(s)</strong><small>{resumoFormaTexto(resumoPortal)}</small></div>
            <div className={`mini-info ${haDivergenciaAtual ? 'warning-box' : 'success-box'}`}><span>Status da conferência</span><strong>{haDivergenciaAtual ? 'Com divergência' : 'Batendo com o sistema'}</strong><small>{haDivergenciaAtual ? 'Você pode salvar, mas o sistema vai pedir o motivo.' : 'Tudo certo para fechar.'}</small></div>
          </div>
          <div className="item-actions wrap-actions">
            <button type="button" className="secondary-btn compact-btn" onClick={puxarDoPortal}>Puxar do portal do motoca</button>
            <button type="button" className="primary-btn compact-btn" onClick={salvarFechamento} disabled={carregando}>Salvar fechamento oficial</button>
          </div>
          <small className="muted">O PDF e o lastro usam o fechamento oficial salvo pelo responsável. O portal é uma base de conferência adicional.</small>
        </div>
      </div>

      <div className="grid-2 compact-grid">
        <div className="panel compact-panel stack gap-sm">
          <h3>Portal do motoca <span className="title-help-inline"><InfoHint text="Este quadro mostra o que os motocas informaram no portal. O responsável pode puxar esses dados para a grade editável e ajustar o que precisar." /></span></h3>
          <div className="grid-3 compact-grid">
            <div className="mini-info"><span>Prestação enviada</span><strong>{prestacoesPortalHoje.length}</strong><small>{resumoPortal.totalEntregas} entrega(s) no total.</small></div>
            <div className={`mini-info ${portalBateSistema ? 'success-box' : 'warning-box'}`}><span>Portal x sistema</span><strong>{portalBateSistema ? 'Bateu' : 'Divergente'}</strong><small>{resumoPortal.totalEntregas} / {entregasSistema.total}</small></div>
            <div className={`mini-info ${portalBateResponsavel ? 'success-box' : 'warning-box'}`}><span>Portal x responsável</span><strong>{portalBateResponsavel ? 'Bateu' : 'Ajustado'}</strong><small>{resumoPortal.totalEntregas} / {resumoAtual.totalEntregas}</small></div>
          </div>
          <div className="item-list compact-tall">
            {!prestacoesPortalHoje.length && <p className="muted">Nenhuma prestação do portal salva hoje.</p>}
            {prestacoesPortalHoje.map((item) => (
              <div className="panel soft-panel stack gap-sm" key={`portal-gerente-${item.id}`}>
                <div className="item-row wrap-row readable-row">
                  <div className="pedido-meta">
                    <strong>{item.nome || 'Sem nome'} • {Number(item.entregas_normais || 0) + Number(item.entregas_distantes || 0)} entrega(s)</strong>
                    <small>Normais {item.entregas_normais || 0} • Distantes {item.entregas_distantes || 0} • Dinheiro {item.entregas_dinheiro || 0} • Cartão {item.entregas_cartao || 0} • Pix {item.entregas_pix || 0}</small>
                    <small>Recebe {formatarMoeda(item.total || 0)} • Dinheiro entregue {formatarMoeda(item.dinheiro_entregue || 0)} • {dataHoraBR(item.updated_at || item.created_at)}</small>
                  </div>
                  <strong>{formatarMoeda(item.total || 0)}</strong>
                </div>
                {Array.isArray(item.entregas_detalhe) && item.entregas_detalhe.length > 0 ? (
                  <div className="item-list compact-tall portal-delivery-list">
                    {item.entregas_detalhe.map((detalhe, detalheIndex) => (
                      <div className="item-row wrap-row readable-row portal-delivery-row" key={`portal-gerente-${item.id}-entrega-${detalhe.id || detalheIndex}`}>
                        <div className="pedido-meta">
                          <strong>Entrega {detalheIndex + 1} • {detalhe.cliente_nome || 'Cliente opcional'}</strong>
                          {resumoEntregaPortal(detalhe).map((linha, linhaIndex) => (
                            <small key={`portal-gerente-${item.id}-entrega-${detalheIndex}-linha-${linhaIndex}`}>{linha}</small>
                          ))}
                        </div>
                        <strong>{detalhe.tipo_corrida === 'distante' ? formatarMoeda(config.valor_entrega_distante || 0) : formatarMoeda(config.valor_entrega_normal || 0)}</strong>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </div>

        <div className="panel compact-panel stack gap-sm">
          <h3>Histórico de entregas de hoje <span className="title-help-inline"><InfoHint text="Apoio para preencher os motocas olhando o que o PDV registrou no dia: pedido, cliente, origem, pagamento e horário." /></span></h3>
          <div className="item-list compact-tall">
            {!vendasHoje.length && <p className="muted">Nenhuma entrega paga registrada hoje.</p>}
            {vendasHoje.slice(0, 30).map((item) => (
              <div className="item-row wrap-row readable-row" key={`motocas-hist-${item.id}`}>
                <div className="pedido-meta">
                  <strong>Pedido {item.numero_pedido || 'Sem número'} • {item.cliente_nome || 'Sem cliente'}</strong>
                  <small>{nomeOrigem[item.origem] || item.origem || 'Sem origem'} • {pagamentosResumo(item)}</small>
                  <small>Total {formatarMoeda(item.total || 0)} • Taxa {formatarMoeda(item.taxa_entrega || 0)} • {dataHoraBR(item.criado_em || item.created_at)}</small>
                </div>
                <strong>{formatarMoeda(item.total || 0)}</strong>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="lastro-motoboys-grid compact-motoboys-list motocas-list-grid">
        {linhasVisiveis.map((item, index) => (
          <MotocaRow key={item.id} item={item} index={index} onChange={atualizarLinha} />
        ))}
      </div>

      <div className="grid-3 compact-grid">
        <div className="mini-info warning-box"><span>Total a pagar</span><strong>{formatarMoeda(resumoAtual.totalReceber)}</strong><small>Soma das corridas normais + distantes do fechamento oficial.</small></div>
        <div className="mini-info"><span>Dinheiro entregue</span><strong>{formatarMoeda(resumoAtual.totalDinheiroEntregue)}</strong><small>Quanto os motocas devolveram em espécie.</small></div>
        <div className={`mini-info ${haDivergenciaAtual ? 'warning-box' : ''}`}><span>Responsável da conferência</span><strong>{usuarioAtual?.nome || usuarioAtual?.usuario || 'Não identificado'}</strong><small>{usuarioAtual?.tipo ? tipoUsuarioLabel(usuarioAtual.tipo) : 'Sem perfil'} • {haDivergenciaAtual ? 'Vai pedir motivo ao salvar.' : 'Sem divergência no momento.'}</small></div>
      </div>

      <NativeModal
        open={modalDivergenciaOpen}
        title="Salvar fechamento com divergência"
        confirmLabel="Salvar assim mesmo"
        cancelLabel="Voltar e revisar"
        onClose={() => setModalDivergenciaOpen(false)}
        onConfirm={confirmarDivergencia}
      >
        <div className="stack gap-sm">
          <p>As informações não bateram totalmente. O sistema não vai bloquear o fechamento, mas precisa guardar o motivo da divergência.</p>
          <div className="grid-2 compact-grid">
            <div className="mini-info warning-box"><span>Esperado pelo sistema</span><strong>{entregasSistema.total} entrega(s)</strong><small>{resumoFormaTexto(entregasSistema)}</small></div>
            <div className="mini-info warning-box"><span>Fechado pelo responsável</span><strong>{resumoAtual.totalEntregas} entrega(s)</strong><small>{resumoFormaTexto(resumoAtual)}</small></div>
          </div>
          <label>Motivo da divergência
            <textarea value={motivoDivergencia} onChange={(e) => setMotivoDivergencia(e.target.value)} rows={4} placeholder="Ex.: um motoca não preencheu o portal, conferência foi feita pela notinha, cliente mudou a forma de pagamento, troca de maquininha..." />
          </label>
        </div>
      </NativeModal>
    </div>
  )
}
