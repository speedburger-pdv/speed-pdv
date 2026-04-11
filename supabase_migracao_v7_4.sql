-- SPEED PDV V7.4
-- Rode apenas se o Portal do Motoboy reclamar de permissão no Supabase.

alter table if exists public.motoboys enable row level security;

drop policy if exists "motoboys_all" on public.motoboys;
create policy "motoboys_all"
  on public.motoboys
  for all
  using (true)
  with check (true);
