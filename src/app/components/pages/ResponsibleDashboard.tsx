import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { CheckCircle, Clock, AlertCircle, Image } from 'lucide-react';
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
  completed_at: string | null;
  photo_url: string | null;
};

export function ResponsibleDashboard() {
  const navigate = useNavigate();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    loadUserAndTasks();
  }, []);

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

  const today = new Date().toISOString().split('T')[0];

  // 🔥 1. Buscar vínculos do usuário com tarefas
  const { data: relations } = await supabase
    .from('task_responsibles')
    .select('task_id')
    .eq('responsible_id', userId);

  if (!relations || relations.length === 0) {
    setTasks([]);
    return;
  }

  const taskIds = relations.map((r) => r.task_id);

  // 🔥 2. Buscar tarefas reais
  const { data: tasksData } = await supabase
    .from('tasks')
    .select('*')
    .in('id', taskIds)
    .eq('date', today)
    .order('deadline');

  setTasks(tasksData || []);
}

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

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'overdue':
        return <AlertCircle className="w-5 h-5 text-red-600" />;
      default:
        return <Clock className="w-5 h-5 text-yellow-600" />;
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
      <div>
        <h1 className="text-3xl font-semibold text-gray-900">
          Olá, {user?.name}
        </h1>
        <p className="text-gray-500 mt-1">
          Você tem {tasks.length} tarefa(s) para hoje
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-5 border-l-4 border-l-yellow-500">
          <p className="text-sm text-gray-600">Pendentes</p>
          <p className="text-3xl font-semibold">
            {tasks.filter((t) => t.status === 'pending').length}
          </p>
        </Card>

        <Card className="p-5 border-l-4 border-l-green-500">
          <p className="text-sm text-gray-600">Concluídas</p>
          <p className="text-3xl font-semibold">
            {tasks.filter((t) => t.status === 'completed').length}
          </p>
        </Card>

        <Card className="p-5 border-l-4 border-l-red-500">
          <p className="text-sm text-gray-600">Atrasadas</p>
          <p className="text-3xl font-semibold">
            {tasks.filter((t) => t.status === 'overdue').length}
          </p>
        </Card>
      </div>

      <div>
        <h2 className="text-xl font-semibold mb-4">Minhas Tarefas</h2>

        {tasks.length === 0 ? (
          <Card className="p-12 text-center">
            <CheckCircle className="w-12 h-12 mx-auto mb-3 text-green-500" />
            <p>Nenhuma tarefa para hoje</p>
          </Card>
        ) : (
          tasks.map((task) => (
            <Card key={task.id} className="p-5">
              <div className="flex justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2">
                    {getStatusIcon(task.status)}
                    <h3 className="font-semibold">{task.title}</h3>
                    <span className={`px-2 py-1 text-xs rounded ${getStatusColor(task.status)}`}>
                      {getStatusText(task.status)}
                    </span>
                  </div>

                  <p className="text-sm text-gray-600 mt-2">{task.description}</p>

                  <p className="text-sm text-gray-500 mt-2">
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
                    >
                      <Image className="w-4 h-4 mr-2" />
                      Enviar Foto
                    </Button>

                    <Button
                      size="sm"
                      onClick={() => navigate(`/tarefa/${task.id}`)}
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      Concluir
                    </Button>
                  </>
                )}

                {task.status === 'completed' && (
                  <span className="text-green-600 text-sm">
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