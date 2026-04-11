AJUSTES IMPLEMENTADOS NESTA ENTREGA

1) ENTREGAS NO PDV
- Novo tipo de pedido: entrega
- Campo taxa de entrega no PDV
- Total final = itens + taxa_entrega
- taxa_entrega enviada para vendas_pdv
- Tipo entrega também aparece em relatórios e filtros

2) RELATÓRIOS / LASTRO
- Restaurado fluxo de relatórios com cards e botão de PDF
- Novo botão: Tirar lastro / Fechar lastro
- Lastro abre em modal grande com rolagem, sem tomar a tela inteira
- Resumo de caixa, pagamentos, entregas e saídas detalhadas
- Observação de divergência operacional nas entregas
- Cards adicionados: Entregas, Taxa de entrega, Pagamento motoboys

3) FECHAMENTO DE MOTOBOYS
- Até 7 espaços
- Nome, entregas normais, entregas distantes, valor normal, valor distante
- Total calculado automaticamente por motoboy
- Total geral do fechamento
- Preenchimento automático de apoio (editável depois)
- Salva em motoboys_fechamento

4) SQL NECESSÁRIO JÁ RODADO PELO USUÁRIO
- coluna taxa_entrega em vendas_pdv
- tipo entrega aceito no CHECK de vendas_pdv.tipo

OBSERVAÇÃO IMPORTANTE
- pagamento de motoboy ficou lançado como fechamento gerencial, não como baixa automática no caixa
- isso respeita o fluxo descrito: gerente confere e fecha manualmente no fim da noite
