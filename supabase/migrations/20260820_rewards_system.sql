-- Sistema de pontos, penalidades e lojinha do Flow

create table if not exists public.reward_settings (
  id uuid primary key default gen_random_uuid(),
  is_active boolean not null default true,
  base_completion_points integer not null default 10,
  on_time_bonus_points integer not null default 5,
  early_bonus_points integer not null default 8,
  early_cutoff time not null default '12:00:00',
  late_penalty_points integer not null default 4,
  p1_multiplier numeric(6,2) not null default 1.70,
  p2_multiplier numeric(6,2) not null default 1.45,
  p3_multiplier numeric(6,2) not null default 1.20,
  p4_multiplier numeric(6,2) not null default 1.00,
  p5_multiplier numeric(6,2) not null default 0.85,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.reward_settings (is_active)
select true
where not exists (select 1 from public.reward_settings);

create table if not exists public.user_point_wallets (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  available_points integer not null default 0,
  lifetime_points integer not null default 0,
  redeemed_points integer not null default 0,
  lost_points integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.reward_catalog_items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  image_url text,
  points_cost integer not null default 0,
  stock integer,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.reward_redemptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  item_id uuid not null references public.reward_catalog_items(id) on delete restrict,
  points_spent integer not null default 0,
  item_snapshot_name text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'delivered', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.points_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  task_id uuid references public.tasks(id) on delete set null,
  reward_redemption_id uuid references public.reward_redemptions(id) on delete set null,
  amount integer not null,
  category text not null default 'manual_adjustment',
  reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create unique index if not exists points_ledger_task_completion_unique
  on public.points_ledger(user_id, task_id, category)
  where task_id is not null and category in ('task_completion', 'task_penalty');

create index if not exists points_ledger_user_created_at_idx
  on public.points_ledger(user_id, created_at desc);

create index if not exists reward_redemptions_user_idx
  on public.reward_redemptions(user_id, created_at desc);

alter table public.reward_settings enable row level security;
alter table public.user_point_wallets enable row level security;
alter table public.reward_catalog_items enable row level security;
alter table public.reward_redemptions enable row level security;
alter table public.points_ledger enable row level security;

-- Explicit Data API grants (new Supabase projects may not auto-expose SQL-created tables).
grant select, update on public.reward_settings to authenticated;
grant select, insert, update on public.user_point_wallets to authenticated;
grant select, insert, update, delete on public.reward_catalog_items to authenticated;
grant select, insert, update on public.reward_redemptions to authenticated;
grant select, insert on public.points_ledger to authenticated;

create or replace function public.is_flow_admin()
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and lower(coalesce(role, '')) in ('admin', 'manager', 'gestor')
  );
$$;

-- reward_settings
drop policy if exists "reward_settings_select_authenticated" on public.reward_settings;
create policy "reward_settings_select_authenticated"
  on public.reward_settings
  for select
  to authenticated
  using (true);

drop policy if exists "reward_settings_manage_admin" on public.reward_settings;
create policy "reward_settings_manage_admin"
  on public.reward_settings
  for all
  to authenticated
  using (public.is_flow_admin())
  with check (public.is_flow_admin());

-- wallets
drop policy if exists "wallet_select_authenticated" on public.user_point_wallets;
create policy "wallet_select_authenticated"
  on public.user_point_wallets
  for select
  to authenticated
  using (true);

drop policy if exists "wallet_insert_owner_or_admin" on public.user_point_wallets;
create policy "wallet_insert_owner_or_admin"
  on public.user_point_wallets
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id or public.is_flow_admin());

drop policy if exists "wallet_update_owner_or_admin" on public.user_point_wallets;
create policy "wallet_update_owner_or_admin"
  on public.user_point_wallets
  for update
  to authenticated
  using ((select auth.uid()) = user_id or public.is_flow_admin())
  with check ((select auth.uid()) = user_id or public.is_flow_admin());

-- catalog
drop policy if exists "catalog_select_authenticated" on public.reward_catalog_items;
create policy "catalog_select_authenticated"
  on public.reward_catalog_items
  for select
  to authenticated
  using (true);

drop policy if exists "catalog_manage_admin" on public.reward_catalog_items;
create policy "catalog_manage_admin"
  on public.reward_catalog_items
  for all
  to authenticated
  using (public.is_flow_admin())
  with check (public.is_flow_admin());

-- redemptions
drop policy if exists "redemptions_select_owner_or_admin" on public.reward_redemptions;
create policy "redemptions_select_owner_or_admin"
  on public.reward_redemptions
  for select
  to authenticated
  using ((select auth.uid()) = user_id or public.is_flow_admin());

drop policy if exists "redemptions_insert_owner" on public.reward_redemptions;
create policy "redemptions_insert_owner"
  on public.reward_redemptions
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id or public.is_flow_admin());

drop policy if exists "redemptions_update_admin" on public.reward_redemptions;
create policy "redemptions_update_admin"
  on public.reward_redemptions
  for update
  to authenticated
  using (public.is_flow_admin())
  with check (public.is_flow_admin());

-- ledger
drop policy if exists "ledger_select_owner_or_admin" on public.points_ledger;
create policy "ledger_select_owner_or_admin"
  on public.points_ledger
  for select
  to authenticated
  using ((select auth.uid()) = user_id or public.is_flow_admin());

drop policy if exists "ledger_insert_authenticated" on public.points_ledger;
create policy "ledger_insert_authenticated"
  on public.points_ledger
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id or public.is_flow_admin());

drop policy if exists "ledger_update_admin" on public.points_ledger;
create policy "ledger_update_admin"
  on public.points_ledger
  for update
  to authenticated
  using (public.is_flow_admin())
  with check (public.is_flow_admin());
