import { Bell, LogOut } from 'lucide-react';
import { useNavigate } from 'react-router';
import { Button } from '../ui/button';
import { supabase } from '../../lib/supabase';
import { toast } from 'sonner';

export function Header() {
  const navigate = useNavigate();

  async function handleLogout() {
    await supabase.auth.signOut();
    navigate('/login');
  }

  async function enableNotifications() {
    if (!('Notification' in window)) {
      toast.error('Este navegador não suporta notificações');
      return;
    }

    const permission = await Notification.requestPermission();

    if (permission === 'granted') {
      new Notification('Painel de Demandas', {
        body: 'Notificações ativadas com sucesso.',
      });

      toast.success('Notificações ativadas');
    } else {
      toast.error('Permissão de notificação negada');
    }
  }

  return (
    <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6">
      <div className="text-sm text-gray-500">
        Hoje:{' '}
        {new Date().toLocaleDateString('pt-BR', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        })}
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={enableNotifications}
          className="relative p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          title="Ativar notificações"
        >
          <Bell className="w-5 h-5" />
          <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
        </button>

        <Button variant="ghost" size="sm" onClick={handleLogout}>
          <LogOut className="w-4 h-4 mr-2" />
          Sair
        </Button>
      </div>
    </header>
  );
}