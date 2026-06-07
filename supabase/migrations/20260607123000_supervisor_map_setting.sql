alter table public.configuracoes_prefeitura
add column if not exists exibir_mapa_supervisor boolean not null default false;
