-- FLOW V6.12 — Modo "semanal" no checklist (faltou na V6.11)
-- Execute no SQL Editor do Supabase depois do SUPABASE_V6_11_CHECKLIST_MODOS.sql.
--
-- Mesmo esquema do "mensal": o item aparece todo dia na tarefa (esmaecido),
-- e só fica marcável no dia da semana escolhido pelo admin.

alter table public.checklist_items
  drop constraint if exists checklist_items_check_mode_check;

alter table public.checklist_items
  add constraint checklist_items_check_mode_check
    check (check_mode in ('simple', 'shift', 'monthly', 'weekly', 'interval'));

alter table public.checklist_items
  add column if not exists weekly_day integer check (weekly_day between 0 and 6);
-- weekly_day: 0 = domingo, 1 = segunda, ..., 6 = sábado (igual Date.getDay() do JS)

create or replace function public.generate_recurring_task_occurrences()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_today text := to_char((now() at time zone 'America/Sao_Paulo')::date, 'YYYY-MM-DD');
  v_template record;
  v_last_date date;
  v_next_date date;
  v_new_task_id uuid;
  v_deadline_time text;
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

    if v_next_date > v_today::date then
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

    insert into public.checklist_items(
      task_id, text, completed, check_mode,
      requires_morning_check, morning_cutoff,
      requires_afternoon_check, afternoon_cutoff,
      monthly_day, weekly_day,
      interval_hours, interval_window_start, interval_window_end
    )
    select
      v_new_task_id, text, false, check_mode,
      requires_morning_check, morning_cutoff,
      requires_afternoon_check, afternoon_cutoff,
      monthly_day, weekly_day,
      interval_hours, interval_window_start, interval_window_end
    from public.checklist_items
    where task_id = v_template.id;
  end loop;
end;
$$;
