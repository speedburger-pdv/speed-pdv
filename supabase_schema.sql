create extension if not exists "uuid-ossp";

create table if not exists usuarios (
  id uuid primary key default uuid_generate_v4(),
  nome text,
  email text unique,
  senha text,
  tipo text,
  created_at timestamp default now()
);

create table if not exists produtos (
  id uuid primary key default uuid_generate_v4(),
  nome text,
  preco numeric,
  categoria text,
  ativo boolean default true,
  created_at timestamp default now(),
  tipo text
);

create table if not exists pedidos (
  id uuid primary key default uuid_generate_v4(),
  tipo text,
  nome_cliente text,
  mesa text,
  status text,
  total numeric,
  created_at timestamp default now(),
  origem text,
  observacao text,
  valor_pago numeric default 0,
  status_real text default 'aberto'
);

create table if not exists pedido_itens (
  id uuid primary key default uuid_generate_v4(),
  pedido_id uuid references pedidos(id) on delete cascade,
  produto_id uuid references produtos(id),
  quantidade int,
  preco numeric
);

create table if not exists caixa (
  id uuid primary key default uuid_generate_v4(),
  operador text,
  abertura timestamp,
  fechamento timestamp,
  valor_inicial numeric,
  valor_final numeric,
  status text default 'aberto'
);

create table if not exists pagamentos (
  id uuid primary key default uuid_generate_v4(),
  pedido_id uuid references pedidos(id) on delete cascade,
  tipo text,
  valor numeric,
  created_at timestamp default now()
);

create table if not exists movimentacoes_caixa (
  id uuid primary key default uuid_generate_v4(),
  tipo text,
  valor numeric,
  descricao text,
  operador text,
  pedido_id uuid references pedidos(id) on delete set null,
  created_at timestamp default now()
);

create index if not exists idx_pedidos_status on pedidos(status);
create index if not exists idx_produtos_nome on produtos(nome);
