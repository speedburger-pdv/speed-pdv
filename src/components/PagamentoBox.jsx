import { useMemo, useState } from 'react'
import { formasPagamento, formatarMoeda, mascararMoedaInput, parseNumero } from '../lib/utils'

export default function PagamentoBox({ total, pagamentos, onAdicionarPagamento }) {
  const [forma, setForma] = useState('dinheiro')
  const [valorRecebido, setValorRecebido] = useState('')
  const [mensagem, setMensagem] = useState('')

  const jaRecebido = useMemo(() => pagamentos.reduce((soma, item) => soma + Number(item.valor || 0), 0), [pagamentos])
  const faltaReceber = Math.max(Number(total || 0) - jaRecebido, 0)
  const recebidoNumero = parseNumero(valorRecebido)

  const calculo = useMemo(() => {
    if (!recebidoNumero || faltaReceber <= 0) return { valorLancado: 0, troco: 0, faltaDepois: faltaReceber }
    if (forma === 'dinheiro') {
      const valorLancado = Math.min(recebidoNumero, faltaReceber)
      const troco = Math.max(recebidoNumero - faltaReceber, 0)
      return { valorLancado, troco, faltaDepois: Math.max(faltaReceber - valorLancado, 0) }
    }
    const valorLancado = recebidoNumero
    return { valorLancado, troco: 0, faltaDepois: Math.max(faltaReceber - valorLancado, 0) }
  }, [recebidoNumero, faltaReceber, forma])

  function adicionar() {
    setMensagem('')
    if (faltaReceber <= 0) {
      setMensagem('O pedido já está totalmente pago.')
      return
    }
    if (!recebidoNumero) {
      setMensagem('Digite o valor recebido do cliente.')
      return
    }
    if (forma !== 'dinheiro' && recebidoNumero > faltaReceber + 0.001) {
      setMensagem('Pix, crédito e débito não podem passar do valor que falta. Em dinheiro o sistema calcula troco automaticamente.')
      return
    }
    onAdicionarPagamento({
      forma,
      valor: calculo.valorLancado,
      valorRecebido: recebidoNumero,
      troco: calculo.troco,
    })
    setValorRecebido('')
  }

  return (
    <div className="panel stack gap-sm compact-panel payment-box">
      <h3>Pagamento</h3>
      <p className="muted">Digite o valor recebido. O sistema calcula automaticamente o que entra no caixa, o troco e o que ainda falta.</p>

      <div className="grid-2 compact-grid">
        <div className="mini-info"><span>Total do pedido</span><strong>{formatarMoeda(total)}</strong></div>
        <div className="mini-info warning-box"><span>Falta receber</span><strong>{formatarMoeda(faltaReceber)}</strong></div>
      </div>

      {!!pagamentos.length && (
        <div className="payment-chips">
          {pagamentos.map((item, index) => (
            <span key={`${item.forma}-${index}`} className={`chip chip-${item.forma}`}>
              {item.forma}: {formatarMoeda(item.valor)}{item.troco ? ` • troco ${formatarMoeda(item.troco)}` : ''}
            </span>
          ))}
        </div>
      )}

      <div className="grid-2 compact-grid">
        <label>Forma de pagamento
          <select value={forma} onChange={(e) => setForma(e.target.value)}>
            {formasPagamento.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>
        <label>{forma === 'dinheiro' ? 'Valor recebido do cliente' : 'Valor a lançar'}
          <input value={valorRecebido} onChange={(e) => setValorRecebido(mascararMoedaInput(e.target.value))} inputMode="numeric" placeholder="0,00" />
        </label>
      </div>

      <div className="grid-3 compact-grid">
        <div className="mini-info success-box"><span>Vai entrar</span><strong>{formatarMoeda(calculo.valorLancado)}</strong></div>
        <div className="mini-info"><span>Troco</span><strong>{formatarMoeda(calculo.troco)}</strong></div>
        <div className="mini-info warning-box"><span>Falta depois</span><strong>{formatarMoeda(calculo.faltaDepois)}</strong></div>
      </div>

      {mensagem && <div className="alert error">{mensagem}</div>}
      <button className="primary-btn compact-btn" onClick={adicionar} disabled={!recebidoNumero || faltaReceber <= 0}>Adicionar pagamento</button>
    </div>
  )
}
