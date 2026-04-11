import { useEffect, useMemo, useState } from 'react'
import NativeModal from '../components/NativeModal'
import { estornarVendaApi, listarPendentesApi, listarVendasApi, marcarVendaComoPagaApi, obterCaixaAbertoApi } from '../lib/api'
import { obterSessao } from '../lib/auth'
import { buscarPorPedidoOuCliente, dataHoraBR, formatarMoeda, formasPagamento, mascararMoedaInput, nomeOrigem, nomeTipoPedido, operadorDaVenda, pagamentosResumo, parseNumero } from '../lib/utils'

function LinhaPedido({ pedido, onQuitar, onExtornar }) {
  return (
    <div className="item-row wrap-row readable-row" key={pedido.id}>
      <div className="pedido-meta">
        <div className="pedido-topo"><strong>Pedido {pedido.numero_pedido || 'Sem número'}</strong></div>
        <small>{nomeTipoPedido[pedido.tipo] || pedido.tipo} • {nomeOrigem[pedido.origem] || pedido.origem || 'Sem origem'} • {pedido.cliente_nome || (pedido.mesa_nome ? `Mesa ${pedido.mesa_nome}` : 'Sem nome')}</small>
        <small>Status: {pedido.status} • Total {formatarMoeda(pedido.total || 0)} • Falta {formatarMoeda(pedido.restante || pedido.total || 0)}</small>
        <small>Operador: {operadorDaVenda(pedido)} • Horário: {dataHoraBR(pedido.criado_em || pedido.created_at)}</small>
        <small>{pagamentosResumo(pedido)}</small>
      </div>
      <div className="item-actions wrap-actions">
        {pedido.status === 'pendente' && <button className="secondary-btn compact-btn" onClick={() => onQuitar(pedido)}>Marcar pago</button>}
        {pedido.status !== 'cancelado' && <button className="danger-btn compact-btn" onClick={() => onExtornar(pedido.id)}>Extornar</button>}
        {pedido.status === 'cancelado' && <span className="badge danger">Extornado</span>}
      </div>
    </div>
  )
}

