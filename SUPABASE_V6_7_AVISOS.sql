-- FLOW V6.7 — Sistema completo de avisos (admin + usuário)
-- Execute no SQL Editor do Supabase depois das migrations anteriores.
--
-- Resumo:
--   A) Eventos instantâneos -> triggers (novo pedido ao gestor, resposta do gestor,
--      nova tarefa atribuída, aviso no mural, tarefa fixa transferida).
--   B) Eventos com prazo/repetição -> uma função RPC única (run_flow_notification_checks)
--      chamada pelo navegador a cada 1 minuto (ver src/app/lib/notifications.ts).
--
-- Tudo cai na tabela public.flow_notifications que já existe e já é consumida pelo
-- sino no header (realtime + badge + painel).

-- ---------------------------------------------------------------------------
-- 0) Permite que o próprio usuário insira avisos para si mesmo (checks "meus").
-- ---------------------------------------------------------------------------
drop policy if exists "flow_notifications_self_insert" on public.flow_notifications;
create policy "flow_notifications_self_insert"
  on public.flow_notifications
  for insert
  to authenticated
  with check (target_user_id = auth.uid());

create index if not exists flow_notifications_dedupe_idx
  on public.flow_notifications ((metadata->>'dedupe_key'), target_user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- 1) Helpers de dedup / envio.
-- ---------------------------------------------------------------------------
create or replace function public._flow_should_notify(p_target uuid, p_key text, p_min_gap interval)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_last timestamptz;
begin
  select created_at into v_last
  from public.flow_notifications
  where target_user_id = p_target
    and metadata->>'dedupe_key' = p_key
  order by created_at desc
  limit 1;

  if v_last is null then
    return true;
  end if;

  return (now() - v_last) >= p_min_gap;
end;
$$;

revoke all on function public._flow_should_notify(uuid, text, interval) from public, anon;
grant execute on function public._flow_should_notify(uuid, text, interval) to authenticated;

create or replace function public._flow_notify(
  p_target uuid,
  p_type text,
  p_title text,
  p_message text,
  p_key text,
  p_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Supera o aviso anterior com a mesma chave (evita acumular lixo no sino
  -- quando um aviso "repete a cada N minutos").
  update public.flow_notifications
  set read_at = now()
  where target_user_id = p_target
    and metadata->>'dedupe_key' = p_key
    and read_at is null;

  insert into public.flow_notifications(target_user_id, type, title, message, metadata)
  values (p_target, p_type, p_title, p_message, coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object('dedupe_key', p_key));
end;
$$;

revoke all on function public._flow_notify(uuid, text, text, text, text, jsonb) from public, anon;
grant execute on function public._flow_notify(uuid, text, text, text, text, jsonb) to authenticated;

create or replace function public._flow_admin_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.profiles where lower(coalesce(role, '')) in ('admin', 'manager', 'gestor');
$$;

revoke all on function public._flow_admin_ids() from public, anon;
grant execute on function public._flow_admin_ids() to authenticated;

-- ---------------------------------------------------------------------------
-- 2) Checagens com prazo (chamadas pelo navegador a cada 1 minuto).
--    "Uma vez só" = intervalo mínimo gigante (nunca repete).
--    "Repete a cada N min" = intervalo mínimo = N minutos.
-- ---------------------------------------------------------------------------
create or replace function public.check_admin_task_alerts()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_local timestamp := (now() at time zone 'America/Sao_Paulo');
  v_task record;
  v_admin record;
  v_resp record;
  v_key text;
  v_remaining interval;
