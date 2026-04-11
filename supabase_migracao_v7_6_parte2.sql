begin;

-- Metadados extras para o fechamento oficial dos motocas
alter table if exists public.motoboys_fechamento
  add column if not exists entregas_dinheiro integer default 0,
  add column if not exists entregas_cartao integer default 0,
  add column if not exists entregas_pix integer default 0,
  add column if not exists forma_recebimento text default 'dinheiro',
  add column if not exists divergencia boolean default false,
  add column if not exists motivo_divergencia text,
  add column if not exists conferido_por_nome text,
  add column if not exists conferido_por_tipo text,
  add column if not exists total_entregas_sistema integer default 0,
  add column if not exists total_entregas_informadas integer default 0,
  add column if not exists pagamentos_dinheiro_sistema integer default 0,
  add column if not exists pagamentos_cartao_sistema integer default 0,
  add column if not exists pagamentos_pix_sistema integer default 0,
  add column if not exists pagamentos_dinheiro_informados integer default 0,
  add column if not exists pagamentos_cartao_informados integer default 0,
  add column if not exists pagamentos_pix_informados integer default 0,
  add column if not exists portal_total_entregas integer default 0,
  add column if not exists portal_total_receber numeric default 0,
  add column if not exists portal_total_dinheiro_entregue numeric default 0,
  add column if not exists portal_dinheiro integer default 0,
  add column if not exists portal_cartao integer default 0,
  add column if not exists portal_pix integer default 0;

create index if not exists motoboys_fechamento_created_at_idx
  on public.motoboys_fechamento (created_at desc);

commit;
