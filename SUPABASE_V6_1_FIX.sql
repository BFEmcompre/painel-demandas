-- FLOW V6.1 - cor do texto no mural e compatibilidade das cores de papel.
-- No projeto Demandasdiarias estas alteracoes ja foram aplicadas.

alter table public.flow_announcements
  drop constraint if exists flow_announcements_paper_color_check;

alter table public.flow_announcements
  add constraint flow_announcements_paper_color_check
  check (paper_color in (
    'ice','sky','mint','peach','lemon','lilac','rose','sand','blue','cobalt','midnight'
  ));

alter table public.flow_announcements
  add column if not exists text_color text not null default '#16324b';

alter table public.flow_announcements
  drop constraint if exists flow_announcements_text_color_check;

alter table public.flow_announcements
  add constraint flow_announcements_text_color_check
  check (text_color ~ '^#[0-9A-Fa-f]{6}$');
