import { formatarMoeda } from '../lib/utils'

export default function ItemPedidoList({ itens, onRemover }) {
  return (
    <div className="panel">
      <h3>Itens lançados</h3>
      {!itens.length && <p className="muted">Nenhum item adicionado.</p>}
      <div className="item-list">
        {itens.map((item, index) => (
          <div className="item-row" key={`${item.nome}-${index}`}>
            <div>
              <strong>{item.nome}</strong>
              <small>{item.quantidade}x</small>
            </div>
            <div className="item-actions">
              <strong>{formatarMoeda(item.preco * item.quantidade)}</strong>
              <button className="ghost-btn" onClick={() => onRemover(index)}>Remover</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
