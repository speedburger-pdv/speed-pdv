import { useEffect, useMemo, useState } from 'react'
import { hasSupabase, supabase } from '../lib/supabase'
import { menuBase } from '../lib/menuBase'
import { agora, formatarMoeda } from '../lib/utils'
import PagamentoBox from '../components/PagamentoBox'
import ItemPedidoList from '../components/ItemPedidoList'

const tiposPedido = [
  { id: 'mesa', label: 'Mesa' },
  { id: 'balcao', label: 'Balcão' },
  { id: 'retirada', label: 'Retirada' },
]

export default function PdvPage() {
  const [produtos, setProdutos] = useState([])
  const [busca, setBusca] = useState('')
  const [tipoPedido, setTipoPedido] = useState('mesa')
  const [mesa, setMesa] = useState('2')
  const [nomeCliente, setNomeCliente] = useState('')
  const [itens, setItens] = useState([])
  const [pagamentos, setPagamentos] = useState([])
  const [origem, setOrigem] = useState('goomer')
  const [observacao, setObservacao] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [mensagem, setMensagem] = useState('')

  useEffect(() => {
    async function carregarProdutos() {
      if (!hasSupabase) {
        setProdutos(menuBase)
        return
      }
      const { data } = await supabase.from('produtos').select('*').eq('ativo', true).order('categoria').order('nome')
      setProdutos(data || [])
    }
    carregarProdutos()
  }, [])

  const produtosFiltrados = useMemo(() => {
    const termo = busca.toLowerCase().trim()
    if (!termo) return produtos
    return produtos.filter((p) => p.nome.toLowerCase().includes(termo) || p.categoria.toLowerCase().includes(termo))
  }, [produtos, busca])

  const total = useMemo(
    () => itens.reduce((soma, item) => soma + item.preco * item.quantidade, 0),
    [itens],
  )

  const valorPago = useMemo(
    () => pagamentos.reduce((soma, item) => soma + Number(item.valor || 0), 0),
    [pagamentos],
  )

  const restante = Math.max(total - valorPago, 0)

  function adicionarItem(produto) {
    setItens((atual) => {
      const index = atual.findIndex((item) => item.nome === produto.nome)
      if (index >= 0) {
        const copia = [...atual]
        copia[index].quantidade += 1
        return copia
      }
      return [...atual, { nome: produto.nome, preco: Number(produto.preco), quantidade: 1, produto_id: produto.id || null }]
    })
  }

  function removerItem(index) {
    setItens((atual) => atual.filter((_, i) => i !== index))
  }

  function limparPedido() {
    setItens([])
    setPagamentos([])
    setNomeCliente('')
    setObservacao('')
    setMensagem('')
  }

  async function salvarPedido(status) {
    if (!itens.length) return
    setSalvando(true)
    setMensagem('')

    if (!hasSupabase) {
      setMensagem(`Modo demonstração: pedido ${status === 'pago' ? 'finalizado' : 'salvo'} com sucesso.`)
      if (status === 'pago') limparPedido()
      setSalvando(false)
      return
    }

    const payloadPedido = {
      tipo: tipoPedido,
      nome_cliente: nomeCliente || null,
      mesa: tipoPedido === 'mesa' ? mesa : null,
      status: status === 'pago' ? 'pago' : 'aberto',
      status_real: status === 'pago' ? 'pago' : 'aberto',
      origem,
      observacao,
      total,
      valor_pago: valorPago,
      created_at: agora(),
    }

    const { data: pedido, error: erroPedido } = await supabase.from('pedidos').insert(payloadPedido).select().single()
    if (erroPedido) {
      setMensagem(erroPedido.message)
      setSalvando(false)
      return
    }

    const itensPayload = itens.map((item) => ({
      pedido_id: pedido.id,
      produto_id: item.produto_id,
      quantidade: item.quantidade,
      preco: item.preco,
    }))

    await supabase.from('pedido_itens').insert(itensPayload)

    if (pagamentos.length) {
      await supabase.from('pagamentos').insert(
        pagamentos.map((pag) => ({
          pedido_id: pedido.id,
          tipo: pag.forma,
          valor: pag.valor,
          created_at: agora(),
        })),
      )

      await supabase.from('movimentacoes_caixa').insert(
        pagamentos.map((pag) => ({
          tipo: 'venda',
          valor: pag.valor,
          descricao: `Venda ${tipoPedido}${tipoPedido === 'mesa' ? ` mesa ${mesa}` : nomeCliente ? ` - ${nomeCliente}` : ''}`,
          pedido_id: pedido.id,
          operador: 'operador',
          created_at: agora(),
        })),
      )
    }

    setMensagem(status === 'pago' ? 'Pedido pago e fechado com sucesso.' : 'Pedido salvo como pendente.')
    if (status === 'pago') limparPedido()
    setSalvando(false)
  }

  return (
    <div className="page-grid pdv-layout">
      <section className="panel stack gap-md">
        <div className="page-header">
          <div>
            <h1>PDV Speed Burger</h1>
            <p>Lançamento rápido com base nas comandas do Goomer.</p>
          </div>
          <div className="pill-group">
            {tiposPedido.map((item) => (
              <button
                key={item.id}
                className={tipoPedido === item.id ? 'pill active' : 'pill'}
                onClick={() => setTipoPedido(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid-3">
          {tipoPedido === 'mesa' && (
            <label>
              Mesa
              <select value={mesa} onChange={(e) => setMesa(e.target.value)}>
                {Array.from({ length: 9 }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={String(n)}>{n === 1 ? '1 - Balcão apoio' : `Mesa ${n}`}</option>
                ))}
              </select>
            </label>
          )}
          {tipoPedido !== 'mesa' && (
            <label>
              Nome do cliente
              <input value={nomeCliente} onChange={(e) => setNomeCliente(e.target.value)} placeholder="Ex.: Amanda Oliveira" />
            </label>
          )}
          <label>
            Origem
            <select value={origem} onChange={(e) => setOrigem(e.target.value)}>
              <option value="goomer">Goomer</option>
              <option value="ifood">iFood</option>
              <option value="balcao">Balcão</option>
              <option value="manual">Manual</option>
            </select>
          </label>
          <label>
            Observação
            <input value={observacao} onChange={(e) => setObservacao(e.target.value)} placeholder="Sem cebola, pagamento depois, etc." />
          </label>
        </div>

        <label>
          Buscar item
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Digite coca, combo, cheddar..." />
        </label>

        <div className="product-grid">
          {produtosFiltrados.map((produto) => (
            <button key={produto.nome} className="product-card" onClick={() => adicionarItem(produto)}>
              <span className="product-emoji">
                {produto.categoria === 'bebidas' ? '🥤' : produto.categoria === 'promocao' ? '🔥' : produto.categoria === 'porcoes' ? '🍟' : '🍔'}
              </span>
              <strong>{produto.nome}</strong>
              <small>{produto.categoria}</small>
              <span>{formatarMoeda(produto.preco)}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="stack gap-md">
        <ItemPedidoList itens={itens} onRemover={removerItem} />

        <div className="panel totals">
          <div><span>Total</span><strong>{formatarMoeda(total)}</strong></div>
          <div><span>Pago</span><strong>{formatarMoeda(valorPago)}</strong></div>
          <div><span>Restante</span><strong>{formatarMoeda(restante)}</strong></div>
        </div>

        <PagamentoBox total={restante} onAdicionarPagamento={(pag) => setPagamentos((atual) => [...atual, pag])} />

        <div className="panel">
          <h3>Pagamentos lançados</h3>
          {!pagamentos.length && <p className="muted">Nenhum pagamento lançado ainda.</p>}
          {pagamentos.map((pag, i) => (
            <div key={`${pag.forma}-${i}`} className="item-row compact">
              <span>{pag.forma}</span>
              <strong>{formatarMoeda(pag.valor)}</strong>
            </div>
          ))}
        </div>

        <div className="action-row">
          <button className="secondary-btn" onClick={() => salvarPedido('aberto')} disabled={salvando}>Salvar pendente</button>
          <button className="primary-btn" onClick={() => salvarPedido('pago')} disabled={salvando}>Finalizar venda</button>
          <button className="ghost-btn" onClick={limparPedido}>Limpar</button>
        </div>

        {mensagem && <div className="alert">{mensagem}</div>}
      </section>
    </div>
  )
}