export default function PendentesPage() {
  const usuario = obterSessao()
  const [pendentes, setPendentes] = useState([])
  const [vendas, setVendas] = useState([])
  const [caixaAtual, setCaixaAtual] = useState(null)
  const [busca, setBusca] = useState('')
  const [mensagem, setMensagem] = useState('')
  const [pagamentoVenda, setPagamentoVenda] = useState(null)
  const [forma, setForma] = useState('dinheiro')
  const [valor, setValor] = useState('')
  const [extornoId, setExtornoId] = useState(null)
  const [motivoExtorno, setMotivoExtorno] = useState('')

  async function carregar() {
    try {
      const [pendentesData, vendasData, caixaData] = await Promise.all([
        listarPendentesApi(),
        listarVendasApi(),
        obterCaixaAbertoApi(usuario),
      ])
      setPendentes(pendentesData)
      setVendas(vendasData)
      setCaixaAtual(caixaData)
    } catch (error) {
      setMensagem(error.message || 'Falha ao carregar pendências.')
    }
  }

  useEffect(() => {
    carregar()
    window.addEventListener('speedpdv:status-change', carregar)
    return () => window.removeEventListener('speedpdv:status-change', carregar)
  }, [])

  function abrirQuitar(venda) {
    setPagamentoVenda(venda)
    setForma('dinheiro')
    const restante = Math.max(Number(venda.total || 0) - Number(venda.pago || 0), 0)
    setValor(mascararMoedaInput(String(Math.round(restante * 100))))
  }

  async function confirmarQuitar() {
    try {
      const venda = pagamentoVenda
      if (!venda) return
      const total = Number(venda.total || 0)
      const pago = Number(venda.pago || 0)
      const restante = Math.max(total - pago, 0)
      const recebido = parseNumero(valor)
      if (!recebido) return setMensagem('Digite um valor válido para o pagamento.')
      if (forma !== 'dinheiro' && recebido > restante + 0.001) return setMensagem('Pix, crédito e débito não podem passar do valor restante.')
      const valorLancado = forma === 'dinheiro' ? Math.min(recebido, restante) : recebido
      const troco = forma === 'dinheiro' ? Math.max(recebido - restante, 0) : 0
      await marcarVendaComoPagaApi(venda.id, [{ forma, valor: valorLancado, valorRecebido: recebido, troco }])
      setMensagem('Pagamento registrado com sucesso.')
      setPagamentoVenda(null)
      setValor('')
      window.dispatchEvent(new CustomEvent('speedpdv:status-change'))
      carregar()
    } catch (error) {
      setMensagem(error.message || 'Falha ao marcar como pago.')
    }
  }

  function abrirExtorno(id) {
    setExtornoId(id)
    setMotivoExtorno('')
  }

  async function confirmarExtorno() {
    try {
      await estornarVendaApi(extornoId, motivoExtorno || 'Extorno manual')
      setMensagem('Extorno registrado com sucesso.')
      setExtornoId(null)
      setMotivoExtorno('')
      window.dispatchEvent(new CustomEvent('speedpdv:status-change'))
      carregar()
    } catch (error) {
      setMensagem(error.message || 'Falha ao registrar extorno.')
    }
  }

  const vendasFiltradas = useMemo(() => buscarPorPedidoOuCliente(vendas, busca), [vendas, busca])
  const vendaSelecionadaRestante = pagamentoVenda ? Math.max(Number(pagamentoVenda.total || 0) - Number(pagamentoVenda.pago || 0), 0) : 0

  return (
    <div className="stack gap-md compact-page">
      <div className="panel page-header compact-panel">
        <div>
          <h1>Pagamento pendente</h1>
          <p>Use esta tela para localizar pedido pendente, marcar pagamento ou fazer extorno por número da comanda, origem ou nome do cliente.</p>
        </div>
        <div className={caixaAtual ? 'badge warning' : 'badge success'}>{caixaAtual ? 'Caixa deste operador aberto' : 'Sem caixa aberto neste operador'}</div>
      </div>

      {mensagem && <div className="alert">{mensagem}</div>}

      <div className="panel stack gap-sm compact-panel">
        <h3>Buscar pedido para pagamento ou extorno</h3>
        <label>Digite nº da comanda, origem ou nome do cliente<input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Ex.: 0058, Goomer ou Rafael" /></label>
      </div>

      {pagamentoVenda && (
        <div className="panel stack gap-sm compact-panel native-pay-box">
          <h3>Quitar pedido {pagamentoVenda.numero_pedido}</h3>
          <div className="grid-3 compact-grid">
            <div className="mini-info"><span>Total</span><strong>{formatarMoeda(pagamentoVenda.total || 0)}</strong></div>
            <div className="mini-info"><span>Já pago</span><strong>{formatarMoeda(pagamentoVenda.pago || 0)}</strong></div>
            <div className="mini-info warning-box"><span>Restante</span><strong>{formatarMoeda(vendaSelecionadaRestante)}</strong></div>
          </div>
          <div className="grid-2 compact-grid">
            <label>Forma de pagamento<select value={forma} onChange={(e) => setForma(e.target.value)}>{formasPagamento.map((f) => <option key={f} value={f}>{f}</option>)}</select></label>
            <label>{forma === 'dinheiro' ? 'Valor recebido do cliente' : 'Valor a lançar'}<input value={valor} onChange={(e) => setValor(mascararMoedaInput(e.target.value))} inputMode="numeric" /></label>
          </div>
          <div className="item-actions wrap-actions">
            <button className="ghost-btn compact-btn" onClick={() => setPagamentoVenda(null)}>Cancelar</button>
            <button className="secondary-btn compact-btn" onClick={confirmarQuitar}>Confirmar pagamento</button>
          </div>
        </div>
      )}

      <div className="page-grid admin-layout compact-page-grid">
        <div className="panel compact-panel">
          <h3>Pedidos pendentes</h3>
          <div className="item-list tall compact-tall">
            {!pendentes.length && <p className="muted">Sem pedidos pendentes.</p>}
            {pendentes.map((pedido) => <LinhaPedido key={pedido.id} pedido={pedido} onQuitar={abrirQuitar} onExtornar={abrirExtorno} />)}
          </div>
        </div>

        <div className="panel compact-panel">
          <div className="item-actions wrap-actions between-actions"><h3>Todas as vendas</h3></div>
          <div className="item-list tall compact-tall">
            {!vendasFiltradas.length && <p className="muted">Nenhum resultado.</p>}
            {vendasFiltradas.slice(0, 50).map((pedido) => <LinhaPedido key={pedido.id} pedido={pedido} onQuitar={abrirQuitar} onExtornar={abrirExtorno} />)}
          </div>
        </div>
      </div>

      <NativeModal
        open={Boolean(extornoId)}
        title="Informar motivo do extorno"
        confirmLabel="Confirmar extorno"
        danger
        onClose={() => setExtornoId(null)}
        onConfirm={confirmarExtorno}
      >
        <label>Motivo
          <input value={motivoExtorno} onChange={(e) => setMotivoExtorno(e.target.value)} placeholder="Ex.: cobrança duplicada" />
        </label>
      </NativeModal>
    </div>
  )
}
