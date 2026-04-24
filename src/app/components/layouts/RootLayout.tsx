import { Outlet, useNavigate } from 'react-router';
import { useEffect, useState } from 'react';
import { Sidebar } from '../sidebar/Sidebar';
import { Header } from '../header/Header';
import { AlertNotification } from '../notifications/AlertNotification';
import { supabase } from '../../lib/supabase';

export function RootLayout() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [showAlert, setShowAlert] = useState(false);
  const [alertMessage, setAlertMessage] = useState('');

  useEffect(() => {
    checkUser();
  }, []);

  async function checkUser() {
    const { data } = await supabase.auth.getUser();

    if (!data.user) {
      navigate('/login');
      return;
    }

    setUser(data.user);
    setLoading(false);

    checkOverdueTasks(data.user.id);
  }

  // 🔥 ALERTA REAL DE TAREFAS ATRASADAS
  async function checkOverdueTasks(userId: string) {
    const now = new Date().toISOString();

    const { data } = await supabase
      .from('tasks')
      .select('*')
      .eq('status', 'pending')
      .lt('deadline', now);

    if (data && data.length > 0) {
      setAlertMessage(
        `Atenção: ${data.length} tarefa(s) atrasada(s).`
      );
      setShowAlert(true);

      // opcional: já marcar como atrasado
      await supabase
        .from('tasks')
        .update({ status: 'overdue' })
        .eq('status', 'pending')
        .lt('deadline', now);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p>Carregando...</p>
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