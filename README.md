# Speed PDV

Sistema web para operação de caixa da Speed Burger, funcionando como complemento do Goomer.

## O que foi ajustado nesta versão

- conexão do frontend com Supabase
- login lendo `usuarios_sistema`
- cadastro de operador salvando em `usuarios_sistema` e `operadores_caixa`
- PDV com venda de mesa, balcão e retirada
- gravação em `vendas_pdv`, `itens_venda_pdv` e `pagamentos_venda_pdv`
- troco motoca salvo em `saidas_caixa`
- abertura e fechamento de caixa usando `caixas`
- relatórios básicos por período
- fallback local quando as variáveis do Supabase não estiverem preenchidas
- scripts do Vite ajustados para evitar erro de execução do `.bin/vite`

## Como configurar

1. Crie um arquivo `.env` na raiz do projeto.
2. Copie o conteúdo de `.env.example`.
3. Preencha:

```env
VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co
VITE_SUPABASE_ANON_KEY=SUA_CHAVE_ANON_PUBLICA
```

## SQL necessário

Se o schema principal já está criado no Supabase, rode apenas:

- `supabase_policies.sql`

Se ainda precisar recriar a base, use o schema que você já montou no Supabase e depois aplique as policies.

## Rodar localmente

```bash
npm install
npm run dev
```

## Login padrão

- usuário: `admin`
- senha: `kevin2236`

## Observações

- entregas não entram em `vendas_pdv`
- troco de motoboy entra como saída de caixa
- produtos devem ser desativados, não deletados
- o sistema foi preparado para operação real, mas ainda vale testar com seu fluxo antes de colocar em produção final
