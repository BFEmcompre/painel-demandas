import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import {
  LayoutDashboard,
  CheckSquare,
  PlusSquare,
  History,
  Users,
  Settings,
  LogOut,
  BarChart3,
  Presentation,
  Repeat2,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';

const managerMenuItems = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
  { icon: PlusSquare, label: 'Criar Demanda', path: '/criar-demanda' },
  { icon: CheckSquare, label: 'Demandas Recebidas', path: '/demandas-gestor' },
  { icon: History, label: 'Histórico', path: '/historico' },
  { icon: Users, label: 'Responsáveis', path: '/responsaveis' },
  { icon: Repeat2, label: 'Transferir Fixas', path: '/transferir-demandas-fixas' },
  { icon: BarChart3, label: 'Indicadores', path: '/indicadores' },
  { icon: Presentation, label: 'Apresentação', path: '/indicadores/apresentacao' },
  { icon: Settings, label: 'Configurações', path: '/configuracoes' },
];

const responsibleMenuItems = [
  { icon: CheckSquare, label: 'Minhas Demandas', path: '/minhas-demandas' },
  { icon: PlusSquare, label: 'Enviar Demanda', path: '/nova-demanda-gestor' },
  { icon: CheckSquare, label: 'Retornos do Gestor', path: '/minhas-demandas-gestor' },
  { icon: BarChart3, label: 'Meus Indicadores', path: '/meus-indicadores' },
  { icon: History, label: 'Histórico', path: '/historico' },
  { icon: Presentation, label: 'Apresentação', path: '/indicadores/apresentacao' },
  { icon: Settings, label: 'Configurações', path: '/configuracoes' },
];

type Profile = {
  id: string;
  name: string;
  role: 'manager' | 'responsible';
};

export function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const [user, setUser] = useState<Profile | null>(null);

  useEffect(() => {
    loadUser();
  }, []);

  async function loadUser() {
    const { data: authData } = await supabase.auth.getUser();

    if (!authData.user) {
      navigate('/login');
      return;
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('id, name, role')
      .eq('id', authData.user.id)
      .single();

    if (!profile) {
      navigate('/login');
      return;
    }

    setUser(profile);
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    navigate('/login');
  }

  const menuItems = user?.role === 'manager' ? managerMenuItems : responsibleMenuItems;

  return (
    <aside className="w-64 bg-white dark:bg-[#0B0B0B] border-r border-gray-200 dark:border-[#1F1F1F] flex flex-col">
      <div className="p-6 border-b border-gray-200 dark:border-[#1F1F1F]">
        <div className="flex items-center gap-3">
          <img
            src="/logo.png"
            alt="𝙁𝙇𝙊𝙒"
            className="w-14 h-14 rounded-lg"
          />

          <div>
            <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
              𝙁𝙇𝙊𝙒
            </h1>

            <p className="text-sm text-gray-500 dark:text-[#A1A1A1] mt-1">
              Sistema Diário
            </p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-4">
        <ul className="space-y-1">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;

            return (
              <li key={item.path}>
                <Link
                  to={item.path}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                    isActive
                      ? 'bg-gray-100 text-gray-900 border border-gray-200 dark:bg-[#181818] dark:text-white dark:border-[#2A2A2A]'
                      : 'text-gray-700 hover:bg-gray-50 dark:text-[#A1A1A1] dark:hover:bg-[#181818] dark:hover:text-white'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span className="font-medium">{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="p-4 border-t border-gray-200 dark:border-[#1F1F1F]">
        <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-gray-50 border border-gray-200 dark:bg-[#121212] dark:border-[#1F1F1F]">
          <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-[#242424] flex items-center justify-center">
            <span className="text-gray-900 dark:text-white font-semibold">
              {user?.name?.charAt(0).toUpperCase() || '?'}
            </span>
          </div>

          <div className="flex-1 min-w-0">
            <p className="font-medium text-gray-900 dark:text-white truncate">
              {user?.name || 'Usuário'}
            </p>

            <p className="text-sm text-gray-500 dark:text-[#A1A1A1] truncate">
              {user?.role === 'manager' ? 'Gestor' : 'Responsável'}
            </p>
          </div>
        </div>

        <button
          onClick={handleLogout}
          className="w-full mt-2 flex items-center gap-3 px-4 py-3 rounded-lg text-gray-700 hover:bg-red-50 hover:text-red-600 dark:text-[#A1A1A1] dark:hover:bg-[#181818] dark:hover:text-red-400 transition-colors"
        >
          <LogOut className="w-5 h-5" />
          <span className="font-medium">Sair</span>
        </button>
      </div>
    </aside>
  );
}