-- FLOW V6.15 — Regra de horário comercial pra ativação de standby.
-- Execute no SQL Editor do Supabase depois do SUPABASE_V6_14_STANDBY.sql.
--
-- Problema: se o gestor ativa uma demanda em standby à noite (depois das
-- 18h) ou num fim de semana, o prazo (ex: 17h) já passou e ela nasce
-- "vencida" na hora — o mesmo problema que o standby foi criado pra evitar.
--
-- Regra nova: activate_task() calcula a "data efetiva" em vez de sempre usar
-- hoje. Se ativar antes das 18h num dia útil, vale hoje mesmo. Se ativar
-- depois das 18h, ou em qualquer horário de sábado/domingo, só passa a
-- valer no próximo dia útil (sexta depois das 18h ou fim de semana → cai só
-- na segunda-feira).

create or replace function public._flow_next_effective_date(p_now timestamp)
returns date
language plpgsql
immutable
as $$
declare
  v_date date := p_now::date;
  v_dow int := extract(dow from v_date); -- 0 = domingo ... 6 = sábado
  v_hour int := extract(hour from p_now);
  v_next_dow int;
begin
  if v_dow = 0 or v_dow = 6 then
    -- fim de semana: sempre cai na próxima segunda-feira
    return v_date + ((8 - v_dow) % 7);
  end if;

  if v_hour >= 18 then
    v_date := v_date + 1;
    v_next_dow := extract(dow from v_date);
    if v_next_dow = 6 then
      v_date := v_date + 2; -- sábado -> segunda
    elsif v_next_dow = 0 then
      v_date := v_date + 1; -- domingo -> segunda
    end if;
    return v_date;
  end if;

  return v_date;
end;
$$;

create or replace function public.activate_task(p_task_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_task record;
  v_now timestamp := (now() at time zone 'America/Sao_Paulo');
  v_effective_date date;
  v_time text;
begin
  if not public.is_flow_admin() then
    raise exception 'Acesso negado';
  end if;

  select * into v_task from public.tasks where id = p_task_id;
  if v_task.id is null then
    raise exception 'Tarefa não encontrada';
  end if;

  v_effective_date := public._flow_next_effective_date(v_now);
  v_time := coalesce(v_task.recurring_deadline, to_char(v_task.deadline, 'HH24:MI'), '17:00');

  update public.tasks
  set
    is_standby = false,
    date = v_effective_date,
    deadline = (v_effective_date::text || ' ' || v_time)::timestamp,
    status = 'pending'
  where id = p_task_id;
end;
$$;
