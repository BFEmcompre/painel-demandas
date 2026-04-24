import { useEffect, useState } from 'react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Mail, MoreVertical, CheckCircle, Clock, Users } from 'lucide-react';
import { supabase } from '../../lib/supabase';

type Responsible = {
  id: string;
  name: string;
  username: string;
  email: string;
  tasksCount: number;
  completedCount: number;
};

export function Responsibles() {
  const [responsibles, setResponsibles] = useState<Responsible[]>([]);
  const [loading, setLoading] = useState(true);

  async function loadResponsibles() {
    setLoading(true);

    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, name, username, email')
      .eq('role', 'responsible')
      .order('name', { ascending: true });

    if (profilesError) {
      alert('Erro ao carregar responsáveis');
      setLoading(false);
      return;
    }

    const { data: tasks, error: tasksError } = await supabase
      .from('tasks')
      .select('responsible_id, status');

    if (tasksError) {
      alert('Erro ao carregar tarefas dos responsáveis');
      setLoading(false);
      return;
    }

    const result =
      profiles?.map((profile) => {
        const userTasks = tasks?.filter((task) => task.responsible_id === profile.id) || [];
        const completedTasks = userTasks.filter((task) => task.status === 'completed');

        return {
          id: profile.id,
          name: profile.name,
          username: profile.username,
          email: profile.email,
          tasksCount: userTasks.length,
          completedCount: completedTasks.length,
        };
      }) || [];

    setResponsibles(result);
    setLoading(false);
  }

  useEffect(() => {
    loadResponsibles();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-gray-900">Responsáveis</h1>
          <p className="text-gray-500 mt-1">Acompanhe os usuários cadastrados no sistema</p>
        </div>

        <Button
          type="button"
          onClick={loadResponsibles}
          className="bg-blue-600 hover:bg-blue-700"
        >
          Atualizar lista
        </Button>
      </div>

      {loading && (
        <Card className="p-6">
          <p className="text-gray-500">Carregando responsáveis...</p>
        </Card>
      )}

      {!loading && responsibles.length === 0 && (
        <Card className="p-10 flex flex-col items-center justify-center text-center">
          <Users className="w-12 h-12 text-gray-400 mb-3" />
          <h3 className="font-semibold text-gray-900">Nenhum responsável cadastrado</h3>
          <p className="text-gray-500 mt-1">
            Os responsáveis aparecerão aqui após criarem uma conta pelo primeiro acesso.
          </p>
        </Card>
      )}

      {!loading && responsibles.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {responsibles.map((resp) => {
            const progress =
              resp.tasksCount === 0
                ? 0
                : Math.round((resp.completedCount / resp.tasksCount) * 100);

            return (
              <Card key={resp.id} className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                      <span className="text-blue-600 font-semibold text-lg">
                        {resp.name.charAt(0).toUpperCase()}
                      </span>
                    </div>

                    <div>
                      <h3 className="font-semibold text-gray-900">{resp.name}</h3>
                      <p className="text-sm text-gray-500">@{resp.username}</p>
                    </div>
                  </div>

                  <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                    <MoreVertical className="w-5 h-5 text-gray-400" />
                  </button>
                </div>

                <div className="space-y-2 mb-4">
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Mail className="w-4 h-4" />
                    <span>{resp.email}</span>
                  </div>
                </div>

                <div className="pt-4 border-t border-gray-200">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center justify-center gap-1 mb-1">
                        <Clock className="w-4 h-4 text-gray-600" />
                      </div>
                      <p className="text-2xl font-semibold text-gray-900">{resp.tasksCount}</p>
                      <p className="text-xs text-gray-600 mt-1">Tarefas</p>
                    </div>

                    <div className="text-center p-3 bg-green-50 rounded-lg">
                      <div className="flex items-center justify-center gap-1 mb-1">
                        <CheckCircle className="w-4 h-4 text-green-600" />
                      </div>
                      <p className="text-2xl font-semibold text-green-600">
                        {resp.completedCount}
                      </p>
                      <p className="text-xs text-gray-600 mt-1">Concluídas</p>
                    </div>
                  </div>
                </div>

                <div className="mt-4">
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-green-500 h-2 rounded-full transition-all"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-600 mt-2 text-center">
                    {progress}% de conclusão
                  </p>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}