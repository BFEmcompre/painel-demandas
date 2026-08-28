-- FLOW V6.10 — Item de checklist com "sub-checagem" por turno (manhã/tarde)
-- Execute no SQL Editor do Supabase depois do SUPABASE_V6_9_RECORRENCIA.sql.
--
-- Alguns itens de checklist precisam ser marcados duas vezes no dia (uma vez
-- de manhã, até um horário definível, e outra à tarde) antes de contarem
-- como concluídos — em vez de uma marcação única. Isso é por item (opcional),
-- não afeta os itens comuns.

alter table public.checklist_items
  add column if not exists requires_shift_check boolean not null default false,
  add column if not exists morning_cutoff time,
  add column if not exists morning_completed_at timestamptz,
  add column if not exists afternoon_completed_at timestamptz;

-- A geração diária das demandas fixas também precisa copiar essa
-- configuração (mas nunca as marcações já feitas — cada dia começa zerado).
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

    insert into public.checklist_items(task_id, text, completed, requires_shift_check, morning_cutoff)
    select v_new_task_id, text, false, requires_shift_check, morning_cutoff
    from public.checklist_items
    where task_id = v_template.id;
  end loop;
end;
$$;
