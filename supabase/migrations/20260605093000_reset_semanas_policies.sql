do $$
declare
  policy_name text;
begin
  for policy_name in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'semanas_epidemiologicas'
  loop
    execute format('drop policy if exists %I on public.semanas_epidemiologicas', policy_name);
  end loop;
end $$;

alter table public.semanas_epidemiologicas enable row level security;

grant select, insert, update, delete on table public.semanas_epidemiologicas to authenticated;

create policy semanas_epidemiologicas_select_authenticated
  on public.semanas_epidemiologicas
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.usuarios u
      where u.id = auth.uid()
        and (
          u.perfil in ('admin', 'administrador')
          or u.prefeituraid = semanas_epidemiologicas.prefeitura_id
        )
    )
  );

create policy semanas_epidemiologicas_insert_authenticated
  on public.semanas_epidemiologicas
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.usuarios u
      where u.id = auth.uid()
        and (
          u.perfil in ('admin', 'administrador')
          or (u.perfil = 'gestor' and u.prefeituraid = semanas_epidemiologicas.prefeitura_id)
        )
    )
  );

create policy semanas_epidemiologicas_update_authenticated
  on public.semanas_epidemiologicas
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.usuarios u
      where u.id = auth.uid()
        and (
          u.perfil in ('admin', 'administrador')
          or (u.perfil = 'gestor' and u.prefeituraid = semanas_epidemiologicas.prefeitura_id)
        )
    )
  )
  with check (
    exists (
      select 1
      from public.usuarios u
      where u.id = auth.uid()
        and (
          u.perfil in ('admin', 'administrador')
          or (u.perfil = 'gestor' and u.prefeituraid = semanas_epidemiologicas.prefeitura_id)
        )
    )
  );

create policy semanas_epidemiologicas_delete_admin
  on public.semanas_epidemiologicas
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.usuarios u
      where u.id = auth.uid()
        and u.perfil in ('admin', 'administrador')
    )
  );
