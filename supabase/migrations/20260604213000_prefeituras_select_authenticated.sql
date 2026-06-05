alter table public.prefeituras enable row level security;

grant select on table public.prefeituras to authenticated;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'prefeituras'
      and policyname = 'prefeituras_select_authenticated'
  ) then
    create policy prefeituras_select_authenticated
      on public.prefeituras
      for select
      to authenticated
      using (true);
  end if;
end $$;
