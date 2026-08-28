-- FLOW V6.8 — Backup de responsável (férias / atestado)
-- Execute no SQL Editor do Supabase depois do SUPABASE_V6_7_AVISOS.sql.
--
-- Permite ao admin definir que "fulano assume as tarefas de beltrano" a
-- partir de agora ou de uma data futura, escolhendo exatamente quais tarefas
-- entram na troca. Reaproveita a mesma lógica de troca de responsável já
-- usada na transferência manual de demandas fixas, e a mesma tabela de
-- log/notificação (recurring_task_transfer_logs) que já existe.

create table if not exists public.user_backup_assignments (
  id uuid primary key default gen_random_uuid(),
  from_responsible_id uuid not null references public.profiles(id) on delete cascade,
  from_responsible_name text not null,
  backup_responsible_id uuid not null references public.profiles(id) on delete cascade,
  backup_responsible_name text not null,
  task_ids uuid[] not null default '{}',
  effective_date date,
  status text not null default 'pending' check (status in ('pending', 'executed', 'cancelled')),
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  executed_at timestamptz
);

create index if not exists user_backup_assignments_pending_idx
  on public.user_backup_assignments (status, effective_date);

alter table public.user_backup_assignments enable row level security;

drop policy if exists "backup_assignments_admin_all" on public.user_backup_assignments;
create policy "backup_assignments_admin_all"
  on public.user_backup_assignments
  for all
  to authenticated
  using (public.is_flow_admin())
  with check (public.is_flow_admin());

grant select, insert, update on public.user_backup_assignments to authenticated;

-- ---------------------------------------------------------------------------
-- Troca o responsável de UMA tarefa (equivalente ao replaceResponsibleOnTask
-- do front, em TransferRecurringTasks.tsx).
-- ---------------------------------------------------------------------------
create or replace function public._backup_replace_responsible(
  p_task_id uuid,
  p_old_id uuid,
  p_new_id uuid,
  p_new_name text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_names text;
  v_primary uuid;
begin
  delete from public.task_responsibles
  where task_id = p_task_id and responsible_id = p_old_id;

  insert into public.task_responsibles(task_id, responsible_id, responsible_name)
  select p_task_id, p_new_id, p_new_name
  where not exists (
    select 1 from public.task_responsibles
    where task_id = p_task_id and responsible_id = p_new_id
  );

  select string_agg(distinct responsible_name, ', ') into v_names
  from public.task_responsibles
  where task_id = p_task_id;

  select responsible_id into v_primary from public.tasks where id = p_task_id;
  if v_primary is null or v_primary = p_old_id then
    v_primary := p_new_id;
  end if;

  if not exists (select 1 from public.task_responsibles where task_id = p_task_id and responsible_id = v_primary) then
    select responsible_id into v_primary from public.task_responsibles where task_id = p_task_id limit 1;
    v_primary := coalesce(v_primary, p_new_id);
  end if;

  update public.tasks
  set responsible_id = v_primary, responsible_name = coalesce(v_names, p_new_name)
  where id = p_task_id;
end;
$$;

revoke all on function public._backup_replace_responsible(uuid, uuid, uuid, text) from public, anon;
grant execute on function public._backup_replace_responsible(uuid, uuid, uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Executa um backup pendente: troca as tarefas escolhidas (e cascateia pras
-- ocorrências futuras não concluídas, se a tarefa for fixa/recorrente).
-- ---------------------------------------------------------------------------
create or replace function public.execute_backup_assignment(p_assignment_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_assignment record;
  v_task_id uuid;
  v_child_id uuid;
  v_task_title text;
  v_is_recurring boolean;
  v_today text := to_char((now() at time zone 'America/Sao_Paulo')::date, 'YYYY-MM-DD');
begin
  if not public.is_flow_admin() then
    raise exception 'Acesso negado';
  end if;

  select * into v_assignment
  from public.user_backup_assignments
  where id = p_assignment_id and status = 'pending'
  for update;

  if v_assignment.id is null then
    return;
  end if;

  foreach v_task_id in array v_assignment.task_ids loop
    select title, is_recurring into v_task_title, v_is_recurring
    from public.tasks where id = v_task_id;

    if v_task_title is null then
      continue;
    end if;

    perform public._backup_replace_responsible(
      v_task_id, v_assignment.from_responsible_id, v_assignment.backup_responsible_id, v_assignment.backup_responsible_name
    );

    if v_is_recurring then
      for v_child_id in
        select id from public.tasks
        where recurring_parent_id = v_task_id and date >= v_today and status <> 'completed'
      loop
        perform public._backup_replace_responsible(
          v_child_id, v_assignment.from_responsible_id, v_assignment.backup_responsible_id, v_assignment.backup_responsible_name
        );
      end loop;
    end if;

    insert into public.recurring_task_transfer_logs(
      task_id, task_title, from_responsible_id, from_responsible_name,
      to_responsible_id, to_responsible_name, transferred_by, transferred_at
    ) values (
      v_task_id, v_task_title, v_assignment.from_responsible_id, v_assignment.from_responsible_name,
      v_assignment.backup_responsible_id, v_assignment.backup_responsible_name, v_assignment.created_by, now()
    );
  end loop;

  update public.user_backup_assignments
  set status = 'executed', executed_at = now()
  where id = p_assignment_id;
end;
$$;

revoke all on function public.execute_backup_assignment(uuid) from public, anon;
grant execute on function public.execute_backup_assignment(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Checagem programada: roda dentro do poll de 1 minuto já existente.
-- ---------------------------------------------------------------------------
create or replace function public.check_admin_backup_assignments()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_today date := (now() at time zone 'America/Sao_Paulo')::date;
  v_row record;
begin
  for v_row in
    select id from public.user_backup_assignments
    where status = 'pending' and effective_date is not null and effective_date <= v_today
  loop
    perform public.execute_backup_assignment(v_row.id);
  end loop;
end;
$$;

revoke all on function public.check_admin_backup_assignments() from public, anon;
grant execute on function public.check_admin_backup_assignments() to authenticated;

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
  perform public.check_admin_backup_assignments();
end;
$$;
