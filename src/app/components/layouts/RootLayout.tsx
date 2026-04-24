import { Outlet, useNavigate } from 'react-router';
import { useEffect, useRef, useState } from 'react';
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

  const lastNotificationRef = useRef('');
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

  async function checkUserAndOverdueTasks() {
    const { data: authData } = await supabase.auth.getUser();

    if (!authData.user) {
      navigate('/login');
      return;
    }

async function requestNotificationPermission() {
  if (!('Notification' in window)) return;

  if (Notification.permission === 'default') {
    await Notification.requestPermission();
  }
}

    const userId = authData.user.id;
    setCurrentUserId(userId);
    setLoading(false);

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .single();

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
  new Notification('🚨 Tarefa atrasada', {
    body: message,
    tag: `tarefa-atrasada-${Date.now()}`,
    requireInteraction: true,
  });
}    

    const notificationKey = `${userId}-${notViewedTasks.map((task) => task.id).join('-')}-${new Date().getMinutes()}`;

    if (
      'Notification' in window &&
      Notification.permission === 'granted' &&
      lastNotificationRef.current !== notificationKey
    ) {
      lastNotificationRef.current = notificationKey;

      new Notification('🚨 Demanda atrasada', {
        body: message,
        icon: '/vite.svg',
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