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
    requestNotificationPermission();
    checkUserAndOverdueTasks();

    const interval = setInterval(() => {
      checkUserAndOverdueTasks();
    }, 60000);

    return () => clearInterval(interval);
  }, []);

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

async function checkManagerRequests(userId: string, role?: string) {
  const now = new Date();

  const { data: requests } = await supabase
    .from('manager_requests')
    .select('*');

  if (!requests || requests.length === 0) return;

  if (role === 'manager') {
    const openRequests = requests.filter((r) => r.status === 'open');

    const newRequests = openRequests.filter((r) => {
      const created = new Date(r.created_at);
      return now.getTime() - created.getTime() < 60000;
    });

    if (newRequests.length > 0 && Notification.permission === 'granted') {
      new Notification('📩 Nova demanda recebida', {
        body: `${newRequests.length} nova(s) demanda(s)`,
        requireInteraction: true,
      });
    }

    const overdue = openRequests.filter((r) => new Date(r.due_at) < now);

    if (overdue.length > 0 && Notification.permission === 'granted') {
      new Notification('⏰ Demandas vencidas', {
        body: `${overdue.length} demanda(s) vencida(s)`,
        requireInteraction: true,
      });
    }

    const upcoming = openRequests.filter((r) => {
      const diff = new Date(r.due_at).getTime() - now.getTime();
      return diff > 0 && diff <= 10 * 60 * 1000;
    });

    if (upcoming.length > 0 && Notification.permission === 'granted') {
      new Notification('⚠️ Próximo do prazo', {
        body: `${upcoming.length} demanda(s) vencendo em breve`,
        requireInteraction: true,
      });
    }
  }

  if (role !== 'manager') {
    const answered = requests.filter(
      (r) =>
        r.requester_id === userId &&
        r.status === 'answered' &&
        r.responded_at
    );

    if (answered.length > 0 && Notification.permission === 'granted') {
      new Notification('✅ Demanda respondida', {
        body: 'Você recebeu uma resposta do gestor',
        requireInteraction: true,
      });
    }
  }
}


    const { data: allPendingTasks } = await supabase
      .from('tasks')
      .select('id, title, deadline, status')
      .in('status', ['pending', 'overdue']);

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

    if (profile?.role !== 'manager') {
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

    if ('Notification' in window && Notification.permission === 'granted') {
       console.log('Permissão:', Notification.permission);
console.log('Tarefas não vistas:', notViewedTasks);
console.log('Mensagem:', message);
      new Notification('🚨 Tarefa atrasada', {
        body: message,
        tag: `tarefa-atrasada-${Date.now()}`,
        requireInteraction: true,
      });
    }
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

async function checkPendingIndicators(userId: string, role?: string) {
  if (role !== 'manager') return;

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

  const pending = platforms?.filter((p) => {
    return !images?.some(
      (img) =>
        img.platform_id === p.id &&
        img.responsible_id === p.responsible_id
    );
  });

  if (!pending || pending.length === 0) return;

  const message = `${pending.length} indicadores não enviados`;

  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification('📊 Indicadores pendentes', {
      body: message,
      requireInteraction: true,
    });
  }
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