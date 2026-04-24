import { Outlet, useNavigate } from 'react-router';
import { useEffect, useState } from 'react';
import { Sidebar } from '../sidebar/Sidebar';
import { Header } from '../header/Header';
import { AlertNotification } from '../notifications/AlertNotification';
import { supabase } from '../../lib/supabase';

export function RootLayout() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [showAlert, setShowAlert] = useState(false);
  const [alertMessage, setAlertMessage] = useState('');

  useEffect(() => {
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

    setLoading(false);

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', authData.user.id)
      .single();

    if (profile?.role !== 'manager') return;

    const now = new Date().toISOString();

    const { data: overdueTasks, error } = await supabase
      .from('tasks')
      .select('id, title')
      .eq('status', 'pending')
      .lt('deadline', now);

    if (error || !overdueTasks || overdueTasks.length === 0) return;

    const taskIds = overdueTasks.map((task) => task.id);

    await supabase
      .from('tasks')
      .update({ status: 'overdue' })
      .in('id', taskIds);

    const message =
      overdueTasks.length === 1
        ? `A tarefa "${overdueTasks[0].title}" está atrasada.`
        : `${overdueTasks.length} tarefas estão atrasadas.`;

    setAlertMessage(message);
    setShowAlert(true);

    showBrowserNotification(message);
  }

  async function showBrowserNotification(message: string) {
    if (!('Notification' in window)) return;

    if (Notification.permission === 'default') {
      await Notification.requestPermission();
    }

    if (Notification.permission === 'granted') {
      new Notification('Painel de Demandas', {
        body: message,
      });
    }
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
        />
      )}
    </div>
  );
}