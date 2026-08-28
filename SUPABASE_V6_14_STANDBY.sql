-- FLOW V6.14 — Demandas em "standby" (não contam atraso até o gestor ativar)
-- Execute no SQL Editor do Supabase depois do SUPABASE_V6_13_CHECKLIST_QUINZENAL.sql.
--
-- Resolve de vez o problema de criar demanda fora do horário: a demanda
-- nasce "em standby" (invisível pro responsável, não gera atraso, não entra
-- na geração diária se for fixa). Só quando o gestor clica em "Ativar" é que
-- ela vira uma tarefa de verdade — com data/prazo recalculados a partir do
-- momento da ativação, não da criação.

alter table public.tasks
  add column if not exists is_standby boolean not null default false;

create index if not exists tasks_standby_idx on public.tasks (is_standby) where is_standby = true;

-- Ativa uma demanda: sai do standby e o prazo passa a valer a partir de agora.
create or replace function public.activate_task(p_task_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_task record;
  v_today text := to_char((now() at time zone 'America/Sao_Paulo')::date, 'YYYY-MM-DD');
  v_time text;
begin
  if not public.is_flow_admin() then
    raise exception 'Acesso negado';
  end if;

  select * into v_task from public.tasks where id = p_task_id;
  if v_task.id is null then
    raise exception 'Tarefa não encontrada';
  end if;

  v_time := coalesce(v_task.recurring_deadline, to_char(v_task.deadline, 'HH24:MI'), '17:00');

  update public.tasks
  set
    is_standby = false,
    date = v_today,
    deadline = (v_today || ' ' || v_time)::timestamp,
    status = 'pending'
  where id = p_task_id;
end;
$$;

revoke all on function public.activate_task(uuid) from public, anon;
grant execute on function public.activate_task(uuid) to authenticated;

-- A geração diária de demandas fixas ignora templates em standby.
create or replace function public.generate_recurring_task_occurrences()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_today text := to_char((now() at time zone 'America/Sao_Paulo')::date, 'YYYY-MM-DD');
  v_today_date date := (now() at time zone 'America/Sao_Paulo')::date;
  v_template record;
  v_last_date date;
  v_next_date date;
  v_new_task_id uuid;
  v_deadline_time text;
  v_item record;
  v_new_period_key text;
  v_already_done boolean;
begin
  for v_template in
    select *
    from public.tasks
    where is_recurring = true
      and is_standby = false
      and date::text <= v_today
  loop
    if exists (
      select 1 from public.tasks
      where recurring_parent_id = v_template.id and date::text = v_today
    ) then
      continue;
    end if;

    select max(date::text)::date into v_last_date
    from public.tasks
    where recurring_parent_id = v_template.id;

    if v_last_date is null then
      v_last_date := v_template.date::text::date;
    end if;

    v_next_date := v_last_date + greatest(1, coalesce(v_template.recurring_interval_days, 1));

    if v_next_date > v_today_date then
      continue;
    end if;

    v_deadline_time := coalesce(v_template.recurring_deadline, '17:00');

    insert into public.tasks(
      title, description, responsible_id, responsible_name, date, deadline, status,
      is_recurring, recurring_deadline, recurring_parent_id, recurring_interval_days,
      priority, requires_photo
    ) values (
      v_template.title, v_template.description, v_template.responsible_id, v_template.responsible_name,
      v_today, (v_today || ' ' || v_deadline_time)::timestamp, 'pending',
      false, v_template.recurring_deadline, v_template.id, v_template.recurring_interval_days,
      v_template.priority, v_template.requires_photo
    )
    returning id into v_new_task_id;

    insert into public.task_responsibles(task_id, responsible_id, responsible_name)
    select v_new_task_id, responsible_id, responsible_name
    from public.task_responsibles
    where task_id = v_template.id;

    for v_item in
      select * from public.checklist_items where task_id = v_template.id
    loop
      if v_item.check_mode in ('weekly', 'biweekly') then
        v_new_period_key := public._flow_period_key(v_item.check_mode, v_today_date);

        select exists(
          select 1
          from public.checklist_items ci
          join public.tasks t on t.id = ci.task_id
          where (t.id = v_template.id or t.recurring_parent_id = v_template.id)
            and ci.text = v_item.text
            and ci.check_mode = v_item.check_mode
            and ci.period_key = v_new_period_key
            and ci.completed = true
        ) into v_already_done;

        insert into public.checklist_items(
          task_id, text, completed, check_mode, period_key
        ) values (
          v_new_task_id, v_item.text, coalesce(v_already_done, false), v_item.check_mode, v_new_period_key
        );
      else
        insert into public.checklist_items(
          task_id, text, completed, check_mode,
          requires_morning_check, morning_cutoff,
          requires_afternoon_check, afternoon_cutoff,
          monthly_day,
          interval_hours, interval_window_start, interval_window_end
        ) values (
          v_new_task_id, v_item.text, false, v_item.check_mode,
          v_item.requires_morning_check, v_item.morning_cutoff,
          v_item.requires_afternoon_check, v_item.afternoon_cutoff,
          v_item.monthly_day,
          v_item.interval_hours, v_item.interval_window_start, v_item.interval_window_end
        );
      end if;
    end loop;
  end loop;
end;
$$;

-- Os avisos de prazo (30/15 min, vencida) ignoram tarefas em standby.
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
    where t.status <> 'completed' and t.completed_at is null and t.is_standby = false
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
