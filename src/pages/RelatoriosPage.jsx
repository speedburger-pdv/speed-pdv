import { useEffect, useMemo, useState } from 'react'
import { hasSupabase, supabase } from '../lib/supabase'
import { formatarMoeda } from '../lib/utils'

export default function RelatoriosPage() {
  const [pagamentos, setPagamentos] = useState([])
  const [movimentos, setMovimentos] = useState([])

  useEffect(() => {
    async function carregar() {
      if (!hasSupabase) return
      const [{ data: pags }, { data: movs }] = await Promise.all([
        supabase.from('pagamentos').select('*'),
        supabase.from('movimentacoes_caixa').select('*'),
      ])
      setPagamentos(pags || [])
      setMovimentos(movs || [])
    }
    carregar()
  }, [])

  const resumo = useMemo(() => {
    const formas = {
      dinheiro: 0,
      pix: 0,
      credito: 0,
      debito: 0,
    }
    pagamentos.forEach((pag) => {
      formas[pag.tipo] = (formas[pag.tipo] || 0) + Number(pag.valor || 0)
    })

    const sangrias = movimentos.filter((m) => m.tipo === 'sangria').reduce((s, m) => s + Number(m.valor || 0), 0)
    const entradas = movimentos.filter((m) => m.tipo === 'entrada').reduce((s, m) => s + Number(m.valor || 0), 0)
    const estornos = movimentos.filter((m) => m.tipo === 'estorno').reduce((s, m) => s + Number(m.valor || 0), 0)

    return {
      ...formas,
      sangrias,
      entradas,
      estornos,
      totalVendido: Object.values(formas).reduce((s, v) => s + v, 0),
    }
  }, [pagamentos, movimentos])

  return (
    <div className="stack gap-md">
      <div className="panel">
        <h1>Relatórios</h1>
        <p>Resumo financeiro para acompanhamento do dono da operação.</p>
      </div>
      <div className="cards-grid four">
        <div className="metric-card"><span>Dinheiro</span><strong>{formatarMoeda(resumo.dinheiro)}</strong></div>
        <div className="metric-card"><span>Pix</span><strong>{formatarMoeda(resumo.pix)}</strong></div>
        <div className="metric-card"><span>Crédito</span><strong>{formatarMoeda(resumo.credito)}</strong></div>
        <div className="metric-card"><span>Débito</span><strong>{formatarMoeda(resumo.debito)}</strong></div>
      </div>
      <div className="cards-grid three">
        <div className="metric-card danger"><span>Sangrias</span><strong>{formatarMoeda(resumo.sangrias)}</strong></div>
        <div className="metric-card"><span>Entradas manuais</span><strong>{formatarMoeda(resumo.entradas)}</strong></div>
        <div className="metric-card warning"><span>Estornos</span><strong>{formatarMoeda(resumo.estornos)}</strong></div>
      </div>
      <div className="panel">
        <div className="item-row compact">
          <span>Total vendido</span>
          <strong>{formatarMoeda(resumo.totalVendido)}</strong>
        </div>
        <div className="item-row compact">
          <span>Total esperado em caixa</span>
          <strong>{formatarMoeda(resumo.totalVendido + resumo.entradas - resumo.sangrias - resumo.estornos)}</strong>
        </div>
      </div>
    </div>
  )
}
