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
-- FLOW V6 - Marketplace, fotos de perfil e notificacoes internas
-- Execute depois de 20260820_rewards_system.sql.

alter table public.profiles
  add column if not exists avatar_url text;

alter table public.reward_redemptions
  add column if not exists quantity integer not null default 1,
  add column if not exists cart_group_id uuid;

create index if not exists reward_redemptions_cart_group_idx
  on public.reward_redemptions(cart_group_id, created_at desc);

create table if not exists public.flow_notifications (
  id uuid primary key default gen_random_uuid(),
  target_user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null default 'info',
  title text not null,
  message text not null,
  metadata jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists flow_notifications_target_idx
  on public.flow_notifications(target_user_id, read_at, created_at desc);

alter table public.flow_notifications enable row level security;

grant select, update on public.flow_notifications to authenticated;


drop policy if exists "flow_notifications_owner_select" on public.flow_notifications;
create policy "flow_notifications_owner_select"
  on public.flow_notifications
  for select
  to authenticated
  using (target_user_id = auth.uid());

drop policy if exists "flow_notifications_owner_update" on public.flow_notifications;
create policy "flow_notifications_owner_update"
  on public.flow_notifications
  for update
  to authenticated
  using (target_user_id = auth.uid())
  with check (target_user_id = auth.uid());

create or replace function public.is_flow_admin()
returns boolean
language sql
stable
security invoker
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and lower(coalesce(role, '')) in ('admin', 'manager', 'gestor')
  );
$$;

