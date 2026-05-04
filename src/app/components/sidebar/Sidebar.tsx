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
} from 'lucide-react';
import { supabase } from '../../lib/supabase';

const managerMenuItems = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
  { icon: PlusSquare, label: 'Criar Demanda', path: '/criar-demanda' },
  { icon: CheckSquare, label: 'Demandas Recebidas', path: '/demandas-gestor' },
  { icon: History, label: 'Histórico', path: '/historico' },
  { icon: Users, label: 'Responsáveis', path: '/responsaveis' },
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
  { icon: Settings, label: 'Configurações', path: '/configuracoes' },
  { icon: Presentation, label: 'Apresentação', path: '/indicadores/apresentacao' },
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
    <aside className="w-64 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 flex flex-col">
      <div className="p-6 border-b border-gray-200 dark:border-gray-800">
  <div className="flex items-center gap-3">
    <img
      src="/logo.png"
      alt="Task Hub"
      className="w-11 h-11 object-contain"
    />

    <div>
      <h1 className="text-xl font-semibold text-gray-900 dark:text-white">𝚃𝚊𝚜𝚔 𝙷𝚞𝚋</h1>
      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Sistema Diário</p>
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
  ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-300'
  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
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

      <div className="p-4 border-t border-gray-200 dark:border-gray-800">
        <div className="flex items-center gap-3 px-4 py-3">
          <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
            <span className="text-blue-600 font-semibold">
              {user?.name?.charAt(0).toUpperCase() || '?'}
            </span>
          </div>

          <div className="flex-1 min-w-0">
            <p className="font-medium text-gray-900 dark:text-white truncate">{user?.name || 'Usuário'}</p>
            <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
              {user?.role === 'manager' ? 'Gestor' : 'Responsável'}
            </p>
          </div>
        </div>

        <button
          onClick={handleLogout}
          className="w-full mt-2 flex items-center gap-3 px-4 py-3 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-red-50 dark:hover:bg-red-950/50 hover:text-red-600 dark:hover:text-red-300 transition-colors"
        >
          <LogOut className="w-5 h-5" />
          <span className="font-medium">Sair</span>
        </button>
      </div>
    </aside>
  );
}