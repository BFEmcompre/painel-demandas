import { Outlet, useNavigate } from 'react-router';
import { useEffect, useState } from 'react';
import { Sidebar } from '../sidebar/Sidebar';
import { Header } from '../header/Header';
import { AlertNotification } from '../notifications/AlertNotification';
import { supabase } from '../../lib/supabase';

type AlertTask = {
  id: string;
  title: string;
};

export function RootLayout() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [showAlert, setShowAlert] = useState(false);
  const [alertMessage, setAlertMessage] = useState('');
  const [alertTasks, setAlertTasks] = useState<AlertTask[]>([]);
  const [currentUserId, setCurrentUserId] = useState('');

  useEffect(() => {
    let managerRequestsChannel: any = null;

    requestNotificationPermission();
    checkUserAndOverdueTasks();

    async function setupRealtime() {
      managerRequestsChannel = await subscribeManagerRequests();
    }

    setupRealtime();

    const interval = setInterval(() => {
      checkUserAndOverdueTasks();
    }, 300000);

    return () => {
      clearInterval(interval);

      if (managerRequestsChannel) {
        supabase.removeChannel(managerRequestsChannel);
      }
    };
  }, []);

  function isManagerRole(role?: string) {
    return ['manager', 'admin', 'gestor'].includes(
      String(role).toLowerCase()
    );
  }

  function sendBrowserNotification(title: string, body: string) {
    if (!('Notification' in window)) return;
    if (Notification.permission !== 'granted') return;

    new Notification(title, {
      body,
      requireInteraction: true,
    });
  }

  async function requestNotificationPermission() {
    if (!('Notification' in window)) return;

    if (Notification.permission === 'default') {
      await Notification.requestPermission();
    }
  }

  async function checkUserAndOverdueTasks() {
    const { data: authData } = await supabase.auth.getUser();

    if (!authData.user) {
      navigate('/login');
      return;
    }

    const userId = authData.user.id;
    setCurrentUserId(userId);
    setLoading(false);

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .single();

    await checkPendingIndicators(userId, profile?.role);
    await checkManagerRequests(userId, profile?.role);

const { data: allPendingTasks } = await supabase
  .from('tasks')
  .select('id, title, deadline, status, is_recurring')
  .in('status', ['pending', 'overdue'])
  .or('is_recurring.eq.false,is_recurring.is.null');

    const overdueTasks =
      allPendingTasks?.filter((task) => new Date(task.deadline) < new Date()) || [];

    if (overdueTasks.length === 0) {
      setShowAlert(false);
      return;
    }

    await supabase
      .from('tasks')
      .update({ status: 'overdue' })
      .in(
        'id',
        overdueTasks.map((task) => task.id)
      );

    let tasksToNotify = overdueTasks;

    if (!isManagerRole(profile?.role)) {
      const { data: relations } = await supabase
        .from('task_responsibles')
        .select('task_id')
        .eq('responsible_id', userId);

      const myTaskIds = relations?.map((item) => item.task_id) || [];

      tasksToNotify = overdueTasks.filter((task) => myTaskIds.includes(task.id));
    }

    if (tasksToNotify.length === 0) {
      setShowAlert(false);
      return;
    }

    const { data: viewedAlerts } = await supabase
      .from('task_alert_views')
      .select('task_id')
      .eq('user_id', userId);

    const viewedTaskIds = viewedAlerts?.map((item) => item.task_id) || [];

    const notViewedTasks = tasksToNotify.filter(
      (task) => !viewedTaskIds.includes(task.id)
    );

    if (notViewedTasks.length === 0) {
      setShowAlert(false);
      return;
    }

    const message =
      notViewedTasks.length === 1
        ? `A tarefa "${notViewedTasks[0].title}" está atrasada.`
        : `${notViewedTasks.length} tarefas estão atrasadas.`;

    setAlertTasks(notViewedTasks);
    setAlertMessage(message);
    setShowAlert(true);

    sendBrowserNotification('🚨 Tarefa atrasada', message);
  }

  async function checkManagerRequests(userId: string, role?: string) {
    const now = new Date();

    const { data: requests } = await supabase
      .from('manager_requests')
      .select('*');

    if (!requests || requests.length === 0) return;

    if (isManagerRole(role)) {
      const openRequests = requests.filter((request) =>
        ['open', 'unresolved'].includes(request.status)
      );

      const overdue = openRequests.filter(
        (request) => new Date(request.due_at) < now
      );

      if (overdue.length > 0) {
        sendBrowserNotification(
          '⏰ Demandas vencidas',
          `${overdue.length} demanda(s) vencida(s)`
        );
      }

      const upcoming = openRequests.filter((request) => {
        const diff = new Date(request.due_at).getTime() - now.getTime();

        return diff > 0 && diff <= 10 * 60 * 1000;
      });

      if (upcoming.length > 0) {
        sendBrowserNotification(
          '⚠️ Próximo do prazo',
          `${upcoming.length} demanda(s) vencendo em breve`
        );
      }

      return;
    }

    const answered = requests.filter(
      (request) =>
        request.requester_id === userId &&
        request.status === 'answered' &&
        request.responded_at
    );

    if (answered.length === 0) return;

    const { data: viewedResponses } = await supabase
      .from('manager_request_alert_views')
      .select('request_id')
      .eq('user_id', userId)
      .eq('alert_type', 'response_viewed');

    const viewedIds = viewedResponses?.map((item) => item.request_id) || [];

    const notViewedAnswered = answered.filter(
      (request) => !viewedIds.includes(request.id)
    );

    if (notViewedAnswered.length > 0) {
      sendBrowserNotification(
        '✅ Demanda respondida',
        `${notViewedAnswered.length} demanda(s) respondida(s) pelo gestor`
      );
    }
  }

  async function subscribeManagerRequests() {
    const { data: authData } = await supabase.auth.getUser();

    if (!authData.user) return null;

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', authData.user.id)
      .single();

    if (!isManagerRole(profile?.role)) return null;

    const channel = supabase
      .channel('manager-requests-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'manager_requests',
        },
        (payload) => {
          const request: any = payload.new;

          sendBrowserNotification(
            '📩 Nova demanda recebida',
            request.urgent ? `URGENTE: ${request.subject}` : request.subject
          );
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'manager_requests',
        },
        (payload) => {
          const request: any = payload.new;

          if (request.status !== 'unresolved') return;

          sendBrowserNotification(
            '🔁 Demanda marcada como não resolvida',
            request.urgent ? `URGENTE: ${request.subject}` : request.subject
          );
        }
      )
      .subscribe();

    return channel;
  }

  async function checkPendingIndicators(userId: string, role?: string) {
    if (!isManagerRole(role)) return;

    const today = new Date().toLocaleDateString('sv-SE', {
      timeZone: 'America/Sao_Paulo',
    });

    const { data: platforms } = await supabase
      .from('platforms')
      .select('*');

    const { data: images } = await supabase
      .from('platform_indicator_images')
      .select('*')
      .eq('reference_date', today);

    const pending = platforms?.filter((platform) => {
      return !images?.some(
        (image) =>
          image.platform_id === platform.id &&
          image.responsible_id === platform.responsible_id
      );
    });

    if (!pending || pending.length === 0) return;

    sendBrowserNotification(
      '📊 Indicadores pendentes',
      `${pending.length} indicadores não enviados`
    );
  }

  async function markAlertAsViewed() {
    if (!currentUserId || alertTasks.length === 0) return;

    const rows = alertTasks.map((task) => ({
      task_id: task.id,
      user_id: currentUserId,
    }));

    await supabase
      .from('task_alert_views')
      .upsert(rows, { onConflict: 'task_id,user_id' });

    setShowAlert(false);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        Carregando...
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />

      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />

        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>

      {showAlert && (
        <AlertNotification
          message={alertMessage}
          type="overdue"
          onClose={() => setShowAlert(false)}
          onMarkAsViewed={markAlertAsViewed}
        />
      )}
    </div>
  );
}