alter table public.configuracoes_prefeitura enable row level security;

grant select, insert, update on public.configuracoes_prefeitura to authenticated;

drop policy if exists configuracoes_prefeitura_select_authenticated on public.configuracoes_prefeitura;
drop policy if exists configuracoes_prefeitura_insert_authenticated on public.configuracoes_prefeitura;
drop policy if exists configuracoes_prefeitura_update_authenticated on public.configuracoes_prefeitura;

create policy configuracoes_prefeitura_select_authenticated
  on public.configuracoes_prefeitura
  for select
  to authenticated
  using (
    public.current_usuario_perfil() in ('admin', 'administrador')
    or public.current_usuario_prefeituraid() = prefeitura_id
  );

create policy configuracoes_prefeitura_insert_authenticated
  on public.configuracoes_prefeitura
  for insert
  to authenticated
  with check (
    public.current_usuario_perfil() in ('admin', 'administrador')
    or (
      public.current_usuario_perfil() = 'gestor'
      and public.current_usuario_prefeituraid() = prefeitura_id
    )
  );

create policy configuracoes_prefeitura_update_authenticated
  on public.configuracoes_prefeitura
  for update
  to authenticated
  using (
    public.current_usuario_perfil() in ('admin', 'administrador')
    or (
      public.current_usuario_perfil() = 'gestor'
      and public.current_usuario_prefeituraid() = prefeitura_id
    )
  )
  with check (
    public.current_usuario_perfil() in ('admin', 'administrador')
    or (
      public.current_usuario_perfil() = 'gestor'
      and public.current_usuario_prefeituraid() = prefeitura_id
    )
  );
