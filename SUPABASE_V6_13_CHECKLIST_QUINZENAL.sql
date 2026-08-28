-- FLOW V6.13 — Ajusta "semanal", cria "quinzenal", e mantém a marcação ao
-- longo do período (não reseta todo dia como os outros modos).
-- Execute no SQL Editor do Supabase depois do SUPABASE_V6_12_CHECKLIST_SEMANAL.sql.
--
-- Semanal: não tem mais dia fixo. Fica ativo (nunca esmaecido) a semana
--   inteira; uma marcação resolve a semana toda (fica marcado até domingo);
--   se chegar sábado/domingo sem marcar, mostra como vencido.
-- Quinzenal: mês dividido em duas metades (dias 1-15 e 16-fim). Uma
--   marcação resolve a metade corrente.
--
-- Como cada dia de uma demanda fixa gera uma linha NOVA de checklist_items,
-- a "marcação persistente" funciona via period_key: toda vez que o dia é
-- gerado, a função olha pra trás (nas ocorrências anteriores da mesma
-- demanda) se already existe uma marcação pro mesmo period_key, e já traz
-- o item marcado se sim.

alter table public.checklist_items
  drop constraint if exists checklist_items_check_mode_check;

alter table public.checklist_items
  add constraint checklist_items_check_mode_check
    check (check_mode in ('simple', 'shift', 'weekly', 'biweekly', 'monthly', 'interval'));

alter table public.checklist_items
  add column if not exists period_key text;

create or replace function public._flow_period_key(p_mode text, p_date date)
returns text
language sql
immutable
as $$
  select case
    when p_mode = 'weekly' then to_char(p_date, 'IYYY-IW')
    when p_mode = 'biweekly' then to_char(p_date, 'YYYY-MM') || '-H' || (case when extract(day from p_date) <= 15 then '1' else '2' end)
    else null
  end;
$$;

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
