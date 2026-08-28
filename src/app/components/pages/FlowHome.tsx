import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import {
  BellRing,
  CalendarDays,
  CheckCircle2,
  Clock3,
  ImagePlus,
  Megaphone,
  PartyPopper,
  Pin,
  Plus,
  Rocket,
  Save,
  SmilePlus,
  Trophy,
  Upload,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';

import { supabase } from '../../lib/supabase';
import { BoardNote } from './BoardNote';
import { ImageCropDialog } from './ImageCropDialog';
import { Button } from '../ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { Textarea } from '../ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';

type Profile = {
  id: string;
  name: string;
  role: string;
};

type AnnouncementCategory =
  | 'novidade'
  | 'aniversario'
  | 'comunicado'
  | 'conquista'
  | 'evento';

type PaperColor = string;
type NoteSize = 'sm' | 'md' | 'lg';

type FlowAnnouncement = {
  id: string;
  title: string;
  content: string;
  category: AnnouncementCategory;
  emoji: string | null;
  accent: string;
  is_pinned: boolean;
  is_published: boolean;
  starts_at: string | null;
  expires_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  paper_color?: PaperColor | null;
  note_size?: NoteSize | null;
  position_x?: number | null;
  position_y?: number | null;
  rotation?: number | null;
  image_url?: string | null;
  header_icon_url?: string | null;
  z_index?: number | null;
  text_color?: string | null;
};

type BoardSettings = {
  board_color: string;
  background_image_url: string;
};

type HomeStats = {
  pending: number;
  completed: number;
  overdue: number;
  extra: number;
};

type AnnouncementFormState = {
  title: string;
  content: string;
  category: AnnouncementCategory;
  emoji: string;
  paper_color: PaperColor;
  text_color: string;
  note_size: NoteSize;
  rotation: number;
  image_url: string;
  header_icon_url: string;
  starts_at: string;
  expires_at: string;
  is_pinned: boolean;
  is_published: boolean;
};

const categoryConfig: Record<
  AnnouncementCategory,
  { label: string; icon: typeof Rocket; defaultEmoji: string }
> = {
  novidade: { label: 'Novidade', icon: Rocket, defaultEmoji: '🚀' },
  aniversario: { label: 'Aniversário', icon: PartyPopper, defaultEmoji: '🎂' },
  comunicado: { label: 'Comunicado', icon: Megaphone, defaultEmoji: '📣' },
  conquista: { label: 'Conquista', icon: Trophy, defaultEmoji: '🏆' },
  evento: { label: 'Evento', icon: CalendarDays, defaultEmoji: '📅' },
};


const emojiLibrary = [
  '😀','😁','😂','😉','😍','🤩','🥳','😎','🤝','👏','🙌','🔥',
  '✨','⭐','💡','📌','📣','🚀','🎯','📈','✅','📝','📅','⏰',
  '🎂','🎉','🏆','💙','💚','💛','💜','🧡','🌟','💬','📍','📎',
  '🛠️','💻','📚','📦','🧠','🌈','☕','🍕','🎊','🎵','🎁','❤️'
];

const emptyForm: AnnouncementFormState = {
  title: '',
  content: '',
  category: 'novidade',
  emoji: '🚀',
  paper_color: '#fbfaf3',
  text_color: '#16324b',
  note_size: 'md',
  rotation: 0,
  image_url: '',
  header_icon_url: '',
  starts_at: '',
  expires_at: '',
  is_pinned: false,
  is_published: true,
};

const defaultBoardSettings: BoardSettings = {
  board_color: '#17623f',
  background_image_url: '',
};

function toDateTimeLocal(value: string | null) {
  if (!value) return '';
  const date = new Date(value);
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 16);
}

function greetingForNow() {
  const hour = Number(
    new Intl.DateTimeFormat('pt-BR', {
      hour: '2-digit',
      hour12: false,
      timeZone: 'America/Sao_Paulo',
    }).format(new Date()),
  );

  if (hour < 12) return 'Bom dia';
  if (hour < 18) return 'Boa tarde';
  return 'Boa noite';
}

function normalizeHex(value: string, fallback: string) {
  const normalized = String(value || '').trim();
  return /^#[0-9a-fA-F]{6}$/.test(normalized) ? normalized : fallback;
}

