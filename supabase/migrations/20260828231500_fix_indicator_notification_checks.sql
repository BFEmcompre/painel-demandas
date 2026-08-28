-- FLOW - corrige avisos dos indicadores apos o novo Studio
-- 1) evita date = text
-- 2) considera enviado somente indicator_submissions.status='sent' e sent_at preenchido

create or replace function public.check_admin_indicator_alerts()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_local timestamp := (now() at time zone 'America/Sao_Paulo');
  v_today date := (now() at time zone 'America/Sao_Paulo')::date;
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
    v_deadline_local := (v_today::text || ' ' || v_platform.upload_deadline)::timestamp;

    select exists(
      select 1
      from public.indicator_submissions s
      where s.platform_id = v_platform.id
        and s.reference_date = v_today
        and s.status = 'sent'
        and s.sent_at is not null
    ) into v_sent;

    if v_sent then
      continue;
    end if;

    v_remaining := v_deadline_local - v_local;

    if v_remaining <= interval '0 minutes' then
      v_key := 'indicator_overdue:' || v_platform.id || ':' || v_today::text;
      for v_admin in select * from public._flow_admin_ids() as id loop
        if public._flow_should_notify(v_admin.id, v_key, interval '100 years') then
          perform public._flow_notify(
            v_admin.id,
            'indicator_overdue',
            'Indicador vencido',
            'A apresentação de "' || v_platform.name || '" não foi enviada no prazo.',
            v_key,
            jsonb_build_object('platform_id', v_platform.id)
          );
        end if;
      end loop;

      if v_platform.responsible_id is not null
         and public._flow_should_notify(v_platform.responsible_id, v_key, interval '100 years') then
        perform public._flow_notify(
          v_platform.responsible_id,
          'indicator_overdue',
          'Apresentação vencida',
          'Você não enviou a apresentação de "' || v_platform.name || '" no prazo.',
          v_key,
          jsonb_build_object('platform_id', v_platform.id)
        );
      end if;

    elsif v_remaining <= interval '15 minutes' then
      v_key := 'indicator_due_15m:' || v_platform.id || ':' || v_today::text;
      for v_admin in select * from public._flow_admin_ids() as id loop
        if public._flow_should_notify(v_admin.id, v_key, interval '100 years') then
          perform public._flow_notify(
            v_admin.id,
            'indicator_due_15m',
            'Apresentação perto do prazo',
            'A apresentação de "' || v_platform.name || '" vence em 15 minutos.',
            v_key,
            jsonb_build_object('platform_id', v_platform.id)
          );
        end if;
      end loop;

      if v_platform.responsible_id is not null
         and public._flow_should_notify(v_platform.responsible_id, v_key, interval '100 years') then
        perform public._flow_notify(
          v_platform.responsible_id,
          'indicator_due_15m',
          'Sua apresentação está perto do prazo',
          'A apresentação de "' || v_platform.name || '" vence em 15 minutos.',
          v_key,
          jsonb_build_object('platform_id', v_platform.id)
        );
      end if;

    elsif v_remaining <= interval '30 minutes' then
      v_key := 'indicator_due_30m:' || v_platform.id || ':' || v_today::text;
      for v_admin in select * from public._flow_admin_ids() as id loop
        if public._flow_should_notify(v_admin.id, v_key, interval '100 years') then
          perform public._flow_notify(
            v_admin.id,
            'indicator_due_30m',
            'Apresentação perto do prazo',
            'A apresentação de "' || v_platform.name || '" vence em 30 minutos.',
            v_key,
            jsonb_build_object('platform_id', v_platform.id)
          );
        end if;
      end loop;

      if v_platform.responsible_id is not null
         and public._flow_should_notify(v_platform.responsible_id, v_key, interval '100 years') then
        perform public._flow_notify(
          v_platform.responsible_id,
          'indicator_due_30m',
          'Sua apresentação está perto do prazo',
          'A apresentação de "' || v_platform.name || '" vence em 30 minutos.',
          v_key,
          jsonb_build_object('platform_id', v_platform.id)
        );
      end if;
    end if;
  end loop;
end;
$$;

revoke all on function public.check_admin_indicator_alerts() from public, anon;
grant execute on function public.check_admin_indicator_alerts() to authenticated;
