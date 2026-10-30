-- Ajustes apontados pelo `supabase db advisors` após a Fase 1.

-- 1) public.rls_auto_enable() é a função do event trigger do Supabase que liga o RLS em tabelas novas.
--    Não precisa ser executável por anon/authenticated (event triggers não checam EXECUTE ao disparar).
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;

-- 2) Uma política de SELECT por papel (múltiplas políticas permissivas são avaliadas uma a uma).
--    anon: só a vitrine. authenticated: vitrine OU membro da loja.

drop policy "vitrine: lojas ativas" on public.lojas;
drop policy "painel: membros veem a própria loja" on public.lojas;

create policy "vitrine: lojas ativas"
  on public.lojas for select to anon
  using (ativa);

create policy "vitrine ou painel: lojas"
  on public.lojas for select to authenticated
  using (ativa or (select private.eh_membro(id)));

drop policy "vitrine: produtos visíveis" on public.produtos;
drop policy "painel: membros veem produtos da loja" on public.produtos;

create policy "vitrine: produtos visíveis"
  on public.produtos for select to anon
  using (
    ativo and excluido_em is null
    and exists (select 1 from public.lojas l where l.id = loja_id and l.ativa)
  );

create policy "vitrine ou painel: produtos"
  on public.produtos for select to authenticated
  using (
    (ativo and excluido_em is null
      and exists (select 1 from public.lojas l where l.id = loja_id and l.ativa))
    or (select private.eh_membro(loja_id))
  );

drop policy "vitrine: imagens de produtos visíveis" on public.produto_imagens;
drop policy "painel: membros veem imagens da loja" on public.produto_imagens;

create policy "vitrine: imagens de produtos visíveis"
  on public.produto_imagens for select to anon
  using (
    exists (
      select 1 from public.produtos p
        join public.lojas l on l.id = p.loja_id
       where p.id = produto_id and p.ativo and p.excluido_em is null and l.ativa
    )
  );

create policy "vitrine ou painel: imagens"
  on public.produto_imagens for select to authenticated
  using (
    exists (
      select 1 from public.produtos p
        join public.lojas l on l.id = p.loja_id
       where p.id = produto_id and p.ativo and p.excluido_em is null and l.ativa
    )
    or (select private.eh_membro(loja_id))
  );
