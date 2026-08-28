import { useEffect, useMemo, useState } from 'react';
import { Bell, CheckCheck, LogOut, Radio } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router';
import { supabase } from '../../lib/supabase';
import { toast } from 'sonner';

type HeaderProps = {
  onOpenMenu: () => void;
};

type Profile = {
  name: string;
  role: string;
  avatar_url?: string | null;
};

type FlowNotification = {
  id: string;
  type: string;
  title: string;
  message: string;
  read_at: string | null;
  created_at: string;
};

const pageNames: Array<{ test: (path: string) => boolean; label: string }> = [
  { test: (path) => path === '/', label: 'Início' },
  { test: (path) => path.startsWith('/dashboard'), label: 'Hoje' },
  { test: (path) => path.startsWith('/criar-demanda'), label: 'Criar demanda' },
  { test: (path) => path.startsWith('/demandas-gestor'), label: 'Demandas recebidas' },
  { test: (path) => path.startsWith('/minhas-demandas-gestor'), label: 'Retornos do gestor' },
  { test: (path) => path.startsWith('/minhas-demandas'), label: 'Minhas demandas' },
  { test: (path) => path.startsWith('/nova-demanda-gestor'), label: 'Enviar demanda' },
  { test: (path) => path.startsWith('/historico'), label: 'Histórico' },
  { test: (path) => path.startsWith('/responsaveis'), label: 'Responsáveis' },
  { test: (path) => path.startsWith('/transferir-demandas-fixas'), label: 'Transferir fixas' },
  { test: (path) => path.startsWith('/meus-indicadores'), label: 'Meus indicadores' },
  { test: (path) => path.startsWith('/indicadores/apresentacao'), label: 'Apresentação' },
  { test: (path) => path.startsWith('/indicadores'), label: 'Indicadores' },
  { test: (path) => path.startsWith('/recompensas'), label: 'Recompensas' },
  { test: (path) => path.startsWith('/configuracoes'), label: 'Configurações' },
];

function initials(name?: string | null) {
  const letters = (name || '')
    .split(' ')
    .map((part) => part.trim())
    .filter((part) => /[a-zA-ZÀ-ÖØ-öø-ÿ]/.test(part[0] || ''))
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('');
  return letters || 'FL';
}

