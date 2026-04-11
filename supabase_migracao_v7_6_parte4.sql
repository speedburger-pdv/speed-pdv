begin;

alter table if exists public.motocas_portal_prestacoes
  add column if not exists finalizado boolean default false,
  add column if not exists finalizado_em timestamp without time zone;

commit;
