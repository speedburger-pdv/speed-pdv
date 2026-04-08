import { useEffect, useMemo, useState } from 'react'
import { hasSupabase, supabase } from '../lib/supabase'
import { menuBase } from '../lib/menuBase'
import { agora, formatarMoeda } from '../lib/utils'

const produtoInicial = { nome: '', preco: '', categoria: 'hamburgueres', tipo: 'lanche', ativo: true }
const movimentoInicial = { tipo: 'sangria', valor: '', descricao: '' }

export default function AdminPage() {
  const [produtos, setProdutos] = useState([])
  const [produtoForm, setProdutoForm] = useState(produtoInicial)
  const [movimento, setMovimento] = useState(movimentoInicial)
  const [mensagem, setMensagem] = useState('')
  const [movimentacoes, setMovimentacoes] = useState([])
  const [filtro, setFiltro] = useState('todos')

  async function carregar() {
    if (!hasSupabase) {
      setProdutos(menuBase)
      return
    }
    const [{ data: produtosData }, { data: movData }] = await Promise.all([
      supabase.from('produtos').select('*').order('categoria').order('nome'),
      supabase.from('movimentacoes_caixa').select('*').order('created_at', { ascending: false }).limit(20),
    ])
    setProdutos(produtosData || [])
    setMovimentacoes(movData || [])
  }

  useEffect(() => {
    carregar()
  }, [])

  const produtosFiltrados = useMemo(() => {
    if (filtro === 'todos') return produtos
    return produtos.filter((p) => p.categoria === filtro || p.tipo === filtro)
  }, [produtos, filtro])

  async function salvarProduto(e) {
    e.preventDefault()
    setMensagem('')
    if (!hasSupabase) {
      setProdutos((atual) => [...atual, { ...produtoForm, preco: Number(produtoForm.preco) }])
      setProdutoForm(produtoInicial)
      setMensagem('Produto criado em modo demonstração.')
      return
    }
    const { error } = await supabase.from('produtos').insert({
      ...produtoForm,
      preco: Number(produtoForm.preco),
      created_at: agora(),
    })
    if (error) {
      setMensagem(error.message)
      return
    }
    setProdutoForm(produtoInicial)
    setMensagem('Produto salvo com sucesso.')
    carregar()
  }

  async function alternarProduto(produto) {
    if (!hasSupabase) return
    await supabase.from('produtos').update({ ativo: !produto.ativo }).eq('id', produto.id)
    carregar()
  }

  async function salvarMovimento(e) {
    e.preventDefault()
    if (!movimento.valor || !movimento.descricao) return
    if (!hasSupabase) {
      setMensagem('Movimentação criada em modo demonstração.')
      setMovimento(movimentoInicial)
      return
    }
    const { error } = await supabase.from('movimentacoes_caixa').insert({
      ...movimento,
      valor: Number(movimento.valor),
      operador: 'admin',
      created_at: agora(),
    })
    if (error) {
      setMensagem(error.message)
      return
    }
    setMovimento(movimentoInicial)
    setMensagem('Movimentação registrada com sucesso.')
    carregar()
  }

  return (
    <div className="page-grid admin-layout">
      <section className="stack gap-md">
        <div className="panel">
          <h1>Painel Administrativo</h1>
          <p>Cadastre produtos, promoções, combos e registre sangria, entrada manual ou estorno.</p>
        </div>

        <form className="panel stack gap-sm" onSubmit={salvarProduto}>
          <h3>Cadastrar produto ou promoção</h3>
          <div className="grid-2">
            <label>
              Nome
              <input value={produtoForm.nome} onChange={(e) => setProdutoForm({ ...produtoForm, nome: e.target.value })} required />
            </label>
            <label>
              Preço
              <input value={produtoForm.preco} onChange={(e) => setProdutoForm({ ...produtoForm, preco: e.target.value })} required />
            </label>
            <label>
              Categoria
              <select value={produtoForm.categoria} onChange={(e) => setProdutoForm({ ...produtoForm, categoria: e.target.value })}>
                <option value="promocao">Promoção</option>
                <option value="combos">Combos</option>
                <option value="hamburgueres">Hambúrgueres</option>
                <option value="fast-food">Fast-food</option>
                <option value="porcoes">Porções</option>
                <option value="bebidas">Bebidas</option>
                <option value="complementos">Complementos</option>
              </select>
            </label>
            <label>
              Tipo
              <select value={produtoForm.tipo} onChange={(e) => setProdutoForm({ ...produtoForm, tipo: e.target.value })}>
                <option value="promocao">Promoção</option>
                <option value="combo">Combo</option>
                <option value="lanche">Lanche</option>
                <option value="bebida">Bebida</option>
                <option value="porcao">Porção</option>
                <option value="complemento">Complemento</option>
              </select>
            </label>
          </div>
          <button className="primary-btn">Salvar produto</button>
        </form>

        <form className="panel stack gap-sm" onSubmit={salvarMovimento}>
          <h3>Movimentações de caixa</h3>
          <div className="grid-2">
            <label>
              Tipo
              <select value={movimento.tipo} onChange={(e) => setMovimento({ ...movimento, tipo: e.target.value })}>
                <option value="sangria">Sangria</option>
                <option value="entrada">Entrada manual</option>
                <option value="estorno">Estorno</option>
              </select>
            </label>
            <label>
              Valor
              <input value={movimento.valor} onChange={(e) => setMovimento({ ...movimento, valor: e.target.value })} required />
            </label>
          </div>
          <label>
            Descrição / motivo
            <input value={movimento.descricao} onChange={(e) => setMovimento({ ...movimento, descricao: e.target.value })} placeholder="Pagamento funcionário, sangria de segurança, cliente cancelou..." required />
          </label>
          <button className="secondary-btn">Registrar movimentação</button>
        </form>

        {mensagem && <div className="alert">{mensagem}</div>}
      </section>

      <section className="stack gap-md">
        <div className="panel">
          <div className="item-row compact">
            <h3>Produtos cadastrados</h3>
            <select value={filtro} onChange={(e) => setFiltro(e.target.value)}>
              <option value="todos">Todos</option>
              <option value="promocao">Promoção</option>
              <option value="combos">Combos</option>
              <option value="hamburgueres">Hambúrgueres</option>
              <option value="bebidas">Bebidas</option>
            </select>
          </div>
          <div className="item-list tall">
            {produtosFiltrados.map((produto) => (
              <div className="item-row" key={produto.id || produto.nome}>
                <div>
                  <strong>{produto.nome}</strong>
                  <small>{produto.categoria} • {produto.tipo}</small>
                </div>
                <div className="item-actions">
                  <strong>{formatarMoeda(produto.preco)}</strong>
                  {'id' in produto && <button className="ghost-btn" onClick={() => alternarProduto(produto)}>{produto.ativo ? 'Ocultar' : 'Ativar'}</button>}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="panel">
          <h3>Últimas movimentações</h3>
          <div className="item-list">
            {movimentacoes.length === 0 && <p className="muted">Sem movimentações recentes.</p>}
            {movimentacoes.map((mov) => (
              <div className="item-row" key={mov.id}>
                <div>
                  <strong>{mov.tipo}</strong>
                  <small>{mov.descricao}</small>
                </div>
                <strong>{formatarMoeda(mov.valor)}</strong>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}
