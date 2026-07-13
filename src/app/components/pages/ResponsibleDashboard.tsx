import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { CheckCircle, Clock, AlertCircle, Image } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import {
  priorityLabel,
  priorityBadgeClass,
  priorityBorderClass,
  sortByPriorityThenDeadline,
} from '../../lib/priority';

type Task = {
  id: string;
  title: string;
  description: string;
  responsible_id: string;
  responsible_name: string;
  deadline: string;
  date: string;
  status: 'pending' | 'completed' | 'overdue';
  completed_at: string | null;
  photo_url: string | null;
  priority?: number | null;
};

export function ResponsibleDashboard() {
  const navigate = useNavigate();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    loadUserAndTasks();
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
        .eq('recurring_parent_id', recurringTask.id)
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
          recurring_parent_id: recurringTask.id,
          priority: recurringTask.priority,
        })
        .select()
        .single();

      if (taskError || !newTask) {
        if (taskError?.code === '23505') {
          continue;
        }

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

  async function loadUserAndTasks() {
    const { data: authData } = await supabase.auth.getUser();

    if (!authData?.user) return;

    const userId = authData.user.id;

    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    setUser(profile);

    const today = new Date().toLocaleDateString('sv-SE', {
      timeZone: 'America/Sao_Paulo',
    });

    await generateTodayRecurringTasks(today);

    const { data: relations } = await supabase
      .from('task_responsibles')
      .select('task_id')
      .eq('responsible_id', userId);

    if (!relations || relations.length === 0) {
      setTasks([]);
      return;
    }

    const taskIds = relations.map((r) => r.task_id);

    const { data: tasksData } = await supabase
      .from('tasks')
      .select('*')
      .in('id', taskIds)
      .eq('date', today)
      .or('is_recurring.eq.false,is_recurring.is.null')
      .order('deadline');

    setTasks(sortByPriorityThenDeadline(tasksData || []));
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-700 border border-green-200 dark:bg-green-500/10 dark:text-green-400 dark:border-green-500/20';
      case 'overdue':
        return 'bg-red-100 text-red-700 border border-red-200 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20';
      default:
        return 'bg-yellow-100 text-yellow-700 border border-yellow-200 dark:bg-yellow-500/10 dark:text-yellow-300 dark:border-yellow-500/20';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />;
      case 'overdue':
        return <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />;
      default:
        return <Clock className="w-5 h-5 text-yellow-600 dark:text-yellow-300" />;
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
    <div className="space-y-6 min-h-screen bg-white text-gray-900 dark:bg-[#0B0B0B] dark:text-white p-6">
      <div>
        <h1 className="text-3xl font-semibold text-gray-900 dark:text-white">
          Olá, {user?.name}
        </h1>

        <p className="text-gray-500 dark:text-[#A1A1A1] mt-1">
          Você tem {tasks.length} tarefa(s) para hoje
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-5 bg-white dark:bg-[#121212] border border-gray-200 dark:border-[#1F1F1F] border-l-4 border-l-yellow-500">
          <p className="text-sm text-gray-600 dark:text-[#A1A1A1]">Pendentes</p>
          <p className="text-3xl font-semibold text-gray-900 dark:text-white">
            {tasks.filter((t) => t.status === 'pending').length}
          </p>
        </Card>

        <Card className="p-5 bg-white dark:bg-[#121212] border border-gray-200 dark:border-[#1F1F1F] border-l-4 border-l-green-500">
          <p className="text-sm text-gray-600 dark:text-[#A1A1A1]">Concluídas</p>
          <p className="text-3xl font-semibold text-gray-900 dark:text-white">
            {tasks.filter((t) => t.status === 'completed').length}
          </p>
        </Card>

        <Card className="p-5 bg-white dark:bg-[#121212] border border-gray-200 dark:border-[#1F1F1F] border-l-4 border-l-red-500">
          <p className="text-sm text-gray-600 dark:text-[#A1A1A1]">Atrasadas</p>
          <p className="text-3xl font-semibold text-gray-900 dark:text-white">
            {tasks.filter((t) => t.status === 'overdue').length}
          </p>
        </Card>
      </div>

      <div>
        <h2 className="text-xl font-semibold mb-1 text-gray-900 dark:text-white">
          Minhas Tarefas
        </h2>

        {tasks.length > 0 && (
          <p className="text-sm text-gray-500 dark:text-[#A1A1A1] mb-4">
            Ordenadas por prioridade — comece pelas do topo.
          </p>
        )}

        {tasks.length === 0 ? (
          <Card className="p-12 text-center bg-white dark:bg-[#121212] border border-gray-200 dark:border-[#1F1F1F]">
            <CheckCircle className="w-12 h-12 mx-auto mb-3 text-green-500 dark:text-green-400" />
            <p className="text-gray-600 dark:text-[#A1A1A1]">Nenhuma tarefa para hoje</p>
          </Card>
        ) : (
          tasks.map((task) => (
            <Card
              key={task.id}
              className={`p-5 bg-white dark:bg-[#121212] border border-gray-200 dark:border-[#1F1F1F] hover:border-gray-300 dark:hover:border-[#2A2A2A] transition-all duration-300 ${priorityBorderClass(task.priority)}`}
            >
              <div className="flex justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {getStatusIcon(task.status)}

                    <h3 className="font-semibold text-gray-900 dark:text-white">
                      {task.title}
                    </h3>

                    <span className={`px-2 py-1 text-xs rounded ${getStatusColor(task.status)}`}>
                      {getStatusText(task.status)}
                    </span>

                    <span className={`px-2 py-1 text-xs rounded-full font-medium ${priorityBadgeClass(task.priority)}`}>
                      {priorityLabel(task.priority)}
                    </span>
                  </div>

                  <p className="text-sm text-gray-600 dark:text-[#A1A1A1] mt-2">
                    {task.description}
                  </p>

                  <p className="text-sm text-gray-500 dark:text-[#707070] mt-2">
                    Prazo:{' '}
                    {new Date(task.deadline).toLocaleTimeString('pt-BR', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
              </div>

              <div className="flex gap-2 mt-3">
                {task.status !== 'completed' && (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => navigate(`/tarefa/${task.id}`)}
                      className="bg-white border-gray-300 text-gray-900 hover:bg-gray-100 dark:bg-[#181818] dark:border-[#2A2A2A] dark:text-white dark:hover:bg-[#242424]"
                    >
                      <Image className="w-4 h-4 mr-2" />
                      Enviar Foto
                    </Button>

                    <Button
                      size="sm"
                      onClick={() => navigate(`/tarefa/${task.id}`)}
                      className="bg-gray-900 text-white hover:bg-black dark:bg-white dark:text-black dark:hover:bg-[#E5E5E5]"
                    >
                      Concluir
                    </Button>
                  </>
                )}

                {task.status === 'completed' && (
                  <span className="text-green-600 dark:text-green-400 text-sm">
                    ✔ Concluída às{' '}
                    {task.completed_at &&
                      new Date(task.completed_at).toLocaleTimeString('pt-BR')}
                  </span>
                )}
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
