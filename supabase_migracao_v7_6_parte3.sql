begin;

alter table if exists public.motocas_portal_prestacoes
  add column if not exists maquininha_padrao text,
  add column if not exists observacao_geral text,
  add column if not exists entregas_detalhe jsonb default '[]'::jsonb;

commit;
