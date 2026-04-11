import { useEffect, useMemo, useRef, useState } from 'react'
import InfoHint from '../components/InfoHint'
import { alternarProdutoApi, atualizarUsuarioApi, carregarConfigApi, carregarProdutosApi, criarOperadorApi, excluirProdutoApi, excluirUsuarioApi, fecharCaixaApi, importarProdutosBaseApi, listarCaixasApi, listarSaidasApi, listarUsuariosApi, listarVendasApi, obterResumoCaixaApi, salvarConfigApi, salvarProdutoApi } from '../lib/api'
import { obterSessao, podeAcessarGestao, podeCadastrarTipo, podeGerenciarUsuarios, tipoUsuarioLabel, tiposCadastraveisPor } from '../lib/auth'
import { dataHoraBR, formatarMoeda, mascararMoedaInput, operadorDaVenda, parseNumero } from '../lib/utils'

function podeGerenciarUsuarioAlvo(usuarioAtual, alvo) {
  if (!usuarioAtual || !alvo) return false
  if (usuarioAtual.tipo === 'admin') return alvo.tipo !== 'admin'
  if (usuarioAtual.tipo === 'gerente') return ['supervisor', 'operador'].includes(alvo.tipo)
  return false
}

export default function AdminPage() {
  const usuarioAtual = obterSessao()
  const podeGestao = podeAcessarGestao(usuarioAtual)
  const podeUsuarios = podeGerenciarUsuarios(usuarioAtual)
  const tiposPermitidos = tiposCadastraveisPor(usuarioAtual)
  const tipoInicial = tiposPermitidos[0] || 'operador'

  const [aba, setAba] = useState(podeUsuarios ? 'usuarios' : 'cardapio')
  const [usuarios, setUsuarios] = useState([])
  const [produtos, setProdutos] = useState([])
  const [movimentacoes, setMovimentacoes] = useState([])
  const [caixas, setCaixas] = useState([])
  const [vendas, setVendas] = useState([])
  const [caixaAberto, setCaixaAberto] = useState(null)
  const [resumoCaixa, setResumoCaixa] = useState(null)
  const [config, setConfig] = useState({ alerta_sangria: 400 })
  const [configDraft, setConfigDraft] = useState({ alerta_sangria: '400,00' })
  const [mensagem, setMensagem] = useState('')
  const [valorContado, setValorContado] = useState('')
  const [novaSenha, setNovaSenha] = useState({})
  const [operadorForm, setOperadorForm] = useState({ nome: '', usuario: '', senha: '', tipo: tipoInicial })
  const [produtoForm, setProdutoForm] = useState({ id: '', nome: '', preco: '', categoria: 'hamburgueres', tipo: 'lanche' })
  const [buscaProduto, setBuscaProduto] = useState('')
  const [filtroCategoria, setFiltroCategoria] = useState('todos')
  const [filtroTipo, setFiltroTipo] = useState('todos')
  const editorRef = useRef(null)

  useEffect(() => {
    if (!podeUsuarios && aba === 'usuarios') setAba('cardapio')
  }, [podeUsuarios, aba])

  useEffect(() => {
    setOperadorForm((atual) => ({ ...atual, tipo: tiposPermitidos.includes(atual.tipo) ? atual.tipo : (tiposPermitidos[0] || 'operador') }))
  }, [JSON.stringify(tiposPermitidos)])

  async function carregar() {
    try {
      const promessas = [carregarProdutosApi(), listarSaidasApi(), listarCaixasApi(), carregarConfigApi(), listarVendasApi()]
      if (podeUsuarios) promessas.unshift(listarUsuariosApi())
      const retorno = await Promise.all(promessas)
      let u = []
      let p
      let s
      let c
      let cfg
      let v
      if (podeUsuarios) {
        [u, p, s, c, cfg, v] = retorno
      } else {
        [p, s, c, cfg, v] = retorno
      }
      setUsuarios(u || [])
      setProdutos(p || [])
      setCaixas(c || [])
      setConfig(cfg || { alerta_sangria: 400 })
      setVendas(v || [])
      setConfigDraft({ alerta_sangria: mascararMoedaInput(String(Math.round(Number(cfg?.alerta_sangria || 400) * 100))) })
      const aberto = (c || []).filter((item) => item.status === 'aberto').sort((a, b) => new Date(b.data_abertura || b.abertura) - new Date(a.data_abertura || a.abertura))[0] || null
      setCaixaAberto(aberto)
      if (aberto?.id) {
        setResumoCaixa(await obterResumoCaixaApi(aberto.id))
        setMovimentacoes(await listarSaidasApi(aberto.id))
      } else {
        setResumoCaixa(null)
        setMovimentacoes(s || [])
      }
    } catch (error) {
      setMensagem(error.message || 'Falha ao carregar gestão.')
    }
  }

  useEffect(() => { if (podeGestao) carregar() }, [podeGestao, podeUsuarios])

  async function cadastrarUsuario(e) {
    e.preventDefault()
    const tipo = operadorForm.tipo || 'operador'
    if (!podeCadastrarTipo(usuarioAtual, tipo)) {
      setMensagem('Seu perfil não pode cadastrar esse tipo de usuário.')
      return
    }
    const resposta = await criarOperadorApi({ ...operadorForm, tipo })
    if (!resposta.ok) return setMensagem(resposta.erro || 'Falha ao salvar usuário.')
    setOperadorForm({ nome: '', usuario: '', senha: '', tipo: tiposPermitidos[0] || 'operador' })
    setMensagem(`${tipoUsuarioLabel(tipo)} cadastrado com sucesso.`)
    carregar()
  }

  async function excluirOperador(item) {
    if (!podeGerenciarUsuarioAlvo(usuarioAtual, item)) return setMensagem('Seu perfil não pode excluir esse usuário.')
    if (!window.confirm(`Excluir ${tipoUsuarioLabel(item.tipo).toLowerCase()} ${item.nome || item.usuario}?`)) return
    const resposta = await excluirUsuarioApi(item.id)
    if (!resposta.ok) return setMensagem(resposta.erro || 'Falha ao excluir usuário.')
    setMensagem('Usuário excluído com sucesso.')
    carregar()
  }

  async function atualizarSenhaOuStatus(item, ativo) {
    if (!podeGerenciarUsuarioAlvo(usuarioAtual, item) && item.id !== usuarioAtual?.id) {
      return setMensagem('Seu perfil não pode alterar esse usuário.')
    }
    const resposta = await atualizarUsuarioApi({ id: item.id, nome: item.nome, senha: novaSenha[item.id] || undefined, ativo })
    if (!resposta.ok) return setMensagem(resposta.erro)
    setNovaSenha((atual) => ({ ...atual, [item.id]: '' }))
    setMensagem('Usuário atualizado com sucesso.')
    carregar()
  }

  async function importarCardapioBase() {
    try {
      const resumo = await importarProdutosBaseApi()
      setMensagem(`Cardápio base sincronizado. Itens novos: ${resumo.adicionados || 0} • itens ajustados: ${resumo.atualizados || 0} • base lida: ${resumo.totalBase || 0}.`)
      carregar()
    } catch (error) {
      setMensagem(error.message || 'Falha ao importar cardápio base.')
    }
  }

  async function salvarNovoProduto(e) {
    e.preventDefault()
    try {
      await salvarProdutoApi({ ...produtoForm, preco: parseNumero(produtoForm.preco) })
      setProdutoForm({ id: '', nome: '', preco: '', categoria: 'hamburgueres', tipo: 'lanche' })
      setMensagem(produtoForm.id ? 'Item atualizado com sucesso.' : 'Item salvo com sucesso.')
      carregar()
    } catch (error) {
      setMensagem(error.message || 'Falha ao salvar item.')
    }
  }

  async function editarProduto(produto) {
    setProdutoForm({ id: produto.id, nome: produto.nome, preco: mascararMoedaInput(String(Math.round(Number(produto.preco || 0) * 100))), categoria: produto.categoria, tipo: produto.tipo })
    setMensagem('Editando item. Altere os dados e clique em salvar item.')
    setTimeout(() => {
      editorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      editorRef.current?.classList.add('field-error-flash')
      setTimeout(() => editorRef.current?.classList.remove('field-error-flash'), 1800)
    }, 40)
  }

  async function excluirProduto(produto) {
    if (!window.confirm(`Excluir o item ${produto.nome}?`)) return
    try {
      await excluirProdutoApi(produto.id)
      setMensagem('Item excluído com sucesso.')
      carregar()
    } catch (error) {
      setMensagem(error.message || 'Falha ao excluir item.')
    }
  }

  async function encerrarCaixa() {
    if (!caixaAberto) return setMensagem('Nenhum caixa aberto.')
    const esperado = Number(resumoCaixa?.valorSistema || 0)
    const informado = parseNumero(valorContado) || esperado
    const diferenca = informado - esperado
    let motivo = ''
    if (Math.abs(diferenca) > 0.009) {
      motivo = window.prompt(`Diferença encontrada no fechamento.\nEsperado: ${formatarMoeda(esperado)}\nInformado: ${formatarMoeda(informado)}\nDiferença: ${formatarMoeda(diferenca)}\n\nDigite o motivo:`) || ''
      if (!motivo.trim()) return
    }
    const resposta = await fecharCaixaApi({ caixaId: caixaAberto.id, valorContado: informado, usuario: usuarioAtual, motivoFechamento: motivo })
    if (!resposta.ok) return setMensagem(resposta.error || resposta.erro)
    setValorContado('')
    setMensagem(`Caixa fechado com sucesso. Valor esperado: ${formatarMoeda(esperado)} | informado: ${formatarMoeda(informado)} | diferença: ${formatarMoeda(diferenca)}.`)
    carregar()
  }

  async function salvarConfiguracoesCaixa() {
    const novo = await salvarConfigApi({ alerta_sangria: Number(parseNumero(configDraft.alerta_sangria) || 0) })
    setConfig(novo)
    setConfigDraft({ alerta_sangria: mascararMoedaInput(String(Math.round(Number(novo.alerta_sangria || 0) * 100))) })
    setMensagem('Configurações do caixa salvas com sucesso.')
  }

  const categoriasDisponiveis = useMemo(() => ['todos', ...Array.from(new Set(produtos.map((item) => item.categoria).filter(Boolean)))], [produtos])
  const tiposDisponiveis = useMemo(() => ['todos', ...Array.from(new Set(produtos.map((item) => item.tipo).filter(Boolean)))], [produtos])
  const produtosFiltrados = useMemo(() => produtos.filter((produto) => {
    const bateBusca = !buscaProduto || `${produto.nome} ${produto.categoria} ${produto.tipo}`.toLowerCase().includes(buscaProduto.toLowerCase())
    const bateCategoria = filtroCategoria === 'todos' || produto.categoria === filtroCategoria
    const bateTipo = filtroTipo === 'todos' || produto.tipo === filtroTipo
    return bateBusca && bateCategoria && bateTipo
  }), [produtos, buscaProduto, filtroCategoria, filtroTipo])

  const caixasRecentes = useMemo(() => caixas.slice(0, 10), [caixas])
  const totalSaidasAtual = movimentacoes.reduce((soma, item) => soma + Number(item.valor || 0), 0)
  const totalVendasAtual = vendas.filter((item) => item.caixa_id === caixaAberto?.id && item.status === 'pago').reduce((soma, item) => soma + Number(item.pago || item.total || 0), 0)
  const abasDisponiveis = useMemo(() => [
    ...(podeUsuarios ? ['usuarios'] : []),
    'cardapio',
    'caixa',
  ], [podeUsuarios])

  if (!podeGestao) {
    return (
      <div className="stack gap-md compact-page">
        <div className="alert error">Seu perfil não tem acesso a esta área.</div>
      </div>
    )
  }

  return (
    <div className="stack gap-md compact-page">
      <div className="panel page-header compact-panel">
        <div>
          <h1>Gestão do sistema</h1>
          <p>Cardápio, caixa e usuários conforme o perfil logado. Usuário atual: <strong>{usuarioAtual?.nome || usuarioAtual?.usuario}</strong> — {tipoUsuarioLabel(usuarioAtual?.tipo)}.</p>
        </div>
        <div className="pill-group wrap-left">
          {abasDisponiveis.map((item) => (
            <button key={item} className={aba === item ? 'pill active' : 'pill'} onClick={() => setAba(item)}>
              {item === 'usuarios' ? 'Usuários' : item === 'cardapio' ? 'Cardápio' : 'Caixa'}
            </button>
          ))}
        </div>
      </div>
      {mensagem && <div className="alert">{mensagem}</div>}

      {aba === 'usuarios' && podeUsuarios && (
        <div className="page-grid admin-layout compact-page-grid">
          <form className="panel stack gap-sm compact-panel" onSubmit={cadastrarUsuario}>
            <h3>Cadastrar usuário</h3>
            <small className="muted">{usuarioAtual?.tipo === 'admin' ? 'Administrador cadastra gerente, supervisor e operador.' : 'Gerente cadastra supervisor e operador.'}</small>
            <label>Nome<input value={operadorForm.nome} onChange={(e) => setOperadorForm({ ...operadorForm, nome: e.target.value })} required /></label>
            <label>Usuário<input value={operadorForm.usuario} onChange={(e) => setOperadorForm({ ...operadorForm, usuario: e.target.value })} required /></label>
            <label>Senha<input value={operadorForm.senha} onChange={(e) => setOperadorForm({ ...operadorForm, senha: e.target.value })} required /></label>
            <label>Tipo do usuário
              <select value={operadorForm.tipo} onChange={(e) => setOperadorForm({ ...operadorForm, tipo: e.target.value })}>
                {tiposPermitidos.map((tipo) => <option key={tipo} value={tipo}>{tipoUsuarioLabel(tipo)}</option>)}
              </select>
            </label>
            <button className="primary-btn compact-btn">Salvar usuário</button>
          </form>
          <div className="panel compact-panel">
            <h3>Usuários cadastrados</h3>
            <div className="item-list tall compact-tall">
              {usuarios.map((item) => {
                const podeAlterar = podeGerenciarUsuarioAlvo(usuarioAtual, item) || item.id === usuarioAtual?.id
                return (
                  <div className="item-row wrap-row readable-row" key={item.id}>
                    <div className="pedido-meta">
                      <strong>{item.nome || item.usuario}</strong>
                      <small>Usuário: {item.usuario}</small>
                      <small>Perfil: {tipoUsuarioLabel(item.tipo)}</small>
                    </div>
                    <div className="stack gap-sm user-admin-actions compact-actions-box">
                      <input placeholder="Nova senha" value={novaSenha[item.id] || ''} onChange={(e) => setNovaSenha((atual) => ({ ...atual, [item.id]: e.target.value }))} />
                      <div className="item-actions wrap-actions">
                        <button type="button" className="ghost-btn compact-btn" disabled={!podeAlterar} onClick={() => atualizarSenhaOuStatus(item, item.ativo !== false)}>Salvar senha</button>
                        {item.tipo !== 'admin' && <button type="button" className={`compact-btn ${item.ativo === false ? 'secondary-btn' : 'danger-btn'}`} disabled={!podeGerenciarUsuarioAlvo(usuarioAtual, item)} onClick={() => atualizarSenhaOuStatus(item, item.ativo === false)}>{item.ativo === false ? 'Ativar' : 'Bloquear'}</button>}
                        {item.tipo !== 'admin' && <button type="button" className="danger-btn compact-btn" disabled={!podeGerenciarUsuarioAlvo(usuarioAtual, item)} onClick={() => excluirOperador(item)}>Excluir</button>}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {aba === 'cardapio' && (
        <div className="page-grid admin-layout compact-page-grid">
          <form ref={editorRef} className="panel stack gap-sm compact-panel" onSubmit={salvarNovoProduto}>
            <h3>{produtoForm.id ? 'Editar item' : 'Cadastrar item'}</h3>
            <div className="grid-2 compact-grid compact-form-grid">
              <label>Nome<input value={produtoForm.nome} onChange={(e) => setProdutoForm({ ...produtoForm, nome: e.target.value })} required /></label>
              <label>Preço<input value={produtoForm.preco} onChange={(e) => setProdutoForm({ ...produtoForm, preco: mascararMoedaInput(e.target.value) })} required /></label>
              <label><div className="label-inline-help"><span>Categoria</span><InfoHint text="Você pode escolher uma categoria já existente ou digitar uma nova. Assim não precisa mexer no banco toda hora." /></div><input list="categorias-cardapio" value={produtoForm.categoria} onChange={(e) => setProdutoForm({ ...produtoForm, categoria: e.target.value })} placeholder="Ex.: hamburgueres" /></label>
              <label><div className="label-inline-help"><span>Tipo</span><InfoHint text="Você pode escolher um tipo já existente ou digitar um novo." /></div><input list="tipos-cardapio" value={produtoForm.tipo} onChange={(e) => setProdutoForm({ ...produtoForm, tipo: e.target.value })} placeholder="Ex.: lanche" /></label>
              <datalist id="categorias-cardapio">{Array.from(new Set(['hamburgueres', 'combos', 'combos-grandes', 'bebidas', 'porcoes', 'promocoes', 'complementos', ...produtos.map((item) => item.categoria).filter(Boolean)])).map((cat) => <option key={cat} value={cat} />)}</datalist>
              <datalist id="tipos-cardapio">{Array.from(new Set(['promocao', 'combo', 'lanche', 'bebida', 'porcao', 'complemento', ...produtos.map((item) => item.tipo).filter(Boolean)])).map((tipo) => <option key={tipo} value={tipo} />)}</datalist>
            </div>
            <div className="item-actions wrap-actions">
              <button className="primary-btn compact-btn">{produtoForm.id ? 'Salvar alterações' : 'Salvar item'}</button>
              <button type="button" className="secondary-btn compact-btn" onClick={importarCardapioBase}>Importar itens faltantes do cardápio base</button>
              {produtoForm.id && <button type="button" className="ghost-btn compact-btn" onClick={() => setProdutoForm({ id: '', nome: '', preco: '', categoria: 'hamburgueres', tipo: 'lanche' })}>Cancelar edição</button>}
            </div>
          </form>
          <div className="panel compact-panel">
            <h3>Cardápio</h3>
            <div className="grid-3 compact-grid compact-form-grid">
              <label>Pesquisar item<input value={buscaProduto} onChange={(e) => setBuscaProduto(e.target.value)} placeholder="Digite nome, categoria ou tipo" /></label>
              <label>Filtrar categoria<select value={filtroCategoria} onChange={(e) => setFiltroCategoria(e.target.value)}>{categoriasDisponiveis.map((cat) => <option key={cat} value={cat}>{cat}</option>)}</select></label>
              <label>Filtrar tipo<select value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value)}>{tiposDisponiveis.map((tipo) => <option key={tipo} value={tipo}>{tipo}</option>)}</select></label>
            </div>
            <div className="item-list tall compact-tall">
              {produtosFiltrados.map((produto) => (
                <div className="item-row wrap-row readable-row" key={produto.id}>
                  <div className="pedido-meta">
                    <strong>{produto.nome}</strong>
                    <small>{produto.categoria} • {produto.tipo}</small>
                    <small>{formatarMoeda(Number(produto.preco || 0))}</small>
                  </div>
                  <div className="item-actions wrap-actions">
                    <button type="button" className="ghost-btn compact-btn" onClick={() => editarProduto(produto)}>Editar</button>
                    <button type="button" className="ghost-btn compact-btn" onClick={() => alternarProdutoApi(produto).then(carregar)}>{produto.ativo === false ? 'Ativar' : 'Ocultar'}</button>
                    <button type="button" className="danger-btn compact-btn" onClick={() => excluirProduto(produto)}>Excluir</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {aba === 'caixa' && (
        <div className="page-grid admin-layout compact-page-grid">
          <div className="stack gap-md">
            <div className="panel stack gap-sm compact-panel">
              <h3>Configurações do caixa <span className="title-help-inline"><InfoHint text="Os valores de entrega agora ficam só no menu Motocas. Aqui ficam apenas as configurações gerais do caixa." /></span></h3>
              <div className="grid-2 compact-grid compact-form-grid">
                <label><div className="label-inline-help"><span>Limite para alertar retirada</span><InfoHint text="Quando o dinheiro em caixa passar desse valor, o sistema avisa que já é hora de fazer sangria." /></div><input value={configDraft.alerta_sangria} onChange={(e) => setConfigDraft((atual) => ({ ...atual, alerta_sangria: e.target.value.replace(/[^0-9,]/g, '') }))} onBlur={(e) => setConfigDraft((atual) => ({ ...atual, alerta_sangria: mascararMoedaInput(e.target.value) }))} /></label>
              </div>
              <p className="muted">Os valores por corrida foram removidos desta tela para evitar conflito. Agora eles ficam apenas em Motocas.</p>
              <div className="item-actions wrap-actions"><button type="button" className="primary-btn compact-btn" onClick={salvarConfiguracoesCaixa}>Salvar alterações</button></div>
            </div>
            <div className="panel compact-panel">
              <h3>Saídas registradas no caixa atual</h3>
              <div className="item-list tall compact-tall">
                {!movimentacoes.length && <p className="muted">Nenhuma saída registrada.</p>}
                {movimentacoes.map((mov) => (
                  <div className="item-row wrap-row readable-row" key={mov.id}>
                    <div className="pedido-meta">
                      <strong>{mov.tipo === 'troco_motoca' ? 'Troco motoboy' : mov.tipo === 'sangria' ? 'Sangria' : 'Outra saída'}</strong>
                      <small>Operador: {operadorDaVenda(mov)}</small>
                      <small>{mov.motoca_nome ? `Motoboy: ${mov.motoca_nome}` : 'Sem motoboy'}</small>
                      <small>{mov.observacao || 'Sem observação'}</small>
                      <small>Horário: {dataHoraBR(mov.criado_em || mov.created_at)}</small>
                    </div>
                    <strong>{formatarMoeda(mov.valor || 0)}</strong>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="stack gap-md">
            <div className="panel stack gap-sm compact-panel">
              <h3>Fechamento do caixa</h3>
              {!caixaAberto ? <p className="muted">Nenhum caixa aberto.</p> : (
                <>
                  <div className="mini-info-row"><span>Operador do caixa</span><strong>{caixaAberto.usuario_id || caixaAberto.operador || '---'}</strong></div>
                  <div className="mini-info-row"><span>Aberto às</span><strong>{dataHoraBR(caixaAberto.data_abertura || caixaAberto.abertura)}</strong></div>
                  <div className="mini-info-row"><span>Responsável na abertura</span><strong>{caixaAberto.responsavel_abertura_nome || 'Não informado'}{caixaAberto.responsavel_abertura_tipo ? ` • ${tipoUsuarioLabel(caixaAberto.responsavel_abertura_tipo)}` : ''}</strong></div>
                  <div className="mini-info-row"><span>Moedas contadas</span><strong>{caixaAberto.moedas_nao_contadas ? 'Não' : 'Sim'}</strong></div>
                  <div className="mini-info-row"><span>Valor de abertura</span><strong>{formatarMoeda(resumoCaixa?.abertura || 0)}</strong></div>
                  <div className="mini-info-row"><span>Entradas registradas</span><strong>{formatarMoeda(totalVendasAtual)}</strong></div>
                  <div className="mini-info-row"><span>Saídas registradas</span><strong>{formatarMoeda(totalSaidasAtual)}</strong></div>
                  <div className="mini-info-row"><span>Saldo previsto</span><strong>{formatarMoeda(resumoCaixa?.valorSistema || 0)}</strong></div>
                  <label>Valor contado<input value={valorContado} onChange={(e) => setValorContado(mascararMoedaInput(e.target.value))} placeholder={String(resumoCaixa?.valorSistema || 0)} /></label>
                  <button type="button" className="danger-btn compact-btn" onClick={encerrarCaixa}>Fechar caixa</button>
                </>
              )}
            </div>
            <div className="panel compact-panel">
              <h3>Resumo dos caixas</h3>
              <div className="item-list tall compact-tall">
                {caixasRecentes.map((item) => (
                  <div className="item-row wrap-row readable-row" key={item.id}>
                    <div className="pedido-meta">
                      <strong>Caixa {item.status === 'aberto' ? 'aberto' : 'fechado'}</strong>
                      <small>Abertura: {dataHoraBR(item.data_abertura || item.abertura)}</small>
                      <small>Responsável: {item.responsavel_abertura_nome || 'Não informado'}{item.responsavel_abertura_tipo ? ` • ${tipoUsuarioLabel(item.responsavel_abertura_tipo)}` : ''}</small>
                      <small>Valor de abertura: {formatarMoeda(item.valor_abertura || item.valor_inicial || 0)}</small>
                    </div>
                    <strong>{item.status}</strong>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