begin
  for v_task in
    select t.id, t.title, t.status, t.deadline::timestamp as deadline_local
    from public.tasks t
    where t.status <> 'completed' and t.completed_at is null
  loop
    v_remaining := v_task.deadline_local - v_local;

    if v_remaining <= interval '0 minutes' then
      if v_task.status <> 'overdue' then
        update public.tasks set status = 'overdue' where id = v_task.id;
      end if;

      v_key := 'task_overdue:' || v_task.id;
      for v_admin in select * from public._flow_admin_ids() as id loop
        if public._flow_should_notify(v_admin.id, v_key, interval '5 minutes') then
          perform public._flow_notify(v_admin.id, 'task_overdue', 'Tarefa vencida', '"' || v_task.title || '" está atrasada.', v_key, jsonb_build_object('task_id', v_task.id));
        end if;
      end loop;
      for v_resp in select responsible_id from public.task_responsibles where task_id = v_task.id loop
        if public._flow_should_notify(v_resp.responsible_id, v_key, interval '5 minutes') then
          perform public._flow_notify(v_resp.responsible_id, 'task_overdue', 'Tarefa vencida', 'Sua tarefa "' || v_task.title || '" está atrasada.', v_key, jsonb_build_object('task_id', v_task.id));
        end if;
      end loop;
    else
      if v_remaining <= interval '15 minutes' then
        v_key := 'task_due_15m:' || v_task.id;
        for v_admin in select * from public._flow_admin_ids() as id loop
          if public._flow_should_notify(v_admin.id, v_key, interval '100 years') then
            perform public._flow_notify(v_admin.id, 'task_due_15m', 'Tarefa perto do prazo', '"' || v_task.title || '" vence em 15 minutos.', v_key, jsonb_build_object('task_id', v_task.id));
          end if;
        end loop;
        for v_resp in select responsible_id from public.task_responsibles where task_id = v_task.id loop
          if public._flow_should_notify(v_resp.responsible_id, v_key, interval '100 years') then
            perform public._flow_notify(v_resp.responsible_id, 'task_due_15m', 'Sua tarefa está perto do prazo', '"' || v_task.title || '" vence em 15 minutos.', v_key, jsonb_build_object('task_id', v_task.id));
          end if;
        end loop;
      elsif v_remaining <= interval '30 minutes' then
        v_key := 'task_due_30m:' || v_task.id;
        for v_admin in select * from public._flow_admin_ids() as id loop
          if public._flow_should_notify(v_admin.id, v_key, interval '100 years') then
            perform public._flow_notify(v_admin.id, 'task_due_30m', 'Tarefa perto do prazo', '"' || v_task.title || '" vence em 30 minutos.', v_key, jsonb_build_object('task_id', v_task.id));
          end if;
        end loop;
        for v_resp in select responsible_id from public.task_responsibles where task_id = v_task.id loop
          if public._flow_should_notify(v_resp.responsible_id, v_key, interval '100 years') then
            perform public._flow_notify(v_resp.responsible_id, 'task_due_30m', 'Sua tarefa está perto do prazo', '"' || v_task.title || '" vence em 30 minutos.', v_key, jsonb_build_object('task_id', v_task.id));
          end if;
        end loop;
      end if;
    end if;
  end loop;
end;
$$;

revoke all on function public.check_admin_task_alerts() from public, anon;
grant execute on function public.check_admin_task_alerts() to authenticated;

create or replace function public.check_admin_indicator_alerts()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_local timestamp := (now() at time zone 'America/Sao_Paulo');
  v_today text := to_char((now() at time zone 'America/Sao_Paulo')::date, 'YYYY-MM-DD');
  v_platform record;
  v_deadline_local timestamp;
  v_remaining interval;
  v_sent boolean;
  v_admin record;
  v_key text;
begin
  for v_platform in
    select p.id, p.name, p.responsible_id, p.upload_deadline
    from public.platforms p
    where p.active is true and p.upload_deadline is not null
  loop
    v_deadline_local := (v_today || ' ' || v_platform.upload_deadline)::timestamp;

    select exists(
      select 1 from public.platform_indicator_images pii
      where pii.platform_id = v_platform.id and pii.reference_date = v_today
    ) into v_sent;

    if v_sent then
      continue;
    end if;

    v_remaining := v_deadline_local - v_local;

    if v_remaining <= interval '0 minutes' then
      v_key := 'indicator_overdue:' || v_platform.id || ':' || v_today;
      for v_admin in select * from public._flow_admin_ids() as id loop
        if public._flow_should_notify(v_admin.id, v_key, interval '100 years') then
          perform public._flow_notify(v_admin.id, 'indicator_overdue', 'Indicador vencido', 'O indicador de "' || v_platform.name || '" não foi enviado no prazo.', v_key, jsonb_build_object('platform_id', v_platform.id));
        end if;
      end loop;
      if v_platform.responsible_id is not null and public._flow_should_notify(v_platform.responsible_id, v_key, interval '100 years') then
        perform public._flow_notify(v_platform.responsible_id, 'indicator_overdue', 'Indicador vencido', 'Você não enviou o indicador de "' || v_platform.name || '" no prazo.', v_key, jsonb_build_object('platform_id', v_platform.id));
      end if;
    elsif v_remaining <= interval '15 minutes' then
      v_key := 'indicator_due_15m:' || v_platform.id || ':' || v_today;
      for v_admin in select * from public._flow_admin_ids() as id loop
        if public._flow_should_notify(v_admin.id, v_key, interval '100 years') then
          perform public._flow_notify(v_admin.id, 'indicator_due_15m', 'Indicador perto do prazo', 'O indicador de "' || v_platform.name || '" vence em 15 minutos.', v_key, jsonb_build_object('platform_id', v_platform.id));
        end if;
      end loop;
      if v_platform.responsible_id is not null and public._flow_should_notify(v_platform.responsible_id, v_key, interval '100 years') then
        perform public._flow_notify(v_platform.responsible_id, 'indicator_due_15m', 'Seu indicador está perto do prazo', 'O indicador de "' || v_platform.name || '" vence em 15 minutos.', v_key, jsonb_build_object('platform_id', v_platform.id));
      end if;
    elsif v_remaining <= interval '30 minutes' then
      v_key := 'indicator_due_30m:' || v_platform.id || ':' || v_today;
      for v_admin in select * from public._flow_admin_ids() as id loop
        if public._flow_should_notify(v_admin.id, v_key, interval '100 years') then
          perform public._flow_notify(v_admin.id, 'indicator_due_30m', 'Indicador perto do prazo', 'O indicador de "' || v_platform.name || '" vence em 30 minutos.', v_key, jsonb_build_object('platform_id', v_platform.id));
        end if;
      end loop;
      if v_platform.responsible_id is not null and public._flow_should_notify(v_platform.responsible_id, v_key, interval '100 years') then
        perform public._flow_notify(v_platform.responsible_id, 'indicator_due_30m', 'Seu indicador está perto do prazo', 'O indicador de "' || v_platform.name || '" vence em 30 minutos.', v_key, jsonb_build_object('platform_id', v_platform.id));
      end if;
    end if;
  end loop;
