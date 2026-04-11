begin;

-- Perfis adicionais no sistema
alter table if exists public.usuarios_sistema
  drop constraint if exists usuarios_sistema_tipo_check;

alter table if exists public.usuarios_sistema
  add constraint usuarios_sistema_tipo_check
  check (tipo in ('admin','gerente','supervisor','operador'));

-- Garante que exista no máximo 1 administrador
create unique index if not exists usuarios_sistema_admin_unico_idx
  on public.usuarios_sistema ((case when tipo = 'admin' then 1 else null end));

-- Metadados de abertura/fechamento do caixa
alter table if exists public.caixas
  add column if not exists responsavel_abertura_nome text,
  add column if not exists responsavel_abertura_tipo text,
  add column if not exists moedas_nao_contadas boolean default false,
  add column if not exists responsavel_fechamento_nome text,
  add column if not exists responsavel_fechamento_tipo text,
  add column if not exists motivo_fechamento text;

-- Tabela de prestações do portal do motoca
create table if not exists public.motocas_portal_prestacoes (
  id uuid primary key default gen_random_uuid(),
  motoboy_id uuid references public.motoboys(id) on delete set null,
  nome text not null,
  entregas_normais integer default 0,
  entregas_distantes integer default 0,
  entregas_dinheiro integer default 0,
  entregas_cartao integer default 0,
  entregas_pix integer default 0,
  valor_normal numeric default 0,
  valor_distante numeric default 0,
  dinheiro_entregue numeric default 0,
  forma_recebimento text default 'dinheiro',
  total numeric default 0,
  numero_pedido text,
  origem text,
  cliente_nome text,
  valor_total numeric default 0,
  forma_pagamento_principal text,
  maquininha_usada text,
  troco_para numeric default 0,
  troco_cliente numeric default 0,
  observacao text,
  editado boolean default false,
  editado_em timestamp without time zone,
  created_at timestamp without time zone default now(),
  updated_at timestamp without time zone default now()
);

alter table if exists public.motocas_portal_prestacoes
  add column if not exists numero_pedido text,
  add column if not exists origem text,
  add column if not exists cliente_nome text,
  add column if not exists valor_total numeric default 0,
  add column if not exists forma_pagamento_principal text,
  add column if not exists maquininha_usada text,
  add column if not exists troco_para numeric default 0,
  add column if not exists troco_cliente numeric default 0,
  add column if not exists observacao text,
  add column if not exists editado boolean default false,
  add column if not exists editado_em timestamp without time zone,
  add column if not exists updated_at timestamp without time zone default now();

create index if not exists motocas_portal_prestacoes_nome_data_idx
  on public.motocas_portal_prestacoes (nome, created_at desc);

commit;
