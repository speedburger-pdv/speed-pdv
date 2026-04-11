-- SPEED PDV V7.3 - MIGRAÇÃO SEGURA E INCREMENTAL
-- Rode este arquivo no SQL Editor do Supabase somente se quiser alinhar o banco com as telas atuais.
-- Todos os comandos usam IF EXISTS / IF NOT EXISTS para reduzir risco.

alter table if exists public.vendas_pdv
  add column if not exists taxa_entrega numeric default 0;

alter table if exists public.vendas_pdv
  drop constraint if exists vendas_pdv_tipo_check;

alter table if exists public.vendas_pdv
  add constraint vendas_pdv_tipo_check
  check (tipo in ('mesa','balcao','retirada','entrega'));

alter table if exists public.motoboys_fechamento
  add column if not exists entregas_dinheiro integer default 0,
  add column if not exists entregas_cartao integer default 0,
  add column if not exists entregas_pix integer default 0,
  add column if not exists forma_recebimento text default 'dinheiro';

create index if not exists idx_motoboys_fechamento_created_at
  on public.motoboys_fechamento (created_at desc);

alter table if exists public.motoboys_fechamento enable row level security;

drop policy if exists "motoboys_fechamento_all" on public.motoboys_fechamento;
create policy "motoboys_fechamento_all"
  on public.motoboys_fechamento
  for all
  using (true)
  with check (true);