end;
$$;

revoke all on function public.check_admin_indicator_alerts() from public, anon;
grant execute on function public.check_admin_indicator_alerts() to authenticated;

create or replace function public.check_admin_request_alerts()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_local timestamp := (now() at time zone 'America/Sao_Paulo');
  v_req record;
  v_admin record;
  v_key text;
  v_remaining interval;
begin
  for v_req in
    select mr.id, mr.subject, mr.due_at::timestamp as due_local
    from public.manager_requests mr
    where mr.status in ('open', 'unresolved')
  loop
    v_remaining := v_req.due_local - v_local;

    if v_remaining <= interval '0 minutes' then
      v_key := 'manager_request_overdue:' || v_req.id;
      for v_admin in select * from public._flow_admin_ids() as id loop
        if public._flow_should_notify(v_admin.id, v_key, interval '5 minutes') then
          perform public._flow_notify(v_admin.id, 'manager_request_overdue', 'Demanda vencida', 'A demanda "' || v_req.subject || '" está vencida e sem resposta.', v_key, jsonb_build_object('request_id', v_req.id));
        end if;
      end loop;
    elsif v_remaining <= interval '5 minutes' then
      v_key := 'manager_request_due_5m:' || v_req.id;
      for v_admin in select * from public._flow_admin_ids() as id loop
        if public._flow_should_notify(v_admin.id, v_key, interval '100 years') then
          perform public._flow_notify(v_admin.id, 'manager_request_due_5m', 'Demanda perto do prazo', 'A demanda "' || v_req.subject || '" vence em 5 minutos.', v_key, jsonb_build_object('request_id', v_req.id));
        end if;
      end loop;
    elsif v_remaining <= interval '15 minutes' then
      v_key := 'manager_request_due_15m:' || v_req.id;
      for v_admin in select * from public._flow_admin_ids() as id loop
        if public._flow_should_notify(v_admin.id, v_key, interval '100 years') then
          perform public._flow_notify(v_admin.id, 'manager_request_due_15m', 'Demanda perto do prazo', 'A demanda "' || v_req.subject || '" vence em 15 minutos.', v_key, jsonb_build_object('request_id', v_req.id));
        end if;
      end loop;
    end if;
  end loop;
end;
$$;

revoke all on function public.check_admin_request_alerts() from public, anon;
grant execute on function public.check_admin_request_alerts() to authenticated;

create or replace function public.check_admin_redemption_alerts()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_group record;
  v_admin record;
  v_key text;
begin
  for v_group in
    select cart_group_id, min(created_at) as created_at, sum(points_spent) as total
    from public.reward_redemptions
    where status = 'pending' and cart_group_id is not null
    group by cart_group_id
  loop
    v_key := 'reward_pending:' || v_group.cart_group_id;
    for v_admin in select * from public._flow_admin_ids() as id loop
      if public._flow_should_notify(v_admin.id, v_key, interval '10 minutes') then
        perform public._flow_notify(v_admin.id, 'reward_pending_reminder', 'Troca de pontos pendente', 'Ainda há um pedido de ' || v_group.total || ' pontos aguardando aprovação.', v_key, jsonb_build_object('cart_group_id', v_group.cart_group_id));
      end if;
    end loop;
  end loop;
end;
$$;

