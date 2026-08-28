-- FLOW Indicator Studio v2
-- Complementa a v1 com envio diario de prints, extracao assistida por visao,
-- controle de atraso, aliases de metricas e layout livre da apresentacao.

alter table public.indicator_definitions
  add column if not exists aliases text[] not null default '{}'::text[],
  add column if not exists extraction_hint text;

alter table public.indicator_measurements
  add column if not exists confidence numeric,
  add column if not exists raw_text text;

alter table public.indicator_measurements
  drop constraint if exists indicator_measurements_source_type_check;

alter table public.indicator_measurements
  add constraint indicator_measurements_source_type_check
  check (source_type in ('manual','image','import','integration'));

create table if not exists public.indicator_submissions (
  id uuid primary key default gen_random_uuid(),
  platform_id uuid not null references public.platforms(id) on delete cascade,
  responsible_id uuid references public.profiles(id) on delete set null,
  reference_date date not null,
  status text not null default 'draft'
    check (status in ('draft','uploaded','extracting','extracted','confirmed','error')),
  upload_completed_at timestamptz,
  extracted_at timestamptz,
  confirmed_at timestamptz,
  is_late boolean not null default false,
  extraction_warnings jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(platform_id, reference_date)
);

create table if not exists public.indicator_submission_images (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.indicator_submissions(id) on delete cascade,
  image_url text not null,
  storage_path text,
  original_name text,
  display_order integer not null default 0,
  extraction_status text not null default 'pending'
    check (extraction_status in ('pending','processed','error')),
  extraction_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.indicator_measurements
  add column if not exists submission_id uuid references public.indicator_submissions(id) on delete set null;

alter table public.indicator_report_blocks
  add column if not exists x numeric not null default 4,
  add column if not exists y numeric not null default 4,
  add column if not exists height numeric not null default 24,
  add column if not exists z_index integer not null default 1,
  add column if not exists style jsonb not null default '{}'::jsonb;

-- Na v1 width era uma coluna de 1..12. Na v2 ela passa a representar largura percentual.
alter table public.indicator_report_blocks
  alter column width type numeric using width::numeric,
  alter column width set default 44;

-- Permite upsert simples dos relatorios diarios pelo cliente/PostgREST.
create unique index if not exists indicator_reports_reference_unique
  on public.indicator_reports(platform_id, report_type, reference_date);

create index if not exists indicator_submissions_platform_date_idx
  on public.indicator_submissions(platform_id, reference_date desc);
create index if not exists indicator_submission_images_submission_idx
  on public.indicator_submission_images(submission_id, display_order);
create index if not exists indicator_measurements_submission_idx
  on public.indicator_measurements(submission_id);

alter table public.indicator_submissions enable row level security;
alter table public.indicator_submission_images enable row level security;

grant select, insert, update, delete on public.indicator_submissions to authenticated;
grant select, insert, update, delete on public.indicator_submission_images to authenticated;

drop policy if exists "indicator_submissions_authenticated" on public.indicator_submissions;
create policy "indicator_submissions_authenticated"
  on public.indicator_submissions for all to authenticated using (true) with check (true);

drop policy if exists "indicator_submission_images_authenticated" on public.indicator_submission_images;
create policy "indicator_submission_images_authenticated"
  on public.indicator_submission_images for all to authenticated using (true) with check (true);

-- Garante o bucket usado pelo fluxo antigo e pelo novo Studio.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'platform-indicators',
  'platform-indicators',
  true,
  12582912,
  array['image/png','image/jpeg','image/webp']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- Politicas de storage aditivas.
drop policy if exists "platform indicators authenticated select" on storage.objects;
create policy "platform indicators authenticated select"
on storage.objects for select to authenticated
using (bucket_id = 'platform-indicators');

drop policy if exists "platform indicators authenticated insert" on storage.objects;
create policy "platform indicators authenticated insert"
on storage.objects for insert to authenticated
with check (bucket_id = 'platform-indicators');

drop policy if exists "platform indicators authenticated update" on storage.objects;
create policy "platform indicators authenticated update"
on storage.objects for update to authenticated
using (bucket_id = 'platform-indicators')
with check (bucket_id = 'platform-indicators');

drop policy if exists "platform indicators authenticated delete" on storage.objects;
create policy "platform indicators authenticated delete"
on storage.objects for delete to authenticated
using (bucket_id = 'platform-indicators');

-- Calcula atraso usando o horario limite configurado na plataforma.
create or replace function public.flow_set_indicator_submission_late()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deadline time;
  v_local_time time;
begin
  if new.upload_completed_at is null then
    return new;
  end if;

  select upload_deadline::time into v_deadline
  from public.platforms
  where id = new.platform_id;

  if v_deadline is null then
    new.is_late := false;
    return new;
  end if;

  v_local_time := (new.upload_completed_at at time zone 'America/Sao_Paulo')::time;
  new.is_late := v_local_time > v_deadline;
  return new;
end;
$$;

drop trigger if exists indicator_submission_set_late on public.indicator_submissions;
create trigger indicator_submission_set_late
before insert or update of upload_completed_at, platform_id
on public.indicator_submissions
for each row execute function public.flow_set_indicator_submission_late();
