import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import {
  BarChart3,
  CheckSquare,
  History,
  Home,
  LayoutDashboard,
  PlusSquare,
  Presentation,
  Repeat2,
  Settings,
  Trophy,
  Users,
  X,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';

type RadialMenuProps = { open: boolean; onOpenChange: (open: boolean) => void };
type Profile = { id: string; name: string; role: string };

const managerItems = [
  { icon: Home, label: 'Início', path: '/' },
  { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
  { icon: PlusSquare, label: 'Criar demanda', path: '/criar-demanda' },
  { icon: CheckSquare, label: 'Demandas recebidas', path: '/demandas-gestor' },
  { icon: History, label: 'Histórico', path: '/historico' },
  { icon: Users, label: 'Responsáveis', path: '/responsaveis' },
  { icon: Repeat2, label: 'Transferir fixas', path: '/transferir-demandas-fixas' },
  { icon: BarChart3, label: 'Central de indicadores', path: '/indicadores' },
  { icon: Presentation, label: 'Studio', path: '/indicadores/studio' },
  { icon: Presentation, label: 'Apresentação', path: '/indicadores/apresentacao' },
  { icon: Trophy, label: 'Recompensas', path: '/recompensas' },
  { icon: Settings, label: 'Configurações', path: '/configuracoes' },
];

const responsibleItems = [
  { icon: Home, label: 'Início', path: '/' },
  { icon: CheckSquare, label: 'Minhas demandas', path: '/minhas-demandas' },
  { icon: PlusSquare, label: 'Enviar demanda', path: '/nova-demanda-gestor' },
  { icon: CheckSquare, label: 'Retornos do gestor', path: '/minhas-demandas-gestor' },
  { icon: Presentation, label: 'Meu Studio', path: '/indicadores/studio' },
  { icon: Presentation, label: 'Apresentação', path: '/indicadores/apresentacao' },
  { icon: History, label: 'Histórico', path: '/historico' },
  { icon: Settings, label: 'Configurações', path: '/configuracoes' },
];

function isActivePath(currentPath: string, path: string) {
  if (path === '/') return currentPath === '/';
  return currentPath === path || currentPath.startsWith(`${path}/`);
}

export function RadialMenu({ open, onOpenChange }: RadialMenuProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  useEffect(() => { void loadProfile(); }, []);

  async function loadProfile() {
    const { data: authData } = await supabase.auth.getUser();
    if (!authData.user) return;
    const { data } = await supabase.from('profiles').select('id, name, role').eq('id', authData.user.id).single();
    if (data) setProfile(data);
  }

  const isManager = ['manager', 'admin', 'gestor'].includes(String(profile?.role).toLowerCase());
  const items = useMemo(() => (isManager ? managerItems : responsibleItems), [isManager]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.altKey && event.key.toLowerCase() === 'q') { event.preventDefault(); onOpenChange(!open); return; }
      if (!open) return;
      if (event.key === 'Escape') { onOpenChange(false); return; }
      const number = Number(event.key);
      if (Number.isInteger(number) && number >= 1 && number <= items.length) {
        event.preventDefault();
        navigate(items[number - 1].path);
        onOpenChange(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, items, navigate, onOpenChange]);

  const activeIndex = items.findIndex((item) => isActivePath(location.pathname, item.path));
  const selectedIndex = hoveredIndex ?? (activeIndex >= 0 ? activeIndex : 0);
  const selectedItem = items[selectedIndex];

  return <div className={`flow-radial-overlay ${open ? 'is-open' : ''}`} aria-hidden={!open} onMouseDown={(event) => { if (event.currentTarget === event.target) onOpenChange(false); }}>
    <div className="flow-radial-stage" role="dialog" aria-modal="true" aria-label="Navegação do Flow">
      <button type="button" className="flow-radial-close" onClick={() => onOpenChange(false)} aria-label="Fechar menu"><X className="h-4 w-4" /></button>
      <div className="flow-radial-wheel">
        <div className="flow-radial-wheel-grid" /><div className="flow-radial-wheel-glow" />
        {items.map((item, index) => {
          const Icon = item.icon;
          const angle = -90 + (360 / items.length) * index;
          const radius = items.length > 8 ? 178 : 168;
          const x = 50 + Math.cos((angle * Math.PI) / 180) * (radius / 4.4);
          const y = 50 + Math.sin((angle * Math.PI) / 180) * (radius / 4.4);
          const active = isActivePath(location.pathname, item.path);
          return <button key={item.path} type="button" className={`flow-radial-item ${active ? 'is-active' : ''}`} style={{ left: `${x}%`, top: `${y}%` }} onMouseEnter={() => setHoveredIndex(index)} onMouseLeave={() => setHoveredIndex(null)} onFocus={() => setHoveredIndex(index)} onBlur={() => setHoveredIndex(null)} onClick={() => { navigate(item.path); onOpenChange(false); }} aria-current={active ? 'page' : undefined}>
            <span className="flow-radial-number">{index + 1}</span><span className="flow-radial-icon"><Icon className="h-6 w-6" /></span><span className="flow-radial-label">{item.label}</span>
          </button>;
        })}
        <div className="flow-radial-core"><div className="flow-radial-core-orbit" /><div className="flow-radial-core-logo"><img src="/logo.png" alt="FLOW" className="h-16 w-16 object-contain" /></div><p className="mt-4 text-xs font-semibold uppercase tracking-[0.22em] text-blue-300/70">Navegação</p><p className="mt-1 max-w-[180px] truncate text-center text-sm font-bold text-white">{selectedItem?.label}</p></div>
      </div>
      <div className="flow-radial-help"><span><kbd>1–{items.length}</kbd> selecionar</span><span><kbd>ESC</kbd> fechar</span><span><kbd>Alt + Q</kbd> abrir</span></div>
    </div>
  </div>;
}
