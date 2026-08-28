-- FLOW V4 LIGHT - amplia cores do mural e mantém compatibilidade.

alter table public.flow_announcements
  add column if not exists paper_color text not null default 'ice';

do $$
begin
  if exists (
    select 1 from pg_constraint
    where conname = 'flow_announcements_paper_color_check'
      and conrelid = 'public.flow_announcements'::regclass
  ) then
    alter table public.flow_announcements
      drop constraint flow_announcements_paper_color_check;
  end if;

  alter table public.flow_announcements
    add constraint flow_announcements_paper_color_check
    check (paper_color in ('ice', 'sky', 'mint', 'peach', 'lemon', 'lilac', 'rose', 'sand', 'blue', 'cobalt', 'midnight'));
end $$;