export function Header({ onOpenMenu }: HeaderProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const [now, setNow] = useState(new Date());
  const [profile, setProfile] = useState<Profile | null>(null);
  const [notifications, setNotifications] = useState<FlowNotification[]>([]);
  const [notificationOpen, setNotificationOpen] = useState(false);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let channel: any = null;

    async function setup() {
      const { data: authData } = await supabase.auth.getUser();
      if (!authData.user) return;

      const userId = authData.user.id;
      const { data } = await supabase
        .from('profiles')
        .select('name, role, avatar_url')
        .eq('id', userId)
        .single();

      if (data) setProfile(data);
      await loadNotifications(userId);

      channel = supabase
        .channel(`flow-notifications-${userId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'flow_notifications',
            filter: `target_user_id=eq.${userId}`,
          },
          (payload) => {
            const next = payload.new as FlowNotification;
            setNotifications((current) => [next, ...current].slice(0, 20));
            toast(next.title, { description: next.message });

            if ('Notification' in window && Notification.permission === 'granted') {
              new Notification(next.title, { body: next.message });
            }
          },
        )
        .subscribe();
    }

    void setup();

    return () => {
      if (channel) void supabase.removeChannel(channel);
    };
  }, []);

  async function loadNotifications(userId?: string) {
    let resolvedUserId = userId;
    if (!resolvedUserId) {
      const { data: authData } = await supabase.auth.getUser();
      resolvedUserId = authData.user?.id;
    }
    if (!resolvedUserId) return;

    const { data, error } = await supabase
      .from('flow_notifications')
      .select('id, type, title, message, read_at, created_at')
      .eq('target_user_id', resolvedUserId)
      .order('created_at', { ascending: false })
      .limit(20);

    if (!error) setNotifications((data || []) as FlowNotification[]);
  }

  const unreadCount = notifications.filter((notification) => !notification.read_at).length;

  const pageName = useMemo(
    () => pageNames.find((page) => page.test(location.pathname))?.label || 'Flow',
    [location.pathname],
  );

  async function handleLogout() {
    await supabase.auth.signOut();
    navigate('/login');
  }

  async function markAllRead() {
    const unreadIds = notifications.filter((notification) => !notification.read_at).map((notification) => notification.id);
    if (unreadIds.length === 0) return;

    const readAt = new Date().toISOString();
    const { error } = await supabase
      .from('flow_notifications')
      .update({ read_at: readAt })
      .in('id', unreadIds);

    if (!error) {
      setNotifications((current) => current.map((notification) => ({ ...notification, read_at: notification.read_at || readAt })));
    }
  }

  async function enableNotifications() {
    setNotificationOpen((current) => !current);

    if ('Notification' in window && Notification.permission === 'default') {
      await Notification.requestPermission();
    }
  }

  return (
    <header className="flow-topbar">
      <div className="flex min-w-0 items-center gap-3">
        <button type="button" onClick={onOpenMenu} className="flow-top-menu-trigger" aria-label="Abrir menu radial" title="Abrir menu - Alt + Q">
          <span className="flow-top-menu-logo-wrap"><img src="/logo.png" alt="" className="flow-top-menu-logo" /></span>
          <span className="flow-top-menu-copy"><strong>MENU</strong><small>Alt + Q</small></span>
        </button>

        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="flow-live-dot" />
            <span className="truncate text-[10px] font-bold uppercase tracking-[0.24em]">FLOW / {pageName}</span>
          </div>
          <p className="mt-0.5 truncate text-sm font-semibold">{profile?.name ? `Olá, ${profile.name.split(' ')[0]}` : 'FLOW'}</p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="hidden text-right lg:block">
          <p className="text-[9px] font-bold uppercase tracking-[0.2em] opacity-60">
            {now.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' })}
          </p>
          <p className="mt-0.5 text-sm font-bold tabular-nums">{now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</p>
        </div>

        <div className="relative">
          <button type="button" onClick={() => void enableNotifications()} className="flow-icon-button relative" aria-label="Notificações" title="Notificações">
            <Bell className="h-4.5 w-4.5" />
            {unreadCount > 0 && <span className="flow-notification-count">{unreadCount > 9 ? '9+' : unreadCount}</span>}
          </button>

          {notificationOpen && (
            <div className="flow-notification-panel">
              <div className="flow-notification-head">
                <div><strong>Notificações</strong><span>{unreadCount} não lida(s)</span></div>
                {unreadCount > 0 && <button type="button" onClick={() => void markAllRead()}><CheckCheck className="h-4 w-4" /> Marcar lidas</button>}
              </div>
              <div className="flow-notification-list">
                {notifications.length === 0 ? (
                  <div className="flow-notification-empty"><Bell className="h-6 w-6" /><p>Nenhuma notificação ainda.</p></div>
                ) : (
                  notifications.map((notification) => (
                    <article key={notification.id} className={`flow-notification-item ${notification.read_at ? '' : 'is-unread'}`}>
                      <span className="flow-notification-dot" />
                      <div><strong>{notification.title}</strong><p>{notification.message}</p><small>{new Date(notification.created_at).toLocaleString('pt-BR')}</small></div>
                    </article>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        <div className="hidden items-center gap-2 rounded-xl border px-3 py-2 sm:flex flow-role-pill">
          <Radio className="h-3.5 w-3.5" />
          <span className="text-[10px] font-bold uppercase tracking-[0.16em]">{['manager', 'admin', 'gestor'].includes(String(profile?.role).toLowerCase()) ? 'Admin' : 'Responsável'}</span>
        </div>

        <div className="flow-header-avatar" title={profile?.name || ''}>
          {profile?.avatar_url ? <img src={profile.avatar_url} alt="" /> : <span>{initials(profile?.name)}</span>}
        </div>

        <button type="button" onClick={handleLogout} className="flow-icon-button" aria-label="Sair do Flow" title="Sair"><LogOut className="h-4.5 w-4.5" /></button>
      </div>
    </header>
  );
}
