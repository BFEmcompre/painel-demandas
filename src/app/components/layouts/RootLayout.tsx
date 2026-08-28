import { Outlet, useLocation, useNavigate } from 'react-router';
import { useEffect, useState } from 'react';
import { Header } from '../header/Header';
import { RadialMenu } from '../navigation/RadialMenu';
import { AlertNotification } from '../notifications/AlertNotification';
import { supabase } from '../../lib/supabase';
import { pollFlowNotifications, FLOW_NOTIFICATION_POLL_INTERVAL_MS } from '../../lib/notifications';
import { LoaderCircle } from 'lucide-react';
import { toast } from 'sonner';

type OverdueNotification = {
  id: string;
  message: string;
};

export function RootLayout() {
  const navigate = useNavigate();
  const location = useLocation();

  const [loading, setLoading] = useState(true);

  const [overdueNotifications, setOverdueNotifications] = useState<
    OverdueNotification[]
  >([]);

  const [currentUserId, setCurrentUserId] = useState('');

  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    let notificationsChannel: any = null;

    requestNotificationPermission();

    void bootstrap();

    async function bootstrap() {
      const { data: authData } = await supabase.auth.getUser();
      if (!authData.user) {
        navigate('/login');
        return;
      }

      const userId = authData.user.id;
      setCurrentUserId(userId);
      setLoading(false);

      const { data: profileData } = await supabase
        .from('profiles')
        .select('name')
        .eq('id', userId)
        .single();

      if (profileData?.name === 'Gabriel Felipe de Oliveira Liberato') {
        const today = new Date().toLocaleDateString();
        const lastShown = localStorage.getItem('creator-greeting');

        if (lastShown !== today) {
          setTimeout(() => {
            toast('👋 Olá, Criador!', {
              description: 'Obrigado por continuar evoluindo o FLOW ✨',
            });
          }, 900);

          localStorage.setItem('creator-greeting', today);
        }
      }

      await loadOverdueBanner(userId);

      notificationsChannel = supabase
        .channel(`flow-overdue-banner-${userId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'flow_notifications',
            filter: `target_user_id=eq.${userId}`,
          },
          () => void loadOverdueBanner(userId),
        )
        .subscribe();

      void pollFlowNotifications();
    }

    const interval = setInterval(() => {
      void pollFlowNotifications();
    }, FLOW_NOTIFICATION_POLL_INTERVAL_MS);

    return () => {
      clearInterval(interval);
      if (notificationsChannel) supabase.removeChannel(notificationsChannel);
    };
  }, []);

  useEffect(() => {
    document.documentElement.classList.remove('dark');
  }, []);

  async function requestNotificationPermission() {
    if (!('Notification' in window)) return;

    if (Notification.permission === 'default') {
      await Notification.requestPermission();
    }
  }

  async function loadOverdueBanner(userId: string) {
    const { data, error } = await supabase
      .from('flow_notifications')
      .select('id, message')
      .eq('target_user_id', userId)
      .eq('type', 'task_overdue')
      .is('read_at', null)
      .order('created_at', { ascending: false });

    if (error) return;

    setOverdueNotifications((data || []) as OverdueNotification[]);
  }

  async function markAlertAsViewed() {
    if (!currentUserId || overdueNotifications.length === 0) return;

    await supabase
      .from('flow_notifications')
      .update({ read_at: new Date().toISOString() })
      .in(
        'id',
        overdueNotifications.map((notification) => notification.id),
      );

    setOverdueNotifications([]);
  }

  if (loading) {
    return (
      <div className="flow-shell flex h-screen items-center justify-center overflow-hidden">
        <div className="flow-loader" aria-label="Carregando Flow">
          <LoaderCircle className="h-7 w-7 animate-spin text-blue-300" />
        </div>
      </div>
    );
  }

  const overdueMessage =
    overdueNotifications.length === 1
      ? overdueNotifications[0].message
      : overdueNotifications.length > 1
        ? `${overdueNotifications.length} tarefas estão atrasadas.`
        : '';

  return (
    <div className="flow-shell relative flex h-screen overflow-hidden text-foreground">
      <div className="flow-space-grid pointer-events-none absolute inset-0" />
      <div className="flow-ambient flow-ambient-one" />
      <div className="flow-ambient flow-ambient-two" />
      <div className="flow-ambient flow-ambient-three" />

      <div className="relative z-10 flex min-w-0 flex-1 flex-col overflow-hidden">
        <Header onOpenMenu={() => setMenuOpen(true)} />

        <main className="flow-scrollbar relative flex-1 overflow-y-auto px-3 py-4 sm:px-5 sm:py-5 lg:px-7 lg:py-6">
          <div key={`${location.pathname}-transition`} className="flow-route-transition" aria-hidden="true" />
          <div key={location.pathname} className="flow-page-enter flow-page-stage min-h-full">
            <Outlet />
          </div>
        </main>

        <footer className="flow-footer">
          FLOW / ambiente operacional • Desenvolvido por Gabriel Liberato
        </footer>
      </div>

      <RadialMenu open={menuOpen} onOpenChange={setMenuOpen} />

      {overdueNotifications.length > 0 && (
        <AlertNotification
          message={overdueMessage}
          type="overdue"
          onClose={() => setOverdueNotifications([])}
          onMarkAsViewed={markAlertAsViewed}
        />
      )}
    </div>
  );
}
