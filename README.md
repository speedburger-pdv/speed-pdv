# Speed PDV

Sistema web de PDV para complementar o Goomer na Speed Burger.

## O que já vem nesta versão

- Login por e-mail e senha
- Tela PDV com pedidos de mesa, balcão e retirada
- Controle de pagamentos com dinheiro, Pix, crédito e débito
- Pagamento dividido
- Tela de pendentes
- Painel administrativo
- Cadastro de produtos, promoções e combos
- Sangria, entrada manual e estorno no admin
- Relatórios simples por dia
- Layout responsivo para tablet, celular e desktop

## Stack

- React + Vite
- Supabase
- Vercel

## 1) Instalação local

```bash
npm install
npm run dev
```

## 2) Variáveis de ambiente

Crie um arquivo `.env` com base no `.env.example`.

## 3) Tabelas no Supabase

No Supabase, abra o SQL Editor e execute primeiro o arquivo `supabase_schema.sql`.
Depois execute `supabase_seed.sql` para subir o cardápio inicial.

## 4) Primeiro usuário admin

Você pode criar o primeiro usuário pelo Auth do Supabase e depois inserir na tabela `usuarios` um registro com `tipo = 'admin'`.

## 5) Deploy na Vercel

- Importar o repositório GitHub
- Adicionar as variáveis `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`
- Deploy

## Observações importantes

- O sistema foi pensado para complementar o Goomer, não para substituí-lo.
- A operação pode registrar as comandas em tempo real ou poucos minutos depois, mantendo o foco no fechamento de caixa.
- Sangria, estorno e entrada manual ficam concentrados no painel administrativo.
