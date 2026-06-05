create table if not exists public.ibge_municipios_bahia (
  ibge_id bigint primary key,
  nome text not null,
  uf_id integer not null,
  uf_sigla text not null,
  uf_nome text not null,
  regiao_id integer,
  regiao_sigla text,
  regiao_nome text,
  mesorregiao_id integer,
  mesorregiao_nome text,
  microrregiao_id integer,
  microrregiao_nome text,
  regiao_intermediaria_id integer,
  regiao_intermediaria_nome text,
  regiao_imediata_id integer,
  regiao_imediata_nome text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.ibge_municipios_bahia enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'ibge_municipios_bahia'
      and policyname = 'ibge_municipios_bahia_select_authenticated'
  ) then
    create policy ibge_municipios_bahia_select_authenticated
      on public.ibge_municipios_bahia
      for select
      to authenticated
      using (true);
  end if;
end $$;

alter table public.prefeituras
  add column if not exists ibge_municipio_id bigint;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'prefeituras_ibge_municipio_id_fkey'
  ) then
    alter table public.prefeituras
      add constraint prefeituras_ibge_municipio_id_fkey
      foreign key (ibge_municipio_id)
      references public.ibge_municipios_bahia(ibge_id)
      on delete set null;
  end if;
end $$;

create unique index if not exists prefeituras_ibge_municipio_id_key
  on public.prefeituras(ibge_municipio_id)
  where ibge_municipio_id is not null;
