export const formatarMoeda = (valor = 0) =>
  Number(valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export const agora = () => new Date().toISOString()

export const nomeTipoPedido = {
  mesa: 'Mesa',
  balcao: 'Balcão',
  retirada: 'Retirada',
}

export const formasPagamento = ['dinheiro', 'pix', 'credito', 'debito']
