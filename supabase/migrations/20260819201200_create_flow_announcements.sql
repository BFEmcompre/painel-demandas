-- Flow Home: mural de avisos administrável.
-- Todos os usuários autenticados podem visualizar avisos publicados e vigentes.
-- Gestores/admins podem visualizar rascunhos e criar, editar ou remover avisos.

create table if not exists public.flow_announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 120),
  content text not null check (char_length(content) between 1 and 2000),
  category text not null default 'novidade'
    check (category in ('novidade', 'aniversario', 'comunicado', 'conquista', 'evento')),
  emoji text,
  accent text not null default 'violet'
    check (accent in ('violet', 'cyan', 'rose', 'amber', 'emerald')),
  is_pinned boolean not null default false,
  is_published boolean not null default true,
  starts_at timestamptz,
  expires_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint flow_announcements_date_window check (
    expires_at is null or starts_at is null or expires_at > starts_at
  )
);

create index if not exists flow_announcements_visibility_idx
  on public.flow_announcements (is_published, is_pinned, starts_at, expires_at, created_at desc);

alter table public.flow_announcements enable row level security;

grant select, insert, update, delete on public.flow_announcements to authenticated;

-- Usuários comuns só enxergam itens publicados dentro da janela de exibição.
-- Gestores/admins também enxergam rascunhos para poder administrá-los.
drop policy if exists "flow announcements visible to authenticated users" on public.flow_announcements;
create policy "flow announcements visible to authenticated users"
on public.flow_announcements
for select
to authenticated
using (
  (
    is_published = true
    and (starts_at is null or starts_at <= now())
    and (expires_at is null or expires_at > now())
  )
  or exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and lower(p.role) in ('manager', 'admin', 'gestor')
  )
);

drop policy if exists "flow announcements admins can insert" on public.flow_announcements;
create policy "flow announcements admins can insert"
on public.flow_announcements
for insert
to authenticated
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and lower(p.role) in ('manager', 'admin', 'gestor')
  )
);

drop policy if exists "flow announcements admins can update" on public.flow_announcements;
create policy "flow announcements admins can update"
on public.flow_announcements
for update
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and lower(p.role) in ('manager', 'admin', 'gestor')
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and lower(p.role) in ('manager', 'admin', 'gestor')
  )
);

drop policy if exists "flow announcements admins can delete" on public.flow_announcements;
create policy "flow announcements admins can delete"
on public.flow_announcements
for delete
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and lower(p.role) in ('manager', 'admin', 'gestor')
  )
);

-- Inclui a tabela no Postgres Changes apenas quando a publicação não é FOR ALL TABLES
-- e a tabela ainda não participa dela.
do $$
begin
  if exists (
    select 1 from pg_publication where pubname = 'supabase_realtime' and puballtables = false
  ) and not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'flow_announcements'
  ) then
    execute 'alter publication supabase_realtime add table public.flow_announcements';
  end if;
end $$;

insert into public.flow_announcements (
  title,
  content,
  category,
  emoji,
  accent,
  is_pinned,
  is_published
)
select
  'Bem-vindos ao novo Flow ✨',
  'A nova home chegou para deixar o dia mais leve, visual e conectado. Este mural será o ponto de encontro para novidades, aniversários, conquistas e comunicados do time.',
  'novidade',
  '✨',
  'violet',
  true,
  true
where not exists (select 1 from public.flow_announcements);