function defaultPosition(index: number) {
  const columns = 3;
  const rows = 3;
  // O banco só aceita position_x/position_y entre 0 e 100 — com mais avisos
  // do que cabem na grade (colunas x linhas), volta pro início em vez de
  // estourar o limite. Os avisos ficam empilhados, mas o admin pode
  // arrastar pra reorganizar.
  const cell = index % (columns * rows);
  return {
    x: 4 + (cell % columns) * 31,
    y: 5 + Math.floor(cell / columns) * 31,
  };
}

export function FlowHome() {
  const navigate = useNavigate();
  const boardRef = useRef<HTMLDivElement>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [announcements, setAnnouncements] = useState<FlowAnnouncement[]>([]);
  const [stats, setStats] = useState<HomeStats>({ pending: 0, completed: 0, overdue: 0, extra: 0 });
  const [loading, setLoading] = useState(true);
  const [boardReady, setBoardReady] = useState(false);
  const [advancedBoardReady, setAdvancedBoardReady] = useState(true);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<AnnouncementFormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadingIcon, setUploadingIcon] = useState(false);
  const [boardEditorOpen, setBoardEditorOpen] = useState(false);
  const [boardSettings, setBoardSettings] = useState<BoardSettings>(defaultBoardSettings);
  const [savingBoardSettings, setSavingBoardSettings] = useState(false);
  const [uploadingBoardBackground, setUploadingBoardBackground] = useState(false);
  const [cropFile, setCropFile] = useState<File | null>(null);
  const [cropTarget, setCropTarget] = useState<'announcement' | 'board' | null>(null);

  const isAdmin = ['manager', 'admin', 'gestor'].includes(String(profile?.role).toLowerCase());
  const greeting = greetingForNow();

  useEffect(() => {
    void loadHome();
  }, []);

  useEffect(() => {
    if (!boardReady) return;

    const channel = supabase
      .channel('flow-board-live')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'flow_announcements' },
        () => void loadAnnouncements(),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'flow_board_settings' },
        () => void loadBoardSettings(),
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [boardReady]);

  async function loadHome() {
    setLoading(true);

    const { data: authData } = await supabase.auth.getUser();
    if (!authData.user) {
      navigate('/login');
      return;
    }

    const { data: profileData } = await supabase
      .from('profiles')
      .select('id, name, role')
      .eq('id', authData.user.id)
      .single();

    if (profileData) setProfile(profileData);

    await Promise.all([
      loadAnnouncements(),
      loadBoardSettings(),
      loadStats(authData.user.id, profileData?.role || 'responsible'),
    ]);

    setLoading(false);
  }

  async function loadAnnouncements() {
    const { data, error } = await supabase
      .from('flow_announcements')
      .select('*')
      .order('is_pinned', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) {
      const missingTable = error.code === '42P01' || error.message.toLowerCase().includes('flow_announcements');
      setBoardReady(!missingTable);
      setAnnouncements([]);
      return;
    }

    setBoardReady(true);
    const rows = (data || []) as FlowAnnouncement[];
    const advanced = rows.length === 0 || 'paper_color' in rows[0];
    setAdvancedBoardReady(advanced);
    setAnnouncements(rows);
  }

  async function loadBoardSettings() {
    const { data, error } = await supabase
      .from('flow_board_settings')
      .select('*')
      .limit(1)
      .maybeSingle();

    if (error) {
      const missingTable = error.code === '42P01' || error.message.toLowerCase().includes('flow_board_settings');
      if (!missingTable) {
        console.error('Erro ao carregar quadro:', error);
      }
      setBoardSettings(defaultBoardSettings);
      return;
    }

    if (!data) {
      setBoardSettings(defaultBoardSettings);
      return;
    }

    setBoardSettings({
      board_color: normalizeHex(data.board_color || defaultBoardSettings.board_color, defaultBoardSettings.board_color),
      background_image_url: data.background_image_url || '',
    });
  }

  async function loadStats(userId: string, role: string) {
    const today = new Date().toLocaleDateString('sv-SE', {
      timeZone: 'America/Sao_Paulo',
    });
    const admin = ['manager', 'admin', 'gestor'].includes(String(role).toLowerCase());

    if (admin) {
      const [{ data: tasks }, { data: requests }] = await Promise.all([
        supabase
          .from('tasks')
          .select('id, status, date, is_recurring')
          .eq('date', today)
          .or('is_recurring.eq.false,is_recurring.is.null')
          .or('is_standby.eq.false,is_standby.is.null'),
        supabase
          .from('manager_requests')
          .select('id, status')
          .in('status', ['open', 'unresolved']),
      ]);

      const rows = tasks || [];
      setStats({
        pending: rows.filter((task: any) => task.status === 'pending').length,
        completed: rows.filter((task: any) => task.status === 'completed').length,
        overdue: rows.filter((task: any) => task.status === 'overdue').length,
        extra: requests?.length || 0,
      });
      return;
    }

    const { data: relations } = await supabase
      .from('task_responsibles')
      .select('task_id')
      .eq('responsible_id', userId);

    const taskIds = relations?.map((item) => item.task_id) || [];
    let rows: any[] = [];

    if (taskIds.length > 0) {
      const { data: tasks } = await supabase
        .from('tasks')
        .select('id, status, date, is_recurring')
        .in('id', taskIds)
        .eq('date', today)
        .or('is_recurring.eq.false,is_recurring.is.null')
        .or('is_standby.eq.false,is_standby.is.null');
      rows = tasks || [];
    }

    const { data: answeredRequests } = await supabase
      .from('manager_requests')
      .select('id')
      .eq('requester_id', userId)
      .eq('status', 'answered');

    setStats({
      pending: rows.filter((task) => task.status === 'pending').length,
      completed: rows.filter((task) => task.status === 'completed').length,
      overdue: rows.filter((task) => task.status === 'overdue').length,
      extra: answeredRequests?.length || 0,
    });
  }

  function openCreate() {
    setEditingId(null);
    setForm({
      ...emptyForm,
      rotation: Number((Math.random() * 5 - 2.5).toFixed(1)),
    });
    setEditorOpen(true);
  }

  function openEdit(announcement: FlowAnnouncement) {
    setEditingId(announcement.id);
    setForm({
      title: announcement.title,
      content: announcement.content,
      category: announcement.category,
      emoji: announcement.emoji || categoryConfig[announcement.category].defaultEmoji,
      paper_color: announcement.paper_color || 'ice',
      text_color: announcement.text_color || '#16324b',
      note_size: announcement.note_size || 'md',
      rotation: Number(announcement.rotation || 0),
      image_url: announcement.image_url || '',
      header_icon_url: announcement.header_icon_url || '',
      starts_at: toDateTimeLocal(announcement.starts_at),
      expires_at: toDateTimeLocal(announcement.expires_at),
      is_pinned: announcement.is_pinned,
      is_published: announcement.is_published,
    });
    setEditorOpen(true);
  }

  async function uploadToFlowBoard(file: File) {
    const { data: authData } = await supabase.auth.getUser();
    if (!authData.user) throw new Error('Sua sessão expirou.');

    const extension = file.name.split('.').pop()?.toLowerCase() || 'jpg';
    const path = `${authData.user.id}/${crypto.randomUUID()}.${extension}`;

    const { error } = await supabase.storage
      .from('flow-board')
      .upload(path, file, { cacheControl: '3600', upsert: false });

    if (error) throw error;

    const { data } = supabase.storage.from('flow-board').getPublicUrl(path);
    return data.publicUrl;
  }

  function startImageCrop(file: File, target: 'announcement' | 'board') {
    setCropFile(file);
    setCropTarget(target);
  }

  function closeImageCrop() {
    setCropFile(null);
    setCropTarget(null);
  }

  async function uploadAnnouncementImage(file: File) {
    setUploadingImage(true);
    try {
      const publicUrl = await uploadToFlowBoard(file);
      setForm((current) => ({ ...current, image_url: publicUrl }));
      toast.success('Imagem adicionada ao aviso.');
    } catch (error: any) {
      toast.error(error?.message || 'Não foi possível enviar a imagem.');
    } finally {
      setUploadingImage(false);
    }
  }

  async function uploadHeaderIcon(file: File) {
    setUploadingIcon(true);
    try {
      const publicUrl = await uploadToFlowBoard(file);
      setForm((current) => ({ ...current, header_icon_url: publicUrl }));
      toast.success('Ícone adicionado ao topo do aviso.');
    } catch (error: any) {
      toast.error(error?.message || 'Não foi possível enviar o ícone.');
    } finally {
      setUploadingIcon(false);
    }
  }

  async function uploadBoardBackground(file: File) {
    setUploadingBoardBackground(true);
    try {
      const publicUrl = await uploadToFlowBoard(file);
      setBoardSettings((current) => ({ ...current, background_image_url: publicUrl }));
      toast.success('Imagem de fundo adicionada ao quadro.');
    } catch (error: any) {
      toast.error(error?.message || 'Não foi possível enviar o fundo.');
    } finally {
      setUploadingBoardBackground(false);
    }
  }

  async function saveBoardSettings() {
    setSavingBoardSettings(true);
    const { data: authData } = await supabase.auth.getUser();
    const payload = {
      id: 'main',
      board_color: normalizeHex(boardSettings.board_color, defaultBoardSettings.board_color),
      background_image_url: boardSettings.background_image_url.trim() || null,
      updated_at: new Date().toISOString(),
      updated_by: authData.user?.id || null,
    };

    const { error } = await supabase.from('flow_board_settings').upsert(payload, { onConflict: 'id' });
    setSavingBoardSettings(false);

    if (error) {
      toast.error(error.message || 'Não foi possível salvar o quadro. Rode a migration desta versão.');
      return;
    }

    toast.success('Visual do quadro atualizado.');
    setBoardEditorOpen(false);
    await loadBoardSettings();
  }

  async function saveAnnouncement() {
    if (!form.title.trim() || !form.content.trim()) {
      toast.error('Preencha o título e a mensagem do aviso.');
      return;
    }

    setSaving(true);
    const { data: authData } = await supabase.auth.getUser();
    const fallback = defaultPosition(announcements.length);

    const payload = {
      title: form.title.trim(),
      content: form.content.trim(),
      category: form.category,
      emoji: form.emoji.trim() || categoryConfig[form.category].defaultEmoji,
      accent: 'cyan',
      paper_color: normalizeHex(form.paper_color, emptyForm.paper_color),
      text_color: normalizeHex(form.text_color, emptyForm.text_color),
      note_size: form.note_size,
      rotation: form.rotation,
      image_url: form.image_url.trim() || null,
      header_icon_url: form.header_icon_url.trim() || null,
      starts_at: form.starts_at ? new Date(form.starts_at).toISOString() : null,
      expires_at: form.expires_at ? new Date(form.expires_at).toISOString() : null,
      is_pinned: form.is_pinned,
      is_published: form.is_published,
      updated_at: new Date().toISOString(),
    };

    const result = editingId
      ? await supabase.from('flow_announcements').update(payload).eq('id', editingId)
      : await supabase.from('flow_announcements').insert({
          ...payload,
          created_by: authData.user?.id || null,
          position_x: fallback.x,
          position_y: fallback.y,
          z_index: announcements.length + 1,
        });

    setSaving(false);

    if (result.error) {
      toast.error(result.error.message || 'Não foi possível salvar o aviso.');
      return;
    }

    toast.success(editingId ? 'Aviso atualizado.' : 'Aviso colocado no mural.');
    setEditorOpen(false);
    setEditingId(null);
    setForm(emptyForm);
    await loadAnnouncements();
  }

  async function deleteAnnouncement(id: string) {
    if (!window.confirm('Remover este papel do mural?')) return;

    const { error } = await supabase.from('flow_announcements').delete().eq('id', id);
    if (error) {
      toast.error('Não foi possível remover o aviso.');
      return;
    }

    setAnnouncements((current) => current.filter((item) => item.id !== id));
    toast.success('Aviso removido.');
  }

  async function moveAnnouncement(id: string, x: number, y: number) {
    if (!isAdmin || !advancedBoardReady) return;

    setAnnouncements((current) =>
      current.map((item) =>
        item.id === id ? { ...item, position_x: x, position_y: y } : item,
      ),
    );

    const { error } = await supabase
      .from('flow_announcements')
      .update({ position_x: x, position_y: y, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) toast.error('Não foi possível salvar a nova posição do papel.');
  }

  const statCards = useMemo(
    () => [
      { label: 'Pendentes hoje', value: stats.pending, icon: Clock3 },
      { label: 'Concluídas', value: stats.completed, icon: CheckCircle2 },
      { label: 'Atrasadas', value: stats.overdue, icon: BellRing },
      {
        label: isAdmin ? 'Demandas ao gestor' : 'Retornos do gestor',
        value: stats.extra,
        icon: isAdmin ? Users : Megaphone,
      },
    ],
    [stats, isAdmin],
  );

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flow-loader"><span className="flow-loader-core" /></div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1680px] pb-10">
      <section className="flow-home-hero">
        <div className="relative z-10 max-w-3xl">
          <p className="flow-kicker">INÍCIO / HOJE</p>
          <h1 className="mt-3 text-3xl font-black tracking-[-0.045em] text-slate-900 md:text-5xl">
            {greeting}, {profile?.name?.split(' ')[0] || 'time'}.
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-600 md:text-base">
            Confira os avisos do time e o que precisa de atenção ao longo do dia.
          </p>
        </div>

        <div className="flow-hero-core" aria-hidden="true">
          <div className="flow-hero-core-ring flow-hero-core-ring-one" />
          <div className="flow-hero-core-ring flow-hero-core-ring-two" />
          <img src="/logo.png" alt="" className="relative z-10 h-20 w-20 object-contain" />
        </div>
      </section>

      <section className="mt-7 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {statCards.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="flow-stat-card">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-blue-700/70">{stat.label}</p>
                <p className="mt-2 text-4xl font-black tracking-tight text-slate-900">{stat.value}</p>
              </div>
              <div className="flow-stat-icon"><Icon className="h-5 w-5" /></div>
            </div>
          );
        })}
      </section>

      <section className="mt-8">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="flow-kicker">MURAL DO TIME</p>
            <h2 className="mt-1 text-2xl font-black tracking-tight text-slate-900 md:text-3xl">
              Quadro de avisos
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {isAdmin
                ? 'Organize os recados que o time precisa ver hoje.'
                : 'Recados, aniversários e comunicados importantes.'}
            </p>
          </div>

          {isAdmin && boardReady && advancedBoardReady && (
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => setBoardEditorOpen(true)} className="flow-secondary-button">
                Personalizar quadro
              </Button>
              <Button onClick={openCreate} className="flow-primary-button">
                <Plus className="h-4 w-4" />
                Novo aviso
              </Button>
            </div>
          )}
        </div>

        {!boardReady ? (
          <div className="flow-system-message">
            <Megaphone className="h-5 w-5 text-blue-700" />
            <div>
              <h3 className="font-bold text-slate-900">O mural ainda não existe no Supabase.</h3>
              <p className="mt-1 text-sm text-slate-600">Execute primeiro a migration de criação do mural e depois a migration V3.</p>
            </div>
          </div>
        ) : !advancedBoardReady ? (
          <div className="flow-system-message">
            <Save className="h-5 w-5 text-blue-700" />
            <div>
              <h3 className="font-bold text-slate-900">Seu mural está na versão anterior.</h3>
              <p className="mt-1 text-sm text-slate-600">Rode a migration V3 para liberar posição, rotação, cor do papel e imagens.</p>
            </div>
          </div>
        ) : (
          <div className="flow-board-frame">
            <div ref={boardRef} className={`flow-felt-board ${boardSettings.background_image_url ? 'has-custom-bg' : ''}`} style={{ backgroundColor: normalizeHex(boardSettings.board_color, defaultBoardSettings.board_color) }}>
              {boardSettings.background_image_url && (
                <div
                  className="flow-board-background-media"
                  style={{ backgroundImage: `url(${boardSettings.background_image_url})` }}
                />
              )}

              {announcements.length === 0 ? (
                <div className="flow-board-empty">
                  <Megaphone className="h-9 w-9" />
                  <p className="mt-3 font-black">O quadro está vazio.</p>
                  <p className="mt-1 text-sm opacity-60">
                    {isAdmin ? 'Coloque o primeiro aviso no quadro.' : 'A administração ainda não publicou avisos.'}
                  </p>
                  {isAdmin && (
                    <button type="button" onClick={openCreate} className="flow-board-empty-button">
                      <Plus className="h-4 w-4" /> Adicionar aviso
                    </button>
                  )}
                </div>
              ) : (
                announcements.map((announcement, index) => {
                  const fallback = defaultPosition(index);
                  return (
                    <BoardNote
                      key={announcement.id}
                      id={announcement.id}
                      title={announcement.title}
                      content={announcement.content}
                      emoji={announcement.emoji}
                      imageUrl={announcement.image_url}
                      headerIconUrl={announcement.header_icon_url}
                      paperColor={announcement.paper_color}
                      textColor={announcement.text_color}
                      noteSize={announcement.note_size}
                      positionX={announcement.position_x ?? fallback.x}
                      positionY={announcement.position_y ?? fallback.y}
                      rotation={announcement.rotation ?? 0}
                      zIndex={announcement.z_index ?? index + 1}
                      pinned={announcement.is_pinned}
                      draft={!announcement.is_published}
                      isAdmin={isAdmin}
                      boardRef={boardRef}
                      onEdit={() => openEdit(announcement)}
                      onDelete={() => void deleteAnnouncement(announcement.id)}
                      onMove={(id, x, y) => void moveAnnouncement(id, x, y)}
                    />
                  );
                })
              )}
            </div>
          </div>
        )}
      </section>


      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent className="flow-dialog flow-board-editor max-h-[calc(100vh-2rem)] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <p className="flow-kicker">EDITOR DO MURAL</p>
            <DialogTitle className="text-2xl font-black text-slate-900">
              {editingId ? 'Editar papel' : 'Novo papel'}
            </DialogTitle>
            <DialogDescription className="text-slate-500">
              Personalize o aviso antes de prendê-lo no quadro do time.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-5 grid gap-5">
            <div className="grid gap-2">
              <Label htmlFor="board-title">Título</Label>
              <Input
                id="board-title"
                value={form.title}
                onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                placeholder="Ex.: Aniversariantes do mês"
                className="flow-input"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="board-content">Mensagem</Label>
              <Textarea
                id="board-content"
                value={form.content}
                onChange={(event) => setForm((current) => ({ ...current, content: event.target.value }))}
                placeholder="Escreva o recado para o time..."
                className="flow-input min-h-28"
              />
            </div>

            <div className="grid gap-4 md:grid-cols-[1.1fr_0.9fr_0.9fr]">
              <div className="grid gap-2">
                <Label>Categoria</Label>
                <Select
                  value={form.category}
                  onValueChange={(value) => {
                    const category = value as AnnouncementCategory;
                    setForm((current) => ({
                      ...current,
                      category,
                      emoji: current.emoji || categoryConfig[category].defaultEmoji,
                    }));
                  }}
                >
                  <SelectTrigger className="flow-input w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(categoryConfig).map(([value, config]) => (
                      <SelectItem key={value} value={value}>{config.defaultEmoji} {config.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label>Emoji</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <button type="button" className="flow-emoji-trigger">
                      <span className="flow-emoji-current">{form.emoji || '✨'}</span>
                      <span>Escolher emoji</span>
                      <SmilePlus className="ml-auto h-4 w-4" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="flow-emoji-popover w-[310px] p-3" align="start">
                    <div className="mb-2 flex items-center justify-between">
                      <strong className="text-sm">Escolha um emoji</strong>
                      <span className="text-xs opacity-60">{emojiLibrary.length} opções</span>
                    </div>
                    <div className="flow-emoji-library is-compact">
                      {emojiLibrary.map((emoji) => (
                        <button
                          key={emoji}
                          type="button"
                          onClick={() => setForm((current) => ({ ...current, emoji }))}
                          className={`flow-emoji-chip ${form.emoji === emoji ? 'is-selected' : ''}`}
                          title={`Usar ${emoji}`}
                        >
                          <span>{emoji}</span>
                        </button>
                      ))}
                    </div>
                    <div className="mt-3">
                      <Input
                        value={form.emoji}
                        onChange={(event) => setForm((current) => ({ ...current, emoji: event.target.value }))}
                        className="flow-input text-lg"
                        maxLength={8}
                        placeholder="Ou cole um emoji"
                      />
                    </div>
                  </PopoverContent>
                </Popover>
              </div>

              <div className="grid gap-2">
                <Label>Tamanho</Label>
                <Select
                  value={form.note_size}
                  onValueChange={(value) => setForm((current) => ({ ...current, note_size: value as NoteSize }))}
                >
                  <SelectTrigger className="flow-input w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sm">Pequeno</SelectItem>
                    <SelectItem value="md">Médio</SelectItem>
                    <SelectItem value="lg">Grande</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-5 xl:grid-cols-[1fr_1fr_180px]">
              <div className="grid gap-2">
                <Label>Cor do papel</Label>
                <div className="flow-color-field">
                  <label className="flow-custom-color">
                    <span>Personalizada</span>
                    <input
                      type="color"
                      value={normalizeHex(form.paper_color, emptyForm.paper_color)}
                      onChange={(event) => setForm((current) => ({ ...current, paper_color: event.target.value }))}
                    />
                  </label>
                  <Input
                    value={form.paper_color}
                    onChange={(event) => setForm((current) => ({ ...current, paper_color: event.target.value }))}
                    placeholder="#fbfaf3"
                    className="flow-input"
                  />
                </div>
              </div>

              <div className="grid gap-2">
                <Label>Cor do texto</Label>
                <div className="flow-color-field">
                  <label className="flow-custom-color">
                    <span>Personalizada</span>
                    <input
                      type="color"
                      value={normalizeHex(form.text_color, emptyForm.text_color)}
                      onChange={(event) => setForm((current) => ({ ...current, text_color: event.target.value }))}
                    />
                  </label>
                  <Input
                    value={form.text_color}
                    onChange={(event) => setForm((current) => ({ ...current, text_color: event.target.value }))}
                    placeholder="#16324b"
                    className="flow-input"
                  />
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="board-rotation">Inclinação: {form.rotation}°</Label>
                <input
                  id="board-rotation"
                  type="range"
                  min="-7"
                  max="7"
                  step="0.5"
                  value={form.rotation}
                  onChange={(event) => setForm((current) => ({ ...current, rotation: Number(event.target.value) }))}
                  className="flow-range mt-3"
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="grid gap-2">
                <Label>Ícone no topo do aviso</Label>
                <div className="grid gap-3 md:grid-cols-[1fr_auto]">
                  <Input
                    value={form.header_icon_url}
                    onChange={(event) => setForm((current) => ({ ...current, header_icon_url: event.target.value }))}
                    placeholder="URL do ícone da plataforma"
                    className="flow-input"
                  />
                  <label className="flow-upload-button">
                    <Upload className="h-4 w-4" />
                    {uploadingIcon ? 'Enviando...' : 'Enviar ícone'}
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/svg+xml"
                      className="hidden"
                      disabled={uploadingIcon}
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (file) void uploadHeaderIcon(file);
                        event.currentTarget.value = '';
                      }}
                    />
                  </label>
                </div>
              </div>
              <div className="grid gap-2">
                <Label>Imagem no aviso</Label>
                <div className="grid gap-3 md:grid-cols-[1fr_auto]">
                  <div className="relative">
                    <ImagePlus className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-blue-700/70" />
                    <Input
                      value={form.image_url}
                      onChange={(event) => setForm((current) => ({ ...current, image_url: event.target.value }))}
                      placeholder="URL da imagem ou envie um arquivo"
                      className="flow-input pl-10"
                    />
                  </div>
                  <label className="flow-upload-button">
                    <Upload className="h-4 w-4" />
                    {uploadingImage ? 'Enviando...' : 'Enviar imagem'}
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/gif"
                      className="hidden"
                      disabled={uploadingImage}
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (file) startImageCrop(file, 'announcement');
                        event.currentTarget.value = '';
                      }}
                    />
                  </label>
                </div>
              </div>
            </div>


            <div className="grid gap-4 md:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="board-start">Exibir a partir de</Label>
                <Input
                  id="board-start"
                  type="datetime-local"
                  value={form.starts_at}
                  onChange={(event) => setForm((current) => ({ ...current, starts_at: event.target.value }))}
                  className="flow-input"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="board-end">Ocultar depois de</Label>
                <Input
                  id="board-end"
                  type="datetime-local"
                  value={form.expires_at}
                  onChange={(event) => setForm((current) => ({ ...current, expires_at: event.target.value }))}
                  className="flow-input"
                />
              </div>
            </div>


          </div>

          <DialogFooter className="flow-dialog-sticky-footer mt-6">
            <Button variant="outline" onClick={() => setEditorOpen(false)} className="flow-secondary-button">Cancelar</Button>
            <Button onClick={() => void saveAnnouncement()} disabled={saving} className="flow-primary-button">
              <Pin className="h-4 w-4" />
              {saving ? 'Salvando...' : editingId ? 'Salvar alterações' : 'Colocar no mural'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={boardEditorOpen} onOpenChange={setBoardEditorOpen}>
        <DialogContent className="flow-dialog max-h-[calc(100vh-2rem)] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <p className="flow-kicker">QUADRO DE AVISOS</p>
            <DialogTitle className="text-2xl font-black text-slate-900">Personalizar quadro</DialogTitle>
            <DialogDescription className="text-slate-500">
              Escolha a cor do feltro/TNT e, se quiser, use uma imagem de fundo sem cobrir os avisos.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-5 grid gap-5">
            <div className="grid gap-2">
              <Label>Cor de fundo do quadro</Label>
              <div className="flow-color-field">
                <label className="flow-custom-color">
                  <span>Personalizada</span>
                  <input
                    type="color"
                    value={normalizeHex(boardSettings.board_color, defaultBoardSettings.board_color)}
                    onChange={(event) => setBoardSettings((current) => ({ ...current, board_color: event.target.value }))}
                  />
                </label>
                <Input
                  value={boardSettings.board_color}
                  onChange={(event) => setBoardSettings((current) => ({ ...current, board_color: event.target.value }))}
                  placeholder="#17623f"
                  className="flow-input"
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label>Imagem de fundo do quadro</Label>
              <div className="grid gap-3 md:grid-cols-[1fr_auto]">
                <Input
                  value={boardSettings.background_image_url}
                  onChange={(event) => setBoardSettings((current) => ({ ...current, background_image_url: event.target.value }))}
                  placeholder="URL da imagem de fundo"
                  className="flow-input"
                />
                <label className="flow-upload-button">
                  <Upload className="h-4 w-4" />
                  {uploadingBoardBackground ? 'Enviando...' : 'Enviar fundo'}
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    className="hidden"
                    disabled={uploadingBoardBackground}
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) startImageCrop(file, 'board');
                      event.currentTarget.value = '';
                    }}
                  />
                </label>
              </div>
            </div>

          </div>

          <DialogFooter className="flow-dialog-sticky-footer mt-6">
            <Button variant="outline" onClick={() => setBoardEditorOpen(false)} className="flow-secondary-button">Cancelar</Button>
            <Button onClick={() => void saveBoardSettings()} disabled={savingBoardSettings} className="flow-primary-button">
              <Save className="h-4 w-4" />
              {savingBoardSettings ? 'Salvando...' : 'Salvar quadro'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ImageCropDialog
        file={cropFile}
        open={Boolean(cropFile && cropTarget)}
        title={cropTarget === 'board' ? 'Recortar fundo do quadro' : 'Recortar imagem do aviso'}
        description={
          cropTarget === 'board'
            ? 'Arraste a imagem até deixar no enquadramento que você quer usar como fundo.'
            : 'Arraste a foto dentro da moldura e escolha a área que deve aparecer no aviso.'
        }
        initialAspect={cropTarget === 'board' ? 16 / 9 : 4 / 3}
        aspectOptions={
          cropTarget === 'board'
            ? [{ label: '16:9', value: 16 / 9 }, { label: '4:3', value: 4 / 3 }]
            : [{ label: 'Quadrado', value: 1 }, { label: '4:3', value: 4 / 3 }, { label: '16:9', value: 16 / 9 }]
        }
        onOpenChange={(open) => {
          if (!open) closeImageCrop();
        }}
        onConfirm={async (croppedFile) => {
          if (cropTarget === 'board') {
            await uploadBoardBackground(croppedFile);
          } else {
            await uploadAnnouncementImage(croppedFile);
          }
          closeImageCrop();
        }}
      />
    </div>
  );
}
