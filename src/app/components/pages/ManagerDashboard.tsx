import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import {
  CheckCircle,
  Clock,
  AlertCircle,
  PlusCircle,
  Search,
  Filter,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';

type Task = {
  id: string;
  title: string;
  description: string;
  responsible_id: string;
  responsible_name: string;
  deadline: string;
  date: string;
  status: 'pending' | 'completed' | 'overdue';
  is_recurring?: boolean | null;
};

type Responsible = {
  id: string;
  name: string;
  email: string;
};

export function ManagerDashboard() {
  const navigate = useNavigate();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [responsibles, setResponsibles] = useState<Responsible[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [responsibleFilter, setResponsibleFilter] = useState<string>('all');

  useEffect(() => {
    loadData();
  }, []);

async function generateTodayRecurringTasks(today: string) {
  const { data: recurringTasks } = await supabase
    .from('tasks')
    .select('*')
    .eq('is_recurring', true)
    .lte('date', today);

  if (!recurringTasks || recurringTasks.length === 0) return;

  for (const recurringTask of recurringTasks) {
    const { data: existingTask } = await supabase
      .from('tasks')
      .select('id')
      .eq('date', today)
      .eq('title', recurringTask.title)
      .eq('description', recurringTask.description)
      .eq('recurring_deadline', recurringTask.recurring_deadline)
      .eq('responsible_id', recurringTask.responsible_id)
      .eq('is_recurring', false)
      .maybeSingle();

    if (existingTask) continue;

    const deadlineTime = recurringTask.recurring_deadline || '17:00';
    const deadlineFull = `${today}T${deadlineTime}`;

    const { data: newTask, error: taskError } = await supabase
      .from('tasks')
      .insert({
        title: recurringTask.title,
        description: recurringTask.description,
        responsible_id: recurringTask.responsible_id,
        responsible_name: recurringTask.responsible_name,
        date: today,
        deadline: deadlineFull,
        status: 'pending',
        is_recurring: false,
        recurring_deadline: recurringTask.recurring_deadline,
      })
      .select()
      .single();

    if (taskError || !newTask) {
      console.error(taskError);
      continue;
    }

    const { data: oldResponsibles } = await supabase
      .from('task_responsibles')
      .select('responsible_id, responsible_name')
      .eq('task_id', recurringTask.id);

    if (oldResponsibles && oldResponsibles.length > 0) {
      await supabase.from('task_responsibles').insert(
        oldResponsibles.map((item) => ({
          task_id: newTask.id,
          responsible_id: item.responsible_id,
          responsible_name: item.responsible_name,
        }))
      );
    }

    const { data: oldChecklist } = await supabase
      .from('checklist_items')
      .select('text')
      .eq('task_id', recurringTask.id);

    if (oldChecklist && oldChecklist.length > 0) {
      await supabase.from('checklist_items').insert(
        oldChecklist.map((item) => ({
          task_id: newTask.id,
          text: item.text,
          completed: false,
        }))
      );
    }
  }
}


async function loadData() {
  const today = new Date().toLocaleDateString('sv-SE', {
    timeZone: 'America/Sao_Paulo',
  });

  await generateTodayRecurringTasks(today);

  const { data: tasksData } = await supabase.from('tasks').select('*');

    const { data: respData } = await supabase
      .from('profiles')
      .select('id, name, email')
      .eq('role', 'responsible');

    setTasks(tasksData || []);
    setResponsibles(respData || []);
  }
const today = new Date().toLocaleDateString('sv-SE', {
  timeZone: 'America/Sao_Paulo',
});

const todayTasks = tasks.filter(
  (t: any) => t.date === today && t.is_recurring !== true
);

  const completedCount = todayTasks.filter((t) => t.status === 'completed').length;
  const pendingCount = todayTasks.filter((t) => t.status === 'pending').length;
  const overdueCount = todayTasks.filter((t) => t.status === 'overdue').length;

  const filteredTasks = todayTasks.filter((task) => {
    const matchesSearch =
      task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      task.description.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === 'all' || task.status === statusFilter;
    const matchesResponsible =
      responsibleFilter === 'all' || task.responsible_id === responsibleFilter;

    return matchesSearch && matchesStatus && matchesResponsible;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-700 border-green-200';
      case 'overdue':
        return 'bg-red-100 text-red-700 border-red-200';
      default:
        return 'bg-yellow-100 text-yellow-700 border-yellow-200';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'completed':
        return 'Concluída';
      case 'overdue':
        return 'Atrasada';
      default:
        return 'Pendente';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-gray-900">Dashboard</h1>
          <p className="text-gray-500 mt-1">Visão geral das demandas do dia</p>
        </div>

        <Button
          onClick={() => navigate('/criar-demanda')}
          className="bg-blue-600 hover:bg-blue-700"
        >
          <PlusCircle className="w-4 h-4 mr-2" />
          Criar Nova Demanda
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-5 border-l-4 border-l-blue-500">
          <p className="text-sm text-gray-600">Demandas do Dia</p>
          <p className="text-3xl font-semibold">{todayTasks.length}</p>
        </Card>

        <Card className="p-5 border-l-4 border-l-green-500">
          <p className="text-sm text-gray-600">Concluídas</p>
          <p className="text-3xl font-semibold">{completedCount}</p>
        </Card>

        <Card className="p-5 border-l-4 border-l-yellow-500">
          <p className="text-sm text-gray-600">Pendentes</p>
          <p className="text-3xl font-semibold">{pendingCount}</p>
        </Card>

        <Card className="p-5 border-l-4 border-l-red-500">
          <p className="text-sm text-gray-600">Atrasadas</p>
          <p className="text-3xl font-semibold">{overdueCount}</p>
        </Card>
      </div>

      {overdueCount > 0 && (
        <Card className="p-4 bg-red-50 border-red-200">
          <p className="text-red-800 font-medium">
            ⚠️ {overdueCount} tarefa(s) atrasada(s)
          </p>
        </Card>
      )}

      <Card className="p-6">
        <div className="flex gap-4 mb-6">
          <Input
            placeholder="Buscar..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="pending">Pendentes</SelectItem>
              <SelectItem value="completed">Concluídas</SelectItem>
              <SelectItem value="overdue">Atrasadas</SelectItem>
            </SelectContent>
          </Select>

          <Select value={responsibleFilter} onValueChange={setResponsibleFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Responsável" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {responsibles.map((r) => (
                <SelectItem key={r.id} value={r.id}>
                  {r.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-3">
          {filteredTasks.map((task) => (
            <div
              key={task.id}
              className="p-4 border rounded-lg cursor-pointer hover:bg-gray-50"
              onClick={() => navigate(`/tarefa/${task.id}`)}
            >
              <div className="flex justify-between">
                <div>
                  <h3 className="font-semibold">{task.title}</h3>
                  <p className="text-sm text-gray-500">{task.description}</p>
                  <p className="text-xs mt-1">
                    {task.responsible_name} •{' '}
                    {new Date(task.deadline).toLocaleTimeString('pt-BR')}
                  </p>
                </div>

                <span className={`px-2 py-1 rounded text-xs ${getStatusColor(task.status)}`}>
                  {getStatusText(task.status)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}