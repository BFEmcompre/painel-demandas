-- FLOW Indicator Studio v1
-- Estrutura aditiva: preserva platforms, platform_indicator_sections e platform_indicator_images.

create table if not exists public.indicator_definitions (
  id uuid primary key default gen_random_uuid(),
  platform_id uuid not null references public.platforms(id) on delete cascade,
  section_id uuid references public.platform_indicator_sections(id) on delete set null,
  name text not null,
  description text,
  unit text not null default 'number',
  direction text not null default 'higher' check (direction in ('higher','lower','target')),
  target_value numeric,
  warning_threshold numeric,
  weekly_aggregation text not null default 'last' check (weekly_aggregation in ('last','avg','sum','min','max')),
  display_order integer not null default 0,
  active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.indicator_measurements (
  id uuid primary key default gen_random_uuid(),
  indicator_id uuid not null references public.indicator_definitions(id) on delete cascade,
  reference_date date not null,
  value numeric not null,
  source_type text not null default 'manual' check (source_type in ('manual','import','integration')),
  source_metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique(indicator_id, reference_date)
);

create table if not exists public.indicator_reports (
  id uuid primary key default gen_random_uuid(),
  platform_id uuid not null references public.platforms(id) on delete cascade,
  responsible_id uuid references public.profiles(id) on delete set null,
  report_type text not null default 'daily' check (report_type in ('daily','weekly','executive')),
  reference_date date,
  period_start date,
  period_end date,
  title text,
  summary text,
  status text not null default 'draft' check (status in ('draft','ready','presented','archived')),
  snapshot jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists indicator_reports_daily_unique
  on public.indicator_reports(platform_id, report_type, reference_date)
  where report_type = 'daily';

create unique index if not exists indicator_reports_weekly_unique
  on public.indicator_reports(platform_id, report_type, period_start, period_end)
  where report_type = 'weekly';

create table if not exists public.indicator_report_blocks (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.indicator_reports(id) on delete cascade,
  block_type text not null check (block_type in ('kpi','chart','image','text','insight','impact','action','table','divider')),
  title text,
  content jsonb not null default '{}'::jsonb,
  display_order integer not null default 0,
  width integer not null default 12,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.indicator_insights (
  id uuid primary key default gen_random_uuid(),
  platform_id uuid not null references public.platforms(id) on delete cascade,
  indicator_id uuid references public.indicator_definitions(id) on delete cascade,
  reference_date date not null,
  kind text not null check (kind in ('observation','positive','negative','cause','risk')),
  text text not null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.indicator_actions (
  id uuid primary key default gen_random_uuid(),
  platform_id uuid not null references public.platforms(id) on delete cascade,
  indicator_id uuid references public.indicator_definitions(id) on delete set null,
  reference_date date not null,
  title text not null,
  description text,
  owner_id uuid references public.profiles(id) on delete set null,
  due_date date,
  status text not null default 'open' check (status in ('open','doing','done','cancelled')),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists indicator_measurements_indicator_date_idx on public.indicator_measurements(indicator_id, reference_date desc);
create index if not exists indicator_reports_platform_period_idx on public.indicator_reports(platform_id, report_type, reference_date desc, period_start desc);
create index if not exists indicator_insights_platform_date_idx on public.indicator_insights(platform_id, reference_date desc);
create index if not exists indicator_actions_platform_status_idx on public.indicator_actions(platform_id, status, due_date);

alter table public.indicator_definitions enable row level security;
alter table public.indicator_measurements enable row level security;
alter table public.indicator_reports enable row level security;
alter table public.indicator_report_blocks enable row level security;
alter table public.indicator_insights enable row level security;
alter table public.indicator_actions enable row level security;

grant select, insert, update, delete on public.indicator_definitions to authenticated;
grant select, insert, update, delete on public.indicator_measurements to authenticated;
grant select, insert, update, delete on public.indicator_reports to authenticated;
grant select, insert, update, delete on public.indicator_report_blocks to authenticated;
grant select, insert, update, delete on public.indicator_insights to authenticated;
grant select, insert, update, delete on public.indicator_actions to authenticated;

-- V1: acesso autenticado. A aplicação continua filtrando por plataforma/responsável.
-- Em uma fase posterior, endurecer RLS por role e ownership.
create policy "indicator_definitions_authenticated" on public.indicator_definitions for all to authenticated using (true) with check (true);
create policy "indicator_measurements_authenticated" on public.indicator_measurements for all to authenticated using (true) with check (true);
create policy "indicator_reports_authenticated" on public.indicator_reports for all to authenticated using (true) with check (true);
create policy "indicator_report_blocks_authenticated" on public.indicator_report_blocks for all to authenticated using (true) with check (true);
create policy "indicator_insights_authenticated" on public.indicator_insights for all to authenticated using (true) with check (true);
create policy "indicator_actions_authenticated" on public.indicator_actions for all to authenticated using (true) with check (true);
