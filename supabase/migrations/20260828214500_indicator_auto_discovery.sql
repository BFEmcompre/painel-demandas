-- FLOW Indicator Studio - metricas descobertas automaticamente nos prints
-- Esta migration remove a dependencia de cadastro manual de metricas pelo ADM.

alter table public.indicator_definitions
  add column if not exists metric_key text,
  add column if not exists source_section text,
  add column if not exists auto_discovered boolean not null default false;

alter table public.indicator_definitions
  alter column direction set default 'neutral';

alter table public.indicator_definitions
  drop constraint if exists indicator_definitions_direction_check;

alter table public.indicator_definitions
  add constraint indicator_definitions_direction_check
  check (direction in ('higher','lower','target','neutral'));

create unique index if not exists indicator_definitions_platform_metric_key_unique
  on public.indicator_definitions(platform_id, metric_key)
  where metric_key is not null;

create index if not exists indicator_definitions_auto_discovered_idx
  on public.indicator_definitions(platform_id, auto_discovered, display_order);

-- Registros antigos continuam validos, mas novas metricas descobertas por imagem
-- serao criadas com auto_discovered=true e direction='neutral' quando nao houver
-- semantica confiavel de melhora/piora.
