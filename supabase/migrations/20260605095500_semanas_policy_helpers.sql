create or replace function public.current_usuario_perfil()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select u.perfil
  from public.usuarios u
  where u.id = auth.uid()
  limit 1
$$;

create or replace function public.current_usuario_prefeituraid()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select u.prefeituraid
  from public.usuarios u
  where u.id = auth.uid()
  limit 1
$$;

drop policy if exists semanas_epidemiologicas_select_authenticated on public.semanas_epidemiologicas;
drop policy if exists semanas_epidemiologicas_insert_authenticated on public.semanas_epidemiologicas;
drop policy if exists semanas_epidemiologicas_update_authenticated on public.semanas_epidemiologicas;
drop policy if exists semanas_epidemiologicas_delete_admin on public.semanas_epidemiologicas;

create policy semanas_epidemiologicas_select_authenticated
  on public.semanas_epidemiologicas
  for select
  to authenticated
  using (
    public.current_usuario_perfil() in ('admin', 'administrador')
    or public.current_usuario_prefeituraid() = prefeitura_id
  );

create policy semanas_epidemiologicas_insert_authenticated
  on public.semanas_epidemiologicas
  for insert
  to authenticated
  with check (
    public.current_usuario_perfil() in ('admin', 'administrador')
    or (
      public.current_usuario_perfil() = 'gestor'
      and public.current_usuario_prefeituraid() = prefeitura_id
    )
  );

create policy semanas_epidemiologicas_update_authenticated
  on public.semanas_epidemiologicas
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

create policy semanas_epidemiologicas_delete_admin
  on public.semanas_epidemiologicas
  for delete
  to authenticated
  using (public.current_usuario_perfil() in ('admin', 'administrador'));