-- Fotos de perfil.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'flow-avatars',
  'flow-avatars',
  true,
  5242880,
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "flow avatars owner select" on storage.objects;
create policy "flow avatars owner select"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'flow-avatars'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "flow avatars owner insert" on storage.objects;
create policy "flow avatars owner insert"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'flow-avatars'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "flow avatars owner update" on storage.objects;
create policy "flow avatars owner update"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'flow-avatars'
  and (storage.foldername(name))[1] = (select auth.uid())::text
)
with check (
  bucket_id = 'flow-avatars'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "flow avatars owner delete" on storage.objects;
create policy "flow avatars owner delete"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'flow-avatars'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

-- Imagens dos produtos da loja.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'flow-shop',
  'flow-shop',
  true,
  8388608,
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "flow shop admin insert" on storage.objects;
create policy "flow shop admin insert"
on storage.objects
for insert
to authenticated
with check (bucket_id = 'flow-shop' and public.is_flow_admin());

drop policy if exists "flow shop admin update" on storage.objects;
create policy "flow shop admin update"
on storage.objects
for update
to authenticated
using (bucket_id = 'flow-shop' and public.is_flow_admin())
with check (bucket_id = 'flow-shop' and public.is_flow_admin());

drop policy if exists "flow shop admin delete" on storage.objects;
create policy "flow shop admin delete"
on storage.objects
for delete
to authenticated
using (bucket_id = 'flow-shop' and public.is_flow_admin());

-- Um usuario envia o carrinho inteiro para aprovacao.
create or replace function public.request_reward_cart(p_items jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_group_id uuid := gen_random_uuid();
  v_item jsonb;
  v_item_id uuid;
  v_qty integer;
  v_product public.reward_catalog_items%rowtype;
  v_total integer := 0;
  v_wallet public.user_point_wallets%rowtype;
  v_user_name text;
  v_seen uuid[] := array[]::uuid[];
begin
  if v_user_id is null then
    raise exception 'Usuário não autenticado';
  end if;

  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'Carrinho vazio';
  end if;

  select name into v_user_name
  from public.profiles
  where id = v_user_id;

  -- Valida os itens e calcula o total travando os produtos.
  for v_item in select value from jsonb_array_elements(p_items)
  loop
    v_item_id := (v_item->>'item_id')::uuid;
    v_qty := greatest(1, coalesce((v_item->>'quantity')::integer, 1));

    if v_item_id = any(v_seen) then
      raise exception 'Item duplicado no carrinho';
    end if;
    v_seen := array_append(v_seen, v_item_id);

    select * into v_product
    from public.reward_catalog_items
    where id = v_item_id
    for update;

    if v_product.id is null or v_product.is_active is false then
      raise exception 'Um dos itens nao esta disponivel';
    end if;

    if v_product.stock is not null and v_product.stock < v_qty then
      raise exception 'Estoque insuficiente para %', v_product.name;
    end if;

    v_total := v_total + (v_product.points_cost * v_qty);
  end loop;

  insert into public.user_point_wallets(user_id)
  values (v_user_id)
  on conflict (user_id) do nothing;

  select * into v_wallet
  from public.user_point_wallets
  where user_id = v_user_id
  for update;

  if coalesce(v_wallet.available_points, 0) < v_total then
    raise exception 'Saldo de pontos insuficiente';
  end if;

  update public.user_point_wallets
  set
    available_points = available_points - v_total,
    redeemed_points = redeemed_points + v_total,
    updated_at = now()
  where user_id = v_user_id;

  insert into public.points_ledger(
    user_id,
    amount,
    category,
    reason,
    metadata
  ) values (
    v_user_id,
    -v_total,
    'shop_redemption',
    'Solicitacao de troca na loja',
    jsonb_build_object('cart_group_id', v_group_id, 'items', p_items)
  );

  -- Gera as linhas do pedido e baixa o estoque.
  for v_item in select value from jsonb_array_elements(p_items)
  loop
    v_item_id := (v_item->>'item_id')::uuid;
    v_qty := greatest(1, coalesce((v_item->>'quantity')::integer, 1));

    select * into v_product
    from public.reward_catalog_items
    where id = v_item_id;

    insert into public.reward_redemptions(
      user_id,
      item_id,
      quantity,
      points_spent,
      item_snapshot_name,
      status,
      cart_group_id
    ) values (
      v_user_id,
      v_item_id,
      v_qty,
      v_product.points_cost * v_qty,
      v_product.name,
      'pending',
      v_group_id
    );

    if v_product.stock is not null then
      update public.reward_catalog_items
      set stock = stock - v_qty, updated_at = now()
      where id = v_item_id;
    end if;
  end loop;

  insert into public.flow_notifications(target_user_id, type, title, message, metadata)
  select
    p.id,
    'reward_request',
    coalesce(v_user_name, 'Usuário') || ' - Realizou uma troca de pontos',
    coalesce(v_user_name, 'Usuário') || ' enviou um pedido de ' || v_total || ' pontos para aprovacao.',
    jsonb_build_object('cart_group_id', v_group_id, 'user_id', v_user_id, 'total_points', v_total)
  from public.profiles p
  where lower(coalesce(p.role, '')) in ('admin', 'manager', 'gestor');

  return v_group_id;
end;
$$;

revoke all on function public.request_reward_cart(jsonb) from public, anon;
grant execute on function public.request_reward_cart(jsonb) to authenticated;

create or replace function public.approve_reward_cart(p_cart_group_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_redemption record;
begin
  if not public.is_flow_admin() then
    raise exception 'Acesso negado';
  end if;

  for v_redemption in
    select *
    from public.reward_redemptions
    where cart_group_id = p_cart_group_id
      and status = 'pending'
    for update
  loop
    update public.reward_redemptions
    set status = 'approved', updated_at = now()
    where id = v_redemption.id;

    insert into public.flow_notifications(target_user_id, type, title, message, metadata)
    values (
      v_redemption.user_id,
      'reward_approved',
      'Troca aprovada',
      'Você já pode retirar seu ' || coalesce(v_redemption.item_snapshot_name, 'item') || '.',
      jsonb_build_object('redemption_id', v_redemption.id, 'cart_group_id', p_cart_group_id)
    );
  end loop;
end;
$$;

revoke all on function public.approve_reward_cart(uuid) from public, anon;
grant execute on function public.approve_reward_cart(uuid) to authenticated;

create or replace function public.cancel_reward_cart(p_cart_group_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_redemption record;
  v_total integer := 0;
  v_user_id uuid;
begin
  if not public.is_flow_admin() then
    raise exception 'Acesso negado';
  end if;

  for v_redemption in
    select *
    from public.reward_redemptions
    where cart_group_id = p_cart_group_id
      and status <> 'cancelled'
    for update
  loop
    v_user_id := v_redemption.user_id;
    v_total := v_total + v_redemption.points_spent;

    update public.reward_redemptions
    set status = 'cancelled', updated_at = now()
    where id = v_redemption.id;

    update public.reward_catalog_items
    set
      stock = case when stock is null then null else stock + v_redemption.quantity end,
      updated_at = now()
    where id = v_redemption.item_id;
  end loop;

  if v_user_id is not null and v_total > 0 then
    update public.user_point_wallets
    set
      available_points = available_points + v_total,
      redeemed_points = greatest(0, redeemed_points - v_total),
      updated_at = now()
    where user_id = v_user_id;

    insert into public.points_ledger(user_id, amount, category, reason, metadata)
    values (
      v_user_id,
      v_total,
      'refund',
      'Estorno de troca cancelada',
      jsonb_build_object('cart_group_id', p_cart_group_id)
    );

    insert into public.flow_notifications(target_user_id, type, title, message, metadata)
    values (
      v_user_id,
      'reward_cancelled',
      'Troca cancelada',
      'Os pontos deste pedido foram devolvidos ao seu saldo.',
      jsonb_build_object('cart_group_id', p_cart_group_id, 'refunded_points', v_total)
    );
  end if;
end;
$$;

revoke all on function public.cancel_reward_cart(uuid) from public, anon;
grant execute on function public.cancel_reward_cart(uuid) to authenticated;

create or replace function public.deliver_reward_cart(p_cart_group_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_flow_admin() then
    raise exception 'Acesso negado';
  end if;

  update public.reward_redemptions
  set status = 'delivered', updated_at = now()
  where cart_group_id = p_cart_group_id
    and status = 'approved';
end;
$$;

revoke all on function public.deliver_reward_cart(uuid) from public, anon;
grant execute on function public.deliver_reward_cart(uuid) to authenticated;

-- Tenta incluir as notificacoes no realtime quando a publicacao nao for global.
do $$
begin
  if exists (
    select 1 from pg_publication where pubname = 'supabase_realtime' and puballtables = false
  ) and not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'flow_notifications'
  ) then
    execute 'alter publication supabase_realtime add table public.flow_notifications';
  end if;
end $$;

do $$
declare
  table_name text;
begin
  if exists (
    select 1 from pg_publication where pubname = 'supabase_realtime' and puballtables = false
  ) then
    foreach table_name in array array['reward_redemptions', 'reward_catalog_items']
    loop
      if not exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'public'
          and tablename = table_name
      ) then
        execute format('alter publication supabase_realtime add table public.%I', table_name);
      end if;
    end loop;
  end if;
end $$;
