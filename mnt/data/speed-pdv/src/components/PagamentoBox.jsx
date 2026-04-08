import { useMemo, useState } from 'react'
import { formasPagamento, formatarMoeda } from '../lib/utils'

export default function PagamentoBox({ total, onAdicionarPagamento }) {
  const [forma, setForma] = useState('pix')
  const [valor, setValor] = useState('')
  const [recebido, setRecebido] = useState('')

  const troco = useMemo(() => {
    if (forma !== 'dinheiro') return 0
    const r = Number(recebido || 0)
    const v = Number(valor || 0)
    return r > v ? r - v : 0
  }, [forma, recebido, valor])

  return (
    <div className="panel">
      <h3>Pagamento</h3>
      <p className="muted">Total aberto: {formatarMoeda(total)}</p>
      <div className="grid-2">
        <label>
          Forma
          <select value={forma} onChange={(e) => setForma(e.target.value)}>
            {formasPagamento.map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>
        </label>
        <label>
          Valor pago
          <input value={valor} onChange={(e) => setValor(e.target.value)} placeholder="0,00" />
        </label>
      </div>
      {forma === 'dinheiro' && (
        <div className="grid-2">
          <label>
            Valor recebido
            <input value={recebido} onChange={(e) => setRecebido(e.target.value)} placeholder="0,00" />
          </label>
          <div className="panel mini-panel">
            <span className="muted">Troco</span>
            <strong>{formatarMoeda(troco)}</strong>
          </div>
        </div>
      )}
      <button
        className="primary-btn"
        onClick={() => {
          if (!Number(valor)) return
          onAdicionarPagamento({ forma, valor: Number(valor), troco })
          setValor('')
          setRecebido('')
        }}
      >
        Adicionar pagamento
      </button>
    </div>
  )
}
