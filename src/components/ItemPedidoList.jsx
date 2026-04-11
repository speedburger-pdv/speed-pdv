import { formatarMoeda } from '../lib/utils'

export default function ItemPedidoList({ itens, onRemover }) {
  return (
    <div className="panel stack gap-sm compact-panel items-panel">
      <h3>Itens do pedido</h3>
      <p className="muted">Revise abaixo o que já foi lançado. Remova o item errado antes de salvar o pedido.</p>
      {!itens.length && <p className="muted">Nenhum item adicionado ainda.</p>}
      <div className="item-list item-list-scroll">
        {itens.map((item, index) => (
          <div className="item-row readable-row" key={`${item.nome}-${index}`}>
            <div>
              <strong>{item.nome}</strong>
              <small>{item.quantidade} un. • {formatarMoeda(item.preco)} cada</small>
            </div>
            <div className="item-actions">
              <strong>{formatarMoeda(item.preco * item.quantidade)}</strong>
              <button className="danger-btn compact-btn" onClick={() => onRemover(index)}>Excluir</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
