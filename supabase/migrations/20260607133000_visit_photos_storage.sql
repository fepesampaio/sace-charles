insert into storage.buckets (id, name, public)
values ('fotos-visitas', 'fotos-visitas', true)
on conflict (id) do update
set public = excluded.public;

drop policy if exists "Authenticated can upload visit photos" on storage.objects;
create policy "Authenticated can upload visit photos"
on storage.objects
for insert
to authenticated
with check (bucket_id = 'fotos-visitas');

drop policy if exists "Authenticated can view visit photos" on storage.objects;
create policy "Authenticated can view visit photos"
on storage.objects
for select
to authenticated
using (bucket_id = 'fotos-visitas');

do $$
begin
  if exists (
    select 1
    from pg_tables
    where schemaname = 'public'
      and tablename = 'fotos'
  ) then
    execute 'alter table public.fotos enable row level security';
    execute 'drop policy if exists "Authenticated can view fotos" on public.fotos';
    execute 'drop policy if exists "Authenticated can insert fotos" on public.fotos';
    execute 'create policy "Authenticated can view fotos" on public.fotos for select to authenticated using (true)';
    execute 'create policy "Authenticated can insert fotos" on public.fotos for insert to authenticated with check (true)';
  end if;
end $$;