revoke all on function public.check_admin_redemption_alerts() from public, anon;
grant execute on function public.check_admin_redemption_alerts() to authenticated;

-- Função guarda-chuva: uma única chamada RPC dispara as 4 checagens.
create or replace function public.run_flow_notification_checks()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.check_admin_task_alerts();
  perform public.check_admin_indicator_alerts();
  perform public.check_admin_request_alerts();
  perform public.check_admin_redemption_alerts();
end;
$$;

revoke all on function public.run_flow_notification_checks() from public, anon;
grant execute on function public.run_flow_notification_checks() to authenticated;

-- ---------------------------------------------------------------------------
-- 3) Eventos instantâneos (triggers).
-- ---------------------------------------------------------------------------

-- Nova demanda enviada por um usuário -> avisa todos os admins.
create or replace function public._trg_manager_request_new()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin record;
begin
  for v_admin in select * from public._flow_admin_ids() as id loop
    perform public._flow_notify(
      v_admin.id,
      'manager_request_new',
      'Nova demanda recebida',
      coalesce(new.requester_name, 'Alguém') || ' enviou: "' || new.subject || '".',
      'manager_request_new:' || new.id,
      jsonb_build_object('request_id', new.id)
    );
  end loop;
  return new;
end;
$$;

drop trigger if exists trg_manager_request_new on public.manager_requests;
create trigger trg_manager_request_new
  after insert on public.manager_requests
  for each row execute function public._trg_manager_request_new();

-- Demanda respondida pelo gestor -> avisa quem pediu.
create or replace function public._trg_manager_request_answered()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'answered' and (old.status is distinct from new.status) then
    perform public._flow_notify(
      new.requester_id,
      'manager_request_answered',
      'Demanda respondida',
      'O gestor respondeu sua demanda "' || new.subject || '".',
      'manager_request_answered:' || new.id || ':' || extract(epoch from now())::text,
      jsonb_build_object('request_id', new.id)
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_manager_request_answered on public.manager_requests;
create trigger trg_manager_request_answered
  after update on public.manager_requests
  for each row execute function public._trg_manager_request_answered();

-- Nova tarefa atribuída -> avisa o responsável.
create or replace function public._trg_task_assigned()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_task_title text;
begin
  select title into v_task_title from public.tasks where id = new.task_id;

  perform public._flow_notify(
    new.responsible_id,
    'task_assigned',
    'Nova demanda recebida',
    'Você recebeu a tarefa "' || coalesce(v_task_title, 'sem título') || '".',
    'task_assigned:' || new.task_id || ':' || new.responsible_id,
    jsonb_build_object('task_id', new.task_id)
  );
  return new;
end;
$$;

drop trigger if exists trg_task_assigned on public.task_responsibles;
create trigger trg_task_assigned
  after insert on public.task_responsibles
  for each row execute function public._trg_task_assigned();

-- Novo aviso publicado no mural -> avisa todo mundo.
create or replace function public._trg_board_announcement()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile record;
begin
  if coalesce(new.is_published, true) is false then
    return new;
  end if;

  for v_profile in select id from public.profiles loop
    perform public._flow_notify(
      v_profile.id,
      'board_announcement',
      'Novo aviso no mural',
      coalesce(new.title, 'Novo aviso'),
      'board_announcement:' || new.id,
      jsonb_build_object('announcement_id', new.id)
    );
  end loop;
  return new;
end;
$$;

drop trigger if exists trg_board_announcement on public.flow_announcements;
create trigger trg_board_announcement
  after insert on public.flow_announcements
  for each row execute function public._trg_board_announcement();

-- Demanda fixa transferida -> avisa o responsável antigo e o novo.
create or replace function public._trg_task_transferred()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.from_responsible_id is not null then
    perform public._flow_notify(
      new.from_responsible_id,
      'task_transferred',
      'Demanda transferida',
      'A tarefa "' || coalesce(new.task_title, 'sem título') || '" foi transferida para ' || coalesce(new.to_responsible_name, 'outro responsável') || '.',
      'task_transferred:' || new.id,
      jsonb_build_object('task_id', new.task_id)
    );
  end if;

  if new.to_responsible_id is not null then
    perform public._flow_notify(
      new.to_responsible_id,
      'task_transferred',
      'Demanda transferida para você',
      'A tarefa "' || coalesce(new.task_title, 'sem título') || '" agora é sua.',
      'task_transferred:' || new.id || ':to',
      jsonb_build_object('task_id', new.task_id)
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_task_transferred on public.recurring_task_transfer_logs;
create trigger trg_task_transferred
  after insert on public.recurring_task_transfer_logs
  for each row execute function public._trg_task_transferred();
