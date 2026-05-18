import {
  Bell,
  LogOut,
  Moon,
  Sun,
} from 'lucide-react';

import { useNavigate } from 'react-router';

import { Button } from '../ui/button';

import { supabase } from '../../lib/supabase';

import { toast } from 'sonner';

type HeaderProps = {
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
};

export function Header({
  theme,
  onToggleTheme,
}: HeaderProps) {
  const navigate = useNavigate();

  async function handleLogout() {
    await supabase.auth.signOut();

    navigate('/login');
  }

  async function enableNotifications() {
    if (!('Notification' in window)) {
      toast.error(
        'Este navegador não suporta notificações'
      );

      return;
    }

    const permission =
      await Notification.requestPermission();

    if (permission === 'granted') {
      new Notification(
        'Painel de Demandas',
        {
          body: 'Notificações ativadas com sucesso.',
        }
      );

      toast.success(
        'Notificações ativadas'
      );
    } else {
      toast.error(
        'Permissão de notificação negada'
      );
    }
  }

  return (
    <header
      className="
        h-16
        border-b
        flex
        items-center
        justify-between
        px-6

        bg-white
        border-gray-200

        dark:bg-[#101010]
        dark:border-[#1F1F1F]

        transition-colors
      "
    >

      {/* DATA */}

      <div
        className="
          text-sm
          text-gray-500
          dark:text-[#A1A1A1]
        "
      >
        Hoje:{' '}
        {new Date().toLocaleDateString(
          'pt-BR',
          {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          }
        )}
      </div>

      {/* AÇÕES */}

      <div className="flex items-center gap-2">

        {/* TEMA */}

        <button
          type="button"
          onClick={onToggleTheme}
          title={
            theme === 'dark'
              ? 'Tema claro'
              : 'Tema escuro'
          }
          className="
            p-2
            rounded-lg
            transition-all

            text-gray-600
            hover:bg-gray-100

            dark:text-[#A1A1A1]
            dark:hover:bg-[#181818]
          "
        >

          {theme === 'dark' ? (

            <Sun className="w-5 h-5 text-yellow-400" />

          ) : (

            <Moon className="w-5 h-5" />

          )}

        </button>

        {/* NOTIFICAÇÃO */}

        <button
          type="button"
          onClick={enableNotifications}
          title="Ativar notificações"
          className="
            relative
            p-2
            rounded-lg
            transition-all

            text-gray-600
            hover:bg-gray-100

            dark:text-[#A1A1A1]
            dark:hover:bg-[#181818]
          "
        >

          <Bell className="w-5 h-5" />

          <span
            className="
              absolute
              top-1
              right-1
              w-2
              h-2
              bg-red-500
              rounded-full
            "
          />

        </button>

        {/* SAIR */}

        <Button
          variant="ghost"
          size="sm"
          onClick={handleLogout}
          className="
            text-gray-700
            hover:bg-gray-100

            dark:text-white
            dark:hover:bg-[#181818]
          "
        >

          <LogOut className="w-4 h-4 mr-2" />

          Sair

        </Button>

      </div>
    </header>
  );
}