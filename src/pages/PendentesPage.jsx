import { useEffect, useState } from 'react'
import { hasSupabase, supabase } from '../lib/supabase'
import { formatarMoeda, nomeTipoPedido } from '../lib/utils'

export default function PendentesPage() {
  const [pedidos, setPedidos] = useState([])

  useEffect(() => {
    async function carregar() {
      if (!hasSupabase) return
      const { data } = await supabase.from('pedidos').select('*').neq('status', 'pago').order('created_at', { ascending: false })
      setPedidos(data || [])
    }
    carregar()
  }, [])

  return (
    <div className="stack gap-md">
      <div className="page-header">
        <div>
          <h1>Pendentes</h1>
          <p>Mesas abertas, retiradas aguardando cliente e lançamentos ainda não quitados.</p>
        </div>
      </div>
      <div className="cards-grid">
        {!pedidos.length && <div className="panel"><p className="muted">Sem pendências no momento.</p></div>}
        {pedidos.map((pedido) => (
          <div className="panel" key={pedido.id}>
            <div className="item-row compact">
              <strong>{nomeTipoPedido[pedido.tipo] || pedido.tipo}</strong>
              <span className="badge warning">{pedido.status}</span>
            </div>
            <p><strong>Mesa/cliente:</strong> {pedido.mesa || pedido.nome_cliente || 'Não informado'}</p>
            <p><strong>Origem:</strong> {pedido.origem || 'manual'}</p>
            <p><strong>Total:</strong> {formatarMoeda(pedido.total)}</p>
            <p><strong>Pago:</strong> {formatarMoeda(pedido.valor_pago)}</p>
            <p><strong>Observação:</strong> {pedido.observacao || '—'}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
