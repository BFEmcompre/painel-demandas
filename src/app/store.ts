import { create } from 'zustand';
import { User, Task, Responsible } from './types';

interface AppState {
  user: User | null;
  tasks: Task[];
  responsibles: Responsible[];
  setUser: (user: User | null) => void;
  addTask: (task: Task) => void;
  updateTask: (id: string, updates: Partial<Task>) => void;
  deleteTask: (id: string) => void;
  toggleChecklistItem: (taskId: string, itemId: string) => void;
}

const mockResponsibles: Responsible[] = [
  { id: '1', name: 'João Silva', email: 'joao@empresa.com', tasksCount: 5, completedCount: 3 },
  { id: '2', name: 'Maria Santos', email: 'maria@empresa.com', tasksCount: 4, completedCount: 4 },
  { id: '3', name: 'Pedro Costa', email: 'pedro@empresa.com', tasksCount: 3, completedCount: 1 },
];

const mockTasks: Task[] = [
  {
    id: '1',
    title: 'Conferência de pedidos',
    description: 'Verificar todos os pedidos do dia e validar estoque',
    responsibleId: '1',
    responsibleName: 'João Silva',
    date: '2026-04-24',
    deadline: '2026-04-24T10:00',
    status: 'overdue',
    checklist: [
      { id: 'c1', text: 'Verificar pedidos pendentes', completed: false },
      { id: 'c2', text: 'Validar estoque', completed: false },
      { id: 'c3', text: 'Gerar relatório', completed: false },
    ],
  },
  {
    id: '2',
    title: 'Atualização de cadastros',
    description: 'Atualizar cadastros de clientes no sistema',
    responsibleId: '2',
    responsibleName: 'Maria Santos',
    date: '2026-04-24',
    deadline: '2026-04-24T14:00',
    status: 'completed',
    completedAt: '2026-04-24T13:30',
    photo: 'https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=400',
    checklist: [
      { id: 'c4', text: 'Revisar dados', completed: true },
      { id: 'c5', text: 'Atualizar sistema', completed: true },
    ],
  },
  {
    id: '3',
    title: 'Organização do almoxarifado',
    description: 'Reorganizar prateleiras e atualizar inventário',
    responsibleId: '3',
    responsibleName: 'Pedro Costa',
    date: '2026-04-24',
    deadline: '2026-04-24T16:00',
    status: 'pending',
    checklist: [
      { id: 'c6', text: 'Organizar prateleiras', completed: false },
      { id: 'c7', text: 'Contar itens', completed: false },
      { id: 'c8', text: 'Atualizar planilha', completed: false },
    ],
  },
  {
    id: '4',
    title: 'Limpeza da área externa',
    description: 'Realizar limpeza completa da área externa',
    responsibleId: '1',
    responsibleName: 'João Silva',
    date: '2026-04-24',
    deadline: '2026-04-24T15:00',
    status: 'pending',
    checklist: [
      { id: 'c9', text: 'Varrer área', completed: false },
      { id: 'c10', text: 'Lavar piso', completed: false },
    ],
  },
];

export const useStore = create<AppState>((set) => ({
  user: null,
  tasks: mockTasks,
  responsibles: mockResponsibles,
  setUser: (user) => set({ user }),
  addTask: (task) => set((state) => ({ tasks: [...state.tasks, task] })),
  updateTask: (id, updates) =>
    set((state) => ({
      tasks: state.tasks.map((task) => (task.id === id ? { ...task, ...updates } : task)),
    })),
  deleteTask: (id) => set((state) => ({ tasks: state.tasks.filter((task) => task.id !== id) })),
  toggleChecklistItem: (taskId, itemId) =>
    set((state) => ({
      tasks: state.tasks.map((task) =>
        task.id === taskId
          ? {
              ...task,
              checklist: task.checklist.map((item) =>
                item.id === itemId ? { ...item, completed: !item.completed } : item
              ),
            }
          : task
      ),
    })),
}));
