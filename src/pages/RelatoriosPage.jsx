import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import InfoHint from '../components/InfoHint'
import NativeModal from '../components/NativeModal'
import { listarCaixasApi, listarMotoboysFechamentoApi, listarSaidasApi, listarVendasApi } from '../lib/api'
import { dataHoraBR, extrairDadosTrocoMotoboy, extrairMotivoExtorno, filtrarPorPeriodoPersonalizado, formatarMoeda, nomeOrigem, nomeTipoPedido, operadorDaVenda, pagamentosResumo, vendasPorOrigemETipo } from '../lib/utils'

function exportarCSV(nome, linhas) {
  const csv = linhas.map((linha) => linha.map((valor) => `"${String(valor ?? '').replaceAll('"', '""')}"`).join(';')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nome
  a.click()
  URL.revokeObjectURL(url)
}

function resumoPagamentos(vendasPagas) {
  const soma = { dinheiro: 0, pix: 0, credito: 0, debito: 0 }
  vendasPagas.forEach((venda) => {
    const pagamentos = venda.pagamentos_venda_pdv || venda.pagamentos || []
    pagamentos.forEach((pag) => {
      const chave = pag.forma_pagamento || pag.forma
      if (chave in soma) soma[chave] += Number(pag.valor_pago ?? pag.valor ?? 0)
    })
  })
  return soma
}

function formaPrincipalPedido(venda) {
  const pagamentos = venda.pagamentos_venda_pdv || venda.pagamentos || []
  if (!pagamentos.length) return 'nao_informado'
  const resumo = pagamentos.reduce((acc, pag) => {
    const chave = pag.forma_pagamento || pag.forma || 'nao_informado'
    acc[chave] = (acc[chave] || 0) + Number(pag.valor_pago ?? pag.valor ?? 0)
    return acc
  }, {})
  return Object.entries(resumo).sort((a, b) => b[1] - a[1])[0]?.[0] || 'nao_informado'
}

function resumoQuantidadePagamentos(vendasPagas) {
  return vendasPagas.reduce((acc, venda) => {
    const forma = formaPrincipalPedido(venda)
    if (forma in acc) acc[forma] += 1
    return acc
  }, { dinheiro: 0, pix: 0, credito: 0, debito: 0 })
}

function imprimirRelatorioCompleto({ titulo, resumoCards, entradas, saidas, motoboys, entregaResumo, caixaResumo, pagamentos, pagamentosQtd, motocaResumo = {} }) {
  const w = window.open('', '_blank', 'width=1280,height=900')
  if (!w) return
  const estilos = `
    body{font-family:Arial,sans-serif;padding:24px;color:#111}
    h1,h2,h3{margin:0 0 12px}
    p{margin:6px 0}
    .cards{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin:18px 0}
    .card{border:1px solid #d6d6d6;border-radius:10px;padding:12px;min-height:78px}
    .muted{color:#555}
    table{width:100%;border-collapse:collapse;margin:12px 0 24px}
    th,td{border:1px solid #d7d7d7;padding:8px;text-align:left;font-size:12px;vertical-align:top}
    .section{margin-top:22px}
    .obs{border:1px solid #f0c36d;background:#fff8e8;padding:12px;border-radius:10px}
  `
  const motoboysLista = motoboys.length ? motoboys : [{ nome: 'Sem fechamento lançado', entregas_normais: 0, entregas_distantes: 0, valor_normal: 0, valor_distante: 0, dinheiro_entregue: 0, total: 0 }]
  w.document.write(`<!doctype html><html><head><title>${titulo}</title><style>${estilos}</style></head><body>`)
  w.document.write(`<h1>${titulo}</h1><p class="muted">Relatório detalhado para fechamento gerencial e apoio ao lastro do dia.</p>`)
  w.document.write('<div class="obs"><strong>Observação:</strong> O sistema depende das informações adicionadas pelo operador ou gerente com base nas comandas impressas.</div>')
  w.document.write(`<div class="cards">${Object.entries(resumoCards).map(([k, v]) => `<div class="card"><strong>${k}</strong><br><div style="margin-top:10px;font-size:18px">${v}</div></div>`).join('')}</div>`)
  w.document.write(`<div class="section"><h2>Resumo do caixa</h2><table><tbody>
    <tr><th>Abertura</th><td>${formatarMoeda(caixaResumo.abertura || 0)}</td><th>Entradas</th><td>${formatarMoeda(caixaResumo.entradas || 0)}</td></tr>
    <tr><th>Saídas</th><td>${formatarMoeda(caixaResumo.saidas || 0)}</td><th>Saldo</th><td>${formatarMoeda(caixaResumo.saldo || 0)}</td></tr>
    <tr><th>Responsável abertura</th><td>${caixaResumo.responsavelAbertura || 'Não informado'}</td><th>Moedas contadas</th><td>${caixaResumo.moedasContadas || 'Sim'}</td></tr>
    <tr><th>Responsável fechamento</th><td>${caixaResumo.responsavelFechamento || 'Não informado'}</td><th>Motivo da divergência</th><td>${caixaResumo.motivoFechamento || '-'}</td></tr>
  </tbody></table></div>`)
  w.document.write(`<div class="section"><h2>Formas de pagamento</h2><table><tbody>
    <tr><th>Dinheiro</th><td>${formatarMoeda(pagamentos.dinheiro || 0)} • pedidos ${pagamentosQtd.dinheiro || 0}</td><th>Pix</th><td>${formatarMoeda(pagamentos.pix || 0)} • pedidos ${pagamentosQtd.pix || 0}</td></tr>
    <tr><th>Crédito</th><td>${formatarMoeda(pagamentos.credito || 0)} • pedidos ${pagamentosQtd.credito || 0}</td><th>Débito</th><td>${formatarMoeda(pagamentos.debito || 0)} • pedidos ${pagamentosQtd.debito || 0}</td></tr>
  </tbody></table></div>`)
  w.document.write(`<div class="section"><h2>Entregas</h2><table><tbody>
    <tr><th>Total de entregas</th><td>${entregaResumo.quantidade}</td><th>Taxa de entrega</th><td>${formatarMoeda(entregaResumo.taxa || 0)}</td></tr>
    <tr><th>Goomer</th><td>${entregaResumo.goomer}</td><th>Ceofood</th><td>${entregaResumo.ceofood}</td></tr>
  </tbody></table></div>`)
  w.document.write(`<div class="section"><h2>Fechamento dos motocas</h2><table><tbody>
    <tr><th>Conferido por</th><td>${motocaResumo.conferidoPor || 'Não informado'}</td><th>Status</th><td>${motocaResumo.divergencia ? 'Com divergência' : 'Sem divergência'}</td></tr>
    <tr><th>Esperado</th><td>${motocaResumo.esperado || '-'}</td><th>Fechado</th><td>${motocaResumo.fechado || '-'}</td></tr>
    <tr><th>Portal</th><td>${motocaResumo.portal || '-'}</td><th>Motivo</th><td>${motocaResumo.motivo || '-'}</td></tr>
  </tbody></table>`)
  w.document.write('<table><thead><tr><th>Nome</th><th>Normais</th><th>Distantes</th><th>Valor normal</th><th>Valor distante</th><th>Recebe</th><th>Dinheiro entregue</th></tr></thead><tbody>')
  motoboysLista.forEach((item) => {
    w.document.write(`<tr><td>${item.nome}</td><td>${item.entregas_normais}</td><td>${item.entregas_distantes}</td><td>${formatarMoeda(item.valor_normal)}</td><td>${formatarMoeda(item.valor_distante)}</td><td>${formatarMoeda(item.total)}</td><td>${formatarMoeda(item.dinheiro_entregue || 0)}</td></tr>`)
  })
  w.document.write('</tbody></table></div>')
  w.document.write('<div class="section"><h2>Entradas detalhadas</h2><table><thead><tr><th>Pedido</th><th>Tipo</th><th>Pagamento</th><th>Troco motoboy</th><th>Valor</th><th>Operador</th><th>Horário</th></tr></thead><tbody>')
  entradas.forEach((item) => { const troco = extrairDadosTrocoMotoboy(item.observacao || ''); w.document.write(`<tr><td>${item.numero_pedido || ''}</td><td>${nomeTipoPedido[item.tipo] || item.tipo || ''}</td><td>${pagamentosResumo(item)}</td><td>${troco ? `Troco para ${formatarMoeda(troco.trocoPara)} • Troco ${formatarMoeda(troco.trocoCliente)}` : '-'}</td><td>${formatarMoeda(item.pago || item.total || 0)}</td><td>${operadorDaVenda(item)}</td><td>${dataHoraBR(item.criado_em || item.created_at)}</td></tr>`) })
  w.document.write('</tbody></table></div>')
  w.document.write('<div class="section"><h2>Saídas detalhadas</h2><table><thead><tr><th>Tipo</th><th>Descrição</th><th>Valor</th><th>Operador</th><th>Horário</th></tr></thead><tbody>')
  saidas.forEach((item) => w.document.write(`<tr><td>${item.tipo}</td><td>${item.observacao || ''}</td><td>${formatarMoeda(item.valor || 0)}</td><td>${operadorDaVenda(item)}</td><td>${dataHoraBR(item.criado_em || item.created_at)}</td></tr>`))
  w.document.write('</tbody></table></div></body></html>')
  w.document.close()
  w.focus()
  setTimeout(() => w.print(), 300)
}

export default function RelatoriosPage() {
  const navigate = useNavigate()
  const [periodo, setPeriodo] = useState('hoje')
  const [dataInicio, setDataInicio] = useState('')
  const [dataFim, setDataFim] = useState('')
  const [vendas, setVendas] = useState([])
  const [saidas, setSaidas] = useState([])
  const [caixas, setCaixas] = useState([])
  const [motoboysFechamento, setMotoboysFechamento] = useState([])
  const [mensagem, setMensagem] = useState('')
  const [filtroOrigem, setFiltroOrigem] = useState('todos')
  const [filtroTipo, setFiltroTipo] = useState('todos')
  const [lastroOpen, setLastroOpen] = useState(false)

  async function carregar() {
    try {
      const [v, s, c, m] = await Promise.all([listarVendasApi(), listarSaidasApi(), listarCaixasApi(), listarMotoboysFechamentoApi()])
      setVendas(v)
      setSaidas(s)
      setCaixas(c)
      setMotoboysFechamento(m)
    } catch (error) {
      setMensagem(error.message || 'Falha ao carregar relatórios.')
    }
  }

  useEffect(() => { carregar() }, [])

  const filtros = { periodo, dataInicio, dataFim }
  const vendasBase = useMemo(() => filtrarPorPeriodoPersonalizado(vendas, 'criado_em', filtros), [vendas, periodo, dataInicio, dataFim])
  const saidasPeriodo = useMemo(() => filtrarPorPeriodoPersonalizado(saidas, 'criado_em', filtros), [saidas, periodo, dataInicio, dataFim])
  const caixasPeriodo = useMemo(() => filtrarPorPeriodoPersonalizado(caixas, 'data_abertura', filtros), [caixas, periodo, dataInicio, dataFim])
  const motoboysPeriodo = useMemo(() => filtrarPorPeriodoPersonalizado(motoboysFechamento, 'created_at', filtros), [motoboysFechamento, periodo, dataInicio, dataFim])

  const vendasFiltradas = useMemo(() => vendasBase.filter((item) => {
    const bateOrigem = filtroOrigem === 'todos' || item.origem === filtroOrigem
    const bateTipo = filtroTipo === 'todos' || item.tipo === filtroTipo
    return bateOrigem && bateTipo
  }), [vendasBase, filtroOrigem, filtroTipo])

  const vendasPagas = useMemo(() => vendasFiltradas.filter((item) => item.status === 'pago'), [vendasFiltradas])
  const entregasPagas = useMemo(() => vendasPagas.filter((item) => item.tipo === 'entrega'), [vendasPagas])
  const pagamentosPorForma = useMemo(() => resumoPagamentos(vendasPagas), [vendasPagas])
  const pagamentosQtd = useMemo(() => resumoQuantidadePagamentos(vendasPagas), [vendasPagas])
  const totalEntradas = vendasPagas.reduce((s, item) => s + Number(item.pago || item.total || 0), 0)
  const totalExtornado = vendasFiltradas.filter((item) => item.status === 'cancelado').reduce((s, item) => s + Number(item.total || 0), 0)
  const totalSaidas = saidasPeriodo.reduce((s, item) => s + Number(item.valor || 0), 0)
  const sangrias = saidasPeriodo.filter((item) => item.tipo === 'sangria').reduce((s, item) => s + Number(item.valor || 0), 0)
  const trocoMotoca = saidasPeriodo.filter((item) => item.tipo === 'troco_motoca').reduce((s, item) => s + Number(item.valor || 0), 0)
  const outrasSaidas = totalSaidas - sangrias - trocoMotoca
  const trocosPorPedido = useMemo(() => (saidasPeriodo || []).reduce((acc, item) => {
    if (item.tipo !== 'troco_motoca') return acc
    const dados = extrairDadosTrocoMotoboy(item.observacao || '')
    if (!dados?.pedido) return acc
    acc[dados.pedido] = { ...dados, horario: item.criado_em || item.created_at, motoboy: item.motoca_nome || '' }
    return acc
  }, {}), [saidasPeriodo])
  const saldo = totalEntradas - totalSaidas
  const origemTipo = useMemo(() => vendasPorOrigemETipo(vendasPagas), [vendasPagas])
  const totalTaxaEntrega = entregasPagas.reduce((s, item) => s + Number(item.taxa_entrega || 0), 0)
  const totalPagamentoMotoboys = motoboysPeriodo.reduce((s, item) => s + Number(item.total || 0), 0)
  const totalRecebidoMotoboys = motoboysPeriodo.reduce((s, item) => s + Number(item.dinheiro_entregue || 0), 0)
  const totalEntregas = entregasPagas.length
  const entregasPorOrigem = {
    goomer: entregasPagas.filter((item) => item.origem === 'goomer').length,
    ceofood: entregasPagas.filter((item) => item.origem === 'ceofood').length,
  }
  const topMotoboys = motoboysPeriodo.filter((item) => String(item.nome || '').trim()).slice(0, 5)
  const motocaMeta = motoboysPeriodo[0] || {}

  const resumoExport = {
    Entradas: formatarMoeda(totalEntradas),
    Sangrias: formatarMoeda(sangrias),
    'Troco motoboy': formatarMoeda(trocoMotoca),
    Saldo: formatarMoeda(saldo),
    Entregas: String(totalEntregas),
    'Taxa de entrega': formatarMoeda(totalTaxaEntrega),
    'Pagamento motocas': formatarMoeda(totalPagamentoMotoboys),
    'Dinheiro entregue motocas': formatarMoeda(totalRecebidoMotoboys),
  }

  function baixarCSVVendas() {
    exportarCSV('relatorio-vendas.csv', [
      ['Pedido', 'Tipo', 'Origem', 'Cliente/Mesa', 'Status', 'Taxa entrega', 'Total', 'Pago', 'Pagamentos', 'Motivo extorno'],
      ...vendasFiltradas.map((item) => [item.numero_pedido || '', nomeTipoPedido[item.tipo] || item.tipo || '', nomeOrigem[item.origem] || item.origem || '', item.cliente_nome || (item.mesa_nome ? `Mesa ${item.mesa_nome}` : ''), item.status, item.taxa_entrega || 0, item.total || 0, item.pago || 0, pagamentosResumo(item), extrairMotivoExtorno(item.observacao)]),
    ])
  }

  function baixarCSVSaidas() {
    exportarCSV('relatorio-saidas.csv', [
      ['Tipo', 'Operador', 'Observação', 'Valor', 'Criado em'],
      ...saidasPeriodo.map((item) => [item.tipo, item.operador || item.usuario_id || '', item.observacao || '', item.valor || 0, item.criado_em || '']),
    ])
  }

  return (
    <div className="stack gap-md compact-page">
      <div className="panel page-header compact-panel">
        <div>
          <h1>Relatórios <span className="title-help-inline"><InfoHint text="Aqui ficam os números do caixa, das vendas, das saídas, das entregas e do fechamento dos motocas." /></span></h1>
          <p>Visual financeiro do caixa, das entregas e do fechamento dos motocas já salvo em tela separada.</p>
        </div>
        <div className="stack gap-sm period-box">
          <label>Período
            <select className="period-select" value={periodo} onChange={(e) => setPeriodo(e.target.value)}>
              <option value="hoje">Hoje</option>
              <option value="mes">Este mês</option>
              <option value="personalizado">Período personalizado</option>
              <option value="todos">Todo histórico</option>
            </select>
          </label>
          {periodo === 'personalizado' && (
            <div className="grid-2 compact-grid">
              <label>Data inicial<input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} /></label>
              <label>Data final<input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} /></label>
            </div>
          )}
          <div className="grid-2 compact-grid compact-form-grid">
            <label>Origem<select value={filtroOrigem} onChange={(e) => setFiltroOrigem(e.target.value)}><option value="todos">Todas</option><option value="goomer">Goomer</option><option value="ceofood">Ceofood</option><option value="balcao">Balcão</option></select></label>
            <label>Tipo<select value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value)}><option value="todos">Todos</option><option value="mesa">Mesa</option><option value="balcao">Balcão</option><option value="retirada">Retirada</option><option value="entrega">Entrega</option></select></label>
          </div>
        </div>
      </div>

      {mensagem && <div className="alert">{mensagem}</div>}

      <div className="item-actions wrap-actions export-actions">
        <button className="ghost-btn compact-btn" onClick={baixarCSVVendas}>Exportar vendas (Excel/CSV)</button>
        <button className="ghost-btn compact-btn" onClick={baixarCSVSaidas}>Exportar saídas (Excel/CSV)</button>
        <button className="secondary-btn compact-btn" onClick={() => navigate('/motocas')}>Abrir motocas</button>
        <button className="secondary-btn compact-btn" onClick={() => setLastroOpen(true)}>Fechamento / lastro</button>
        <button className="primary-btn compact-btn" onClick={() => imprimirRelatorioCompleto({
          titulo: 'Lastro do dia - Speed PDV',
          resumoCards: resumoExport,
          entradas: vendasPagas,
          saidas: saidasPeriodo,
          motoboys: motoboysPeriodo,
          entregaResumo: { quantidade: totalEntregas, taxa: totalTaxaEntrega, goomer: entregasPorOrigem.goomer, ceofood: entregasPorOrigem.ceofood },
          caixaResumo: { abertura: caixasPeriodo[0]?.valor_abertura || caixasPeriodo[0]?.valor_inicial || 0, entradas: totalEntradas, saidas: totalSaidas, saldo },
          pagamentos: pagamentosPorForma,
          pagamentosQtd,
          motocaResumo: {
            conferidoPor: [motocaMeta.conferido_por_nome, motocaMeta.conferido_por_tipo].filter(Boolean).join(' • '),
            divergencia: Boolean(motocaMeta.divergencia),
            motivo: motocaMeta.motivo_divergencia || '',
            esperado: `${motocaMeta.total_entregas_sistema || totalEntregas} entrega(s) • Dinheiro ${motocaMeta.pagamentos_dinheiro_sistema || 0} • Cartão ${motocaMeta.pagamentos_cartao_sistema || 0} • Pix ${motocaMeta.pagamentos_pix_sistema || 0}`,
            fechado: `${motocaMeta.total_entregas_informadas || motoboysPeriodo.reduce((s, item) => s + Number(item.entregas_normais || 0) + Number(item.entregas_distantes || 0), 0)} entrega(s) • Dinheiro ${motocaMeta.pagamentos_dinheiro_informados || 0} • Cartão ${motocaMeta.pagamentos_cartao_informados || 0} • Pix ${motocaMeta.pagamentos_pix_informados || 0}`,
            portal: `${motocaMeta.portal_total_entregas || 0} entrega(s) • Dinheiro ${motocaMeta.portal_dinheiro || 0} • Cartão ${motocaMeta.portal_cartao || 0} • Pix ${motocaMeta.portal_pix || 0}`,
          },
        })}>Imprimir / Salvar em PDF</button>
      </div>

      <div className="cards-grid four compact-cards-grid">
        <div className="metric-card" title="Soma das vendas pagas no período."><span>Entradas ⓘ</span><strong>{formatarMoeda(totalEntradas)}</strong></div>
        <div className="metric-card danger" title="Total retirado do caixa por sangria no período."><span>Sangrias ⓘ</span><strong>{formatarMoeda(sangrias)}</strong></div>
        <div className="metric-card warning" title="Total entregue como troco para motoboy."><span>Troco motoboy ⓘ</span><strong>{formatarMoeda(trocoMotoca)}</strong></div>
        <div className="metric-card" title="Entradas menos saídas do período filtrado."><span>Saldo ⓘ</span><strong>{formatarMoeda(saldo)}</strong></div>
        <div className="metric-card"><span>Outras saídas</span><strong>{formatarMoeda(outrasSaidas)}</strong></div>
        <div className="metric-card" title="Quantidade de pedidos totalmente quitados no período filtrado."><span>Vendas pagas ⓘ</span><strong>{vendasPagas.length}</strong></div>
        <div className="metric-card danger"><span>Extornos</span><strong>{formatarMoeda(totalExtornado)}</strong></div>
        <div className="metric-card"><span>Caixas no período</span><strong>{caixasPeriodo.length}</strong></div>
      </div>

      <div className="cards-grid four compact-cards-grid payment-breakdown">
        <div className="metric-card"><span>Dinheiro</span><strong>{formatarMoeda(pagamentosPorForma.dinheiro)}</strong></div>
        <div className="metric-card"><span>Pix</span><strong>{formatarMoeda(pagamentosPorForma.pix)}</strong></div>
        <div className="metric-card"><span>Crédito</span><strong>{formatarMoeda(pagamentosPorForma.credito)}</strong></div>
        <div className="metric-card"><span>Débito</span><strong>{formatarMoeda(pagamentosPorForma.debito)}</strong></div>
      </div>

      <div className="cards-grid four compact-cards-grid payment-breakdown">
        <div className="metric-card"><span>Goomer</span><strong>{formatarMoeda(origemTipo.origem.goomer)}</strong></div>
        <div className="metric-card"><span>Ceofood</span><strong>{formatarMoeda(origemTipo.origem.ceofood)}</strong></div>
        <div className="metric-card"><span>Balcão (origem)</span><strong>{formatarMoeda(origemTipo.origem.balcao)}</strong></div>
        <div className="metric-card"><span>Mesa</span><strong>{formatarMoeda(origemTipo.tipo.mesa)}</strong></div>
        <div className="metric-card"><span>Balcão (tipo)</span><strong>{formatarMoeda(origemTipo.tipo.balcao)}</strong></div>
        <div className="metric-card"><span>Retirada</span><strong>{formatarMoeda(origemTipo.tipo.retirada)}</strong></div>
        <div className="metric-card success-box"><span>Entregas</span><strong>{totalEntregas}</strong><small>Goomer {entregasPorOrigem.goomer} • Ceofood {entregasPorOrigem.ceofood}</small></div>
        <div className="metric-card success-box"><span>Taxa de entrega</span><strong>{formatarMoeda(totalTaxaEntrega)}</strong><small>Total das taxas lançadas</small></div>
        <div className="metric-card warning motoboy-card-detail">
          <span>Pagamento motocas</span>
          <strong>{formatarMoeda(totalPagamentoMotoboys)}</strong>
          <small>Dinheiro entregue: {formatarMoeda(totalRecebidoMotoboys)}</small>
          {!!topMotoboys.length && <div className="metric-list">{topMotoboys.map((item) => <div key={`${item.id || item.nome}-${item.created_at || ''}`}><span>{item.nome}</span><strong>{formatarMoeda(item.total || 0)}</strong></div>)}</div>}
        </div>
        <div className="metric-card"><span>Entrega (tipo)</span><strong>{formatarMoeda(origemTipo.tipo.entrega || 0)}</strong></div>
      </div>

      <div className="page-grid admin-layout compact-page-grid">
        <div className="panel compact-panel">
          <h3>Entradas detalhadas</h3>
          <div className="item-list compact-tall">
            {vendasPagas.slice(0, 20).map((item) => (
              <div className="item-row wrap-row readable-row" key={item.id}>
                <div className="pedido-meta">
                  <strong>Pedido {item.numero_pedido || 'Sem número'} • {nomeTipoPedido[item.tipo] || item.tipo}</strong>
                  <small>{nomeOrigem[item.origem] || item.origem || 'Sem origem'} • {item.cliente_nome || (item.mesa_nome ? `Mesa ${item.mesa_nome}` : 'Sem nome')}</small>
                  <small>Pagamento: {pagamentosResumo(item)}</small>
                  <small>Operador: {operadorDaVenda(item)} • Horário: {dataHoraBR(item.criado_em || item.created_at)}</small>
                </div>
                <strong>{formatarMoeda(item.pago || item.total || 0)}</strong>
              </div>
            ))}
            {!vendasPagas.length && <p className="muted">Nenhuma entrada no período.</p>}
          </div>
        </div>
        <div className="panel compact-panel">
          <h3>Saídas detalhadas</h3>
          <div className="item-list compact-tall">
            {saidasPeriodo.slice(0, 20).map((item) => (
              <div className="item-row wrap-row readable-row" key={item.id}>
                <div className="pedido-meta">
                  <strong>{item.tipo === 'troco_motoca' ? 'Troco de motoboy' : item.tipo === 'sangria' ? 'Sangria' : 'Outra saída'}</strong>
                  <small>{item.observacao || 'Sem observação'}</small>
                  <small>Operador: {operadorDaVenda(item)} • Horário: {dataHoraBR(item.criado_em || item.created_at)}</small>
                </div>
                <strong>{formatarMoeda(item.valor)}</strong>
              </div>
            ))}
            {!saidasPeriodo.length && <p className="muted">Nenhuma saída no período.</p>}
          </div>
        </div>
      </div>

      <NativeModal
        open={lastroOpen}
        title="Fechamento do caixa / lastro"
        confirmLabel="Fechar"
        cancelLabel="Voltar"
        onConfirm={() => setLastroOpen(false)}
        onClose={() => setLastroOpen(false)}
      >
        <div className="lastro-modal-content stack gap-sm">
          <div className="alert warning">
            O sistema depende das informações adicionadas pelo operador com base na notinha impressa. O fechamento dos motocas agora fica em tela separada.
          </div>
          <div className="grid-3 compact-grid">
            <div className="mini-info"><span>Abertura</span><strong>{formatarMoeda(caixasPeriodo[0]?.valor_abertura || caixasPeriodo[0]?.valor_inicial || 0)}</strong></div>
            <div className="mini-info success-box"><span>Entradas</span><strong>{formatarMoeda(totalEntradas)}</strong></div>
            <div className="mini-info danger-box"><span>Saídas</span><strong>{formatarMoeda(totalSaidas)}</strong></div>
          </div>
          <div className="grid-3 compact-grid">
            <div className="mini-info"><span>Saldo</span><strong>{formatarMoeda(saldo)}</strong></div>
            <div className="mini-info"><span>Entregas do período</span><strong>{totalEntregas}</strong></div>
            <div className="mini-info"><span>Taxa de entrega</span><strong>{formatarMoeda(totalTaxaEntrega)}</strong></div>
          </div>
          <div className="grid-2 compact-grid">
            <div className="panel compact-panel stack gap-sm">
              <h3>Responsáveis do caixa</h3>
              <small>Abertura: {[caixasPeriodo[0]?.responsavel_abertura_nome, caixasPeriodo[0]?.responsavel_abertura_tipo].filter(Boolean).join(' • ') || 'Não informado'}</small>
              <small>Fechamento: {[caixasPeriodo[0]?.responsavel_fechamento_nome, caixasPeriodo[0]?.responsavel_fechamento_tipo].filter(Boolean).join(' • ') || 'Não informado'}</small>
            </div>
            <div className="panel compact-panel stack gap-sm">
              <h3>Contagem inicial</h3>
              <small>Moedas contadas: {caixasPeriodo[0]?.moedas_nao_contadas ? 'Não' : 'Sim'}</small>
              <small>{caixasPeriodo[0]?.motivo_fechamento ? `Motivo da divergência: ${caixasPeriodo[0]?.motivo_fechamento}` : 'Sem motivo de divergência registrado.'}</small>
            </div>
          </div>
          <div className="item-actions wrap-actions">
            <button
              type="button"
              className="primary-btn compact-btn"
              onClick={() => imprimirRelatorioCompleto({
                titulo: 'Lastro do dia - Speed PDV',
                resumoCards: resumoExport,
                entradas: vendasPagas,
                saidas: saidasPeriodo,
                motoboys: motoboysPeriodo,
                entregaResumo: { quantidade: totalEntregas, taxa: totalTaxaEntrega, goomer: entregasPorOrigem.goomer, ceofood: entregasPorOrigem.ceofood },
                caixaResumo: {
                  abertura: caixasPeriodo[0]?.valor_abertura || caixasPeriodo[0]?.valor_inicial || 0,
                  entradas: totalEntradas,
                  saidas: totalSaidas,
                  saldo,
                  responsavelAbertura: [caixasPeriodo[0]?.responsavel_abertura_nome, caixasPeriodo[0]?.responsavel_abertura_tipo].filter(Boolean).join(' • '),
                  responsavelFechamento: [caixasPeriodo[0]?.responsavel_fechamento_nome, caixasPeriodo[0]?.responsavel_fechamento_tipo].filter(Boolean).join(' • '),
                  moedasContadas: caixasPeriodo[0]?.moedas_nao_contadas ? 'Não' : 'Sim',
                  motivoFechamento: caixasPeriodo[0]?.motivo_fechamento || '',
                },
                pagamentos: pagamentosPorForma,
                pagamentosQtd,
                motocaResumo: {
                  conferidoPor: [motocaMeta.conferido_por_nome, motocaMeta.conferido_por_tipo].filter(Boolean).join(' • '),
                  divergencia: Boolean(motocaMeta.divergencia),
                  motivo: motocaMeta.motivo_divergencia || '',
                  esperado: `${motocaMeta.total_entregas_sistema || totalEntregas} entrega(s) • Dinheiro ${motocaMeta.pagamentos_dinheiro_sistema || 0} • Cartão ${motocaMeta.pagamentos_cartao_sistema || 0} • Pix ${motocaMeta.pagamentos_pix_sistema || 0}`,
                  fechado: `${motocaMeta.total_entregas_informadas || motoboysPeriodo.reduce((s, item) => s + Number(item.entregas_normais || 0) + Number(item.entregas_distantes || 0), 0)} entrega(s) • Dinheiro ${motocaMeta.pagamentos_dinheiro_informados || 0} • Cartão ${motocaMeta.pagamentos_cartao_informados || 0} • Pix ${motocaMeta.pagamentos_pix_informados || 0}`,
                  portal: `${motocaMeta.portal_total_entregas || 0} entrega(s) • Dinheiro ${motocaMeta.portal_dinheiro || 0} • Cartão ${motocaMeta.portal_cartao || 0} • Pix ${motocaMeta.portal_pix || 0}`,
                },
              })}
            >
              Imprimir / Salvar em PDF
            </button>
            <button type="button" className="ghost-btn compact-btn" onClick={() => { setLastroOpen(false); navigate('/motocas') }}>Abrir motocas</button>
          </div>
          <div className="grid-2 compact-grid">
            <div className="panel compact-panel stack gap-sm">
              <h3>Formas de pagamento <span className="title-help-inline"><InfoHint text="Aqui aparecem os valores recebidos e também a quantidade de comandas por forma principal de pagamento no período." /></span></h3>
              <small>Dinheiro {formatarMoeda(pagamentosPorForma.dinheiro)} [{pagamentosQtd.dinheiro}] • Pix {formatarMoeda(pagamentosPorForma.pix)} [{pagamentosQtd.pix}] • Crédito {formatarMoeda(pagamentosPorForma.credito)} [{pagamentosQtd.credito}] • Débito {formatarMoeda(pagamentosPorForma.debito)} [{pagamentosQtd.debito}]</small>
            </div>
            <div className="panel compact-panel stack gap-sm">
              <h3>Origem das entregas</h3>
              <small>Goomer {entregasPorOrigem.goomer} • Ceofood {entregasPorOrigem.ceofood}</small>
            </div>
          </div>
          <div className="panel compact-panel stack gap-sm">
            <div className="item-actions wrap-actions between-actions">
              <div>
                <h3>Histórico por comanda <span className="title-help-inline"><InfoHint text="Lista resumida das comandas do período com número do pedido, pagamento, cliente e horário." /></span></h3>
                <small className="muted">Use esta lista para conferir as comandas e a forma de pagamento antes do fechamento final.</small>
              </div>
            </div>
            <div className="item-list compact-tall">
              {vendasPagas.slice(0, 30).map((item) => {
                const troco = trocosPorPedido[item.numero_pedido] || extrairDadosTrocoMotoboy(item.observacao || '')
                return (
                  <div className="item-row wrap-row readable-row" key={`lastro-${item.id}`}>
                    <div className="pedido-meta">
                      <strong>Pedido {item.numero_pedido || 'Sem número'} • {nomeTipoPedido[item.tipo] || item.tipo}</strong>
                      <small>{item.cliente_nome || (item.mesa_nome ? `Mesa ${item.mesa_nome}` : 'Sem identificação')}</small>
                      <small>Pagamento: {pagamentosResumo(item)}</small>
                      {troco && <small>Troco motoboy: para {formatarMoeda(troco.trocoPara)} • troco {formatarMoeda(troco.trocoCliente)}{troco.motoboy ? ` • ${troco.motoboy}` : ''}</small>}
                      <small>Horário: {dataHoraBR(item.criado_em || item.created_at)}</small>
                    </div>
                    <strong>{formatarMoeda(item.pago || item.total || 0)}</strong>
                  </div>
                )
              })}
              {!vendasPagas.length && <p className="muted">Nenhuma comanda paga encontrada no período.</p>}
            </div>
          </div>

          <div className="panel compact-panel stack gap-sm">
            <div className="item-actions wrap-actions between-actions">
              <div>
                <h3>Histórico de troco de motoboy <span className="title-help-inline"><InfoHint text="Conferência dos trocos lançados para entregas no período do lastro." /></span></h3>
                <small className="muted">Trocos lançados no caixa, com pedido, cliente e valor do troco.</small>
              </div>
            </div>
            <div className="item-list compact-tall">
              {saidasPeriodo.filter((item) => item.tipo === 'troco_motoca').slice(0, 20).map((item) => {
                const troco = extrairDadosTrocoMotoboy(item.observacao || '')
                return (
                  <div className="item-row wrap-row readable-row" key={`troco-${item.id}`}>
                    <div className="pedido-meta">
                      <strong>Pedido {troco?.pedido || 'Sem número'} • {item.motoca_nome || 'Motoboy opcional'}</strong>
                      <small>{troco?.cliente || 'Cliente não informado'}</small>
                      <small>{troco ? `Conta ${formatarMoeda(troco.conta)} • Troco para ${formatarMoeda(troco.trocoPara)} • Troco do cliente ${formatarMoeda(troco.trocoCliente)}` : (item.observacao || 'Sem observação')}</small>
                      <small>Operador: {operadorDaVenda(item)} • Horário: {dataHoraBR(item.criado_em || item.created_at)}</small>
                    </div>
                    <strong>{formatarMoeda(item.valor || 0)}</strong>
                  </div>
                )
              })}
              {!saidasPeriodo.some((item) => item.tipo === 'troco_motoca') && <p className="muted">Nenhum troco de motoboy lançado no período.</p>}
            </div>
          </div>

          <div className="panel compact-panel stack gap-sm">
            <div className="item-actions wrap-actions between-actions">
              <div>
                <h3>Resumo dos motocas</h3>
                <small className="muted">Os valores abaixo são lidos da página Motocas.</small>
              </div>
              <button type="button" className="ghost-btn compact-btn" onClick={() => { setLastroOpen(false); navigate('/motocas') }}>Abrir motocas</button>
            </div>
            <div className="grid-3 compact-grid">
              <div className="mini-info warning-box"><span>Total geral motocas</span><strong>{formatarMoeda(totalPagamentoMotoboys)}</strong><small>Total que a gerente vai pagar.</small></div>
              <div className="mini-info"><span>Dinheiro entregue</span><strong>{formatarMoeda(totalRecebidoMotoboys)}</strong><small>Total devolvido ao gerente.</small></div>
              <div className="mini-info"><span>Linhas salvas</span><strong>{motoboysPeriodo.length}</strong><small>Fechamentos encontrados no período.</small></div>
            </div>
            <div className={`mini-info ${motocaMeta.divergencia ? 'warning-box' : ''}`}><span>Status da conferência</span><strong>{motocaMeta.divergencia ? 'Com divergência' : 'Sem divergência'}</strong><small>{motocaMeta.divergencia ? (motocaMeta.motivo_divergencia || 'Motivo não informado') : ([motocaMeta.conferido_por_nome, motocaMeta.conferido_por_tipo].filter(Boolean).join(' • ') || 'Sem responsável registrado')}</small></div>
            <div className="item-list compact-tall">
              {motoboysPeriodo.map((item) => (
                <div className="item-row wrap-row readable-row" key={`${item.id}-${item.created_at || item.criado_em || ''}`}>
                  <div className="pedido-meta">
                    <strong>{item.nome || 'Motoboy sem nome'}</strong>
                    <small>Normais {item.entregas_normais || 0} • Distantes {item.entregas_distantes || 0}</small>
                    <small>Valor normal {formatarMoeda(item.valor_normal || 0)} • Valor distante {formatarMoeda(item.valor_distante || 0)}</small>
                    <small>Dinheiro entregue {formatarMoeda(item.dinheiro_entregue || 0)} • {dataHoraBR(item.created_at || item.criado_em)}</small>
                    {item.divergencia ? <small>Motivo da divergência: {item.motivo_divergencia || 'Não informado'}</small> : <small>Sem divergência registrada.</small>}
                    <small>Conferido por: {[item.conferido_por_nome, item.conferido_por_tipo].filter(Boolean).join(' • ') || 'Não informado'}</small>
                  </div>
                  <strong>{formatarMoeda(item.total || 0)}</strong>
                </div>
              ))}
              {!motoboysPeriodo.length && <p className="muted">Nenhum fechamento de motoca salvo no período.</p>}
            </div>
          </div>
        </div>
      </NativeModal>
    </div>
  )
}
