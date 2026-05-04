import { Bell, LogOut, Moon, Sun } from 'lucide-react';
import { useNavigate } from 'react-router';
import { Button } from '../ui/button';
import { supabase } from '../../lib/supabase';
import { toast } from 'sonner';

type HeaderProps = {
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
};

export function Header({ theme, onToggleTheme }: HeaderProps) {
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
    <header className="h-16 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between px-6">
      <div className="text-sm text-gray-500 dark:text-gray-400">
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
          type="button"
          onClick={onToggleTheme}
          className="p-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
          title={theme === 'dark' ? 'Tema claro' : 'Tema escuro'}
        >
          {theme === 'dark' ? (
            <Sun className="w-5 h-5 text-yellow-400" />
          ) : (
            <Moon className="w-5 h-5" />
          )}
        </button>

        <button
          type="button"
          onClick={enableNotifications}
          className="relative p-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
          title="Ativar notificações"
        >
          <Bell className="w-5 h-5" />
          <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
        </button>

        <Button
          variant="ghost"
          size="sm"
          onClick={handleLogout}
          className="dark:text-gray-200 dark:hover:bg-gray-800"
        >
          <LogOut className="w-4 h-4 mr-2" />
          Sair
        </Button>
      </div>
    </header>
  );
}