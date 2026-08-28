-- FLOW Indicator Studio - envio explicito da apresentacao
-- Upload, extracao e confirmacao nao contam como envio.

alter table public.indicator_submissions
  add column if not exists sent_at timestamptz;

alter table public.indicator_submissions
  drop constraint if exists indicator_submissions_status_check;

alter table public.indicator_submissions
  add constraint indicator_submissions_status_check
  check (status in ('draft','uploaded','extracting','extracted','confirmed','sent','error'));

-- Atraso passa a considerar somente o momento em que o usuario clicou em Enviar.
create or replace function public.flow_set_indicator_submission_late()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deadline time;
  v_local_time time;
begin
  if new.sent_at is null then
    new.is_late := false;
    return new;
  end if;

  select upload_deadline::time into v_deadline
  from public.platforms
  where id = new.platform_id;

  if v_deadline is null then
    new.is_late := false;
    return new;
  end if;

  v_local_time := (new.sent_at at time zone 'America/Sao_Paulo')::time;
  new.is_late := v_local_time > v_deadline;
  return new;
end;
$$;

drop trigger if exists indicator_submission_set_late on public.indicator_submissions;
create trigger indicator_submission_set_late
before insert or update of sent_at, platform_id
on public.indicator_submissions
for each row execute function public.flow_set_indicator_submission_late();

create index if not exists indicator_submissions_sent_idx
  on public.indicator_submissions(reference_date desc, status, sent_at desc);
