alter table public.usuarios
  add column if not exists regiao text,
  add column if not exists setor text,
  add column if not exists gestor_id uuid,
  add column if not exists supervisor_id uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'usuarios_gestor_id_fkey'
  ) then
    alter table public.usuarios
      add constraint usuarios_gestor_id_fkey
      foreign key (gestor_id) references public.usuarios(id)
      on delete set null;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'usuarios_supervisor_id_fkey'
  ) then
    alter table public.usuarios
      add constraint usuarios_supervisor_id_fkey
      foreign key (supervisor_id) references public.usuarios(id)
      on delete set null;
  end if;
end $$;

update public.usuarios
set perfil = 'agente'
where perfil = 'auxiliar';

alter table public.usuarios
  drop constraint if exists usuarios_perfil_check;

alter table public.usuarios
  add constraint usuarios_perfil_check
  check (perfil is null or perfil in ('admin', 'gestor', 'supervisor', 'agente'));

create index if not exists usuarios_prefeituraid_perfil_idx
  on public.usuarios(prefeituraid, perfil);

create index if not exists usuarios_supervisor_id_idx
  on public.usuarios(supervisor_id);

create index if not exists usuarios_gestor_id_idx
  on public.usuarios(gestor_id);
