-- SPEED PDV - POLÍTICAS BÁSICAS PARA USO COM CHAVE ANON
-- Rode este arquivo no SQL Editor do Supabase depois de confirmar que as tabelas já existem.

alter table if exists usuarios_sistema enable row level security;
alter table if exists operadores_caixa enable row level security;
alter table if exists caixas enable row level security;
alter table if exists produtos_cardapio enable row level security;
alter table if exists vendas_pdv enable row level security;
alter table if exists itens_venda_pdv enable row level security;
alter table if exists pagamentos_venda_pdv enable row level security;
alter table if exists saidas_caixa enable row level security;
alter table if exists motoboys enable row level security;
alter table if exists motoboys_fechamento enable row level security;

drop policy if exists "usuarios_sistema_all" on usuarios_sistema;
create policy "usuarios_sistema_all" on usuarios_sistema for all using (true) with check (true);

drop policy if exists "operadores_caixa_all" on operadores_caixa;
create policy "operadores_caixa_all" on operadores_caixa for all using (true) with check (true);

drop policy if exists "caixas_all" on caixas;
create policy "caixas_all" on caixas for all using (true) with check (true);

drop policy if exists "produtos_cardapio_all" on produtos_cardapio;
create policy "produtos_cardapio_all" on produtos_cardapio for all using (true) with check (true);

drop policy if exists "vendas_pdv_all" on vendas_pdv;
create policy "vendas_pdv_all" on vendas_pdv for all using (true) with check (true);

drop policy if exists "itens_venda_pdv_all" on itens_venda_pdv;
create policy "itens_venda_pdv_all" on itens_venda_pdv for all using (true) with check (true);

drop policy if exists "pagamentos_venda_pdv_all" on pagamentos_venda_pdv;
create policy "pagamentos_venda_pdv_all" on pagamentos_venda_pdv for all using (true) with check (true);

drop policy if exists "saidas_caixa_all" on saidas_caixa;
create policy "saidas_caixa_all" on saidas_caixa for all using (true) with check (true);

drop policy if exists "motoboys_all" on motoboys;
create policy "motoboys_all" on motoboys for all using (true) with check (true);

drop policy if exists "motoboys_fechamento_all" on motoboys_fechamento;
create policy "motoboys_fechamento_all" on motoboys_fechamento for all using (true) with check (true);
