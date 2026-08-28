-- FLOW V6.11 — Modos de checagem do checklist (turno duplo, mensal, contínuo)
-- Execute no SQL Editor do Supabase depois do SUPABASE_V6_10_CHECKLIST_TURNOS.sql.
--
-- Generaliza o item de checklist pra 4 modos:
--   simple   -> uma marcação só (comportamento de sempre)
--   shift    -> manhã e/ou tarde, cada uma com seu próprio horário limite
--               (substitui o requires_shift_check da V6.10, que sempre exigia as duas)
--   monthly  -> aparece todo dia (esmaecido/travado), só fica marcável no dia do
--               mês definido pelo admin
--   interval -> "contínuo": precisa ser marcado de novo a cada N horas dentro
--               de uma janela do expediente

alter table public.checklist_items
  add column if not exists check_mode text not null default 'simple'
    check (check_mode in ('simple', 'shift', 'monthly', 'interval')),
  add column if not exists requires_morning_check boolean not null default false,
  add column if not exists requires_afternoon_check boolean not null default false,
  add column if not exists afternoon_cutoff time,
  add column if not exists monthly_day integer check (monthly_day between 1 and 31),
  add column if not exists interval_hours integer,
  add column if not exists interval_window_start time not null default '08:00',
  add column if not exists interval_window_end time not null default '18:00',
  add column if not exists interval_completions jsonb not null default '[]'::jsonb;

-- Migra os itens já criados no modelo V6.10 (requires_shift_check = sempre
-- manhã + tarde) pro novo modelo, sem perder nada.
update public.checklist_items
set
  check_mode = 'shift',
  requires_morning_check = true,
  requires_afternoon_check = true
where requires_shift_check = true
  and check_mode = 'simple';

-- A geração diária das demandas fixas precisa copiar a configuração de cada
-- modo (mas nunca marcações já feitas — cada dia começa zerado).
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
      monthly_day,
      interval_hours, interval_window_start, interval_window_end
    )
    select
      v_new_task_id, text, false, check_mode,
      requires_morning_check, morning_cutoff,
      requires_afternoon_check, afternoon_cutoff,
      monthly_day,
      interval_hours, interval_window_start, interval_window_end
    from public.checklist_items
    where task_id = v_template.id;
  end loop;
end;
$$;
