-- FLOW V3 - mural estilo quadro escolar
-- Execute depois da migration que cria public.flow_announcements.

alter table public.flow_announcements
  add column if not exists paper_color text not null default 'ice',
  add column if not exists note_size text not null default 'md',
  add column if not exists position_x double precision not null default 8,
  add column if not exists position_y double precision not null default 8,
  add column if not exists rotation double precision not null default 0,
  add column if not exists image_url text,
  add column if not exists z_index integer not null default 1;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'flow_announcements_paper_color_check'
      and conrelid = 'public.flow_announcements'::regclass
  ) then
    alter table public.flow_announcements
      add constraint flow_announcements_paper_color_check
      check (paper_color in ('ice', 'sky', 'mint', 'peach', 'lemon', 'lilac', 'rose', 'sand', 'blue', 'cobalt', 'midnight'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'flow_announcements_note_size_check'
      and conrelid = 'public.flow_announcements'::regclass
  ) then
    alter table public.flow_announcements
      add constraint flow_announcements_note_size_check
      check (note_size in ('sm', 'md', 'lg'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'flow_announcements_position_x_check'
      and conrelid = 'public.flow_announcements'::regclass
  ) then
    alter table public.flow_announcements
      add constraint flow_announcements_position_x_check
      check (position_x between 0 and 100);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'flow_announcements_position_y_check'
      and conrelid = 'public.flow_announcements'::regclass
  ) then
    alter table public.flow_announcements
      add constraint flow_announcements_position_y_check
      check (position_y between 0 and 100);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'flow_announcements_rotation_check'
      and conrelid = 'public.flow_announcements'::regclass
  ) then
    alter table public.flow_announcements
      add constraint flow_announcements_rotation_check
      check (rotation between -12 and 12);
  end if;
end $$;

-- Espalha avisos antigos pelo quadro para não nascerem sobrepostos.
with ranked as (
  select
    id,
    row_number() over (order by is_pinned desc, created_at asc) as rn
  from public.flow_announcements
)
update public.flow_announcements as a
set
  position_x = 4 + (((r.rn - 1) % 3) * 31),
  position_y = 6 + ((floor((r.rn - 1) / 3.0)::int % 3) * 30),
  rotation = case ((r.rn - 1) % 5)
    when 0 then -2.5
    when 1 then 1.5
    when 2 then -1
    when 3 then 2.5
    else 0
  end,
  z_index = r.rn
from ranked r
where a.id = r.id
  and a.position_x = 8
  and a.position_y = 8;

create index if not exists flow_announcements_board_order_idx
  on public.flow_announcements (z_index, created_at);

-- Bucket de imagens do mural.
-- Ele é público somente para leitura da URL; upload/alteração/exclusão continuam protegidos por RLS.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'flow-board',
  'flow-board',
  true,
  8388608,
  array['image/png', 'image/jpeg', 'image/webp', 'image/gif']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "flow board admins can upload" on storage.objects;
create policy "flow board admins can upload"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'flow-board'
  and exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and lower(p.role) in ('manager', 'admin', 'gestor')
  )
);

drop policy if exists "flow board admins can update files" on storage.objects;
create policy "flow board admins can update files"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'flow-board'
  and exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and lower(p.role) in ('manager', 'admin', 'gestor')
  )
)
with check (
  bucket_id = 'flow-board'
  and exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and lower(p.role) in ('manager', 'admin', 'gestor')
  )
);

drop policy if exists "flow board admins can delete files" on storage.objects;
create policy "flow board admins can delete files"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'flow-board'
  and exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and lower(p.role) in ('manager', 'admin', 'gestor')
  )
);
