import { useEffect, useState } from 'react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { supabase } from '../../lib/supabase';
import { toast } from 'sonner';

type Responsible = {
  id: string;
  name: string;
};

type RecurringTask = {
  id: string;
  title: string;
  description: string;
  responsible_id: string;
  responsible_name: string;
  recurring_deadline: string | null;
};

export function TransferRecurringTasks() {
  const [responsibles, setResponsibles] = useState<Responsible[]>([]);
  const [tasks, setTasks] = useState<RecurringTask[]>([]);
  const [selectedTaskId, setSelectedTaskId] = useState('');
  const [newResponsibleId, setNewResponsibleId] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const { data: responsiblesData, error: responsiblesError } = await supabase
      .from('profiles')
      .select('id, name')
      .eq('role', 'responsible')
      .order('name');

    if (responsiblesError) {
      toast.error('Erro ao carregar responsáveis');
      return;
    }

    const { data: tasksData, error: tasksError } = await supabase
      .from('tasks')
      .select('id, title, description, responsible_id, responsible_name, recurring_deadline')
      .eq('is_recurring', true)
      .order('title');

    if (tasksError) {
      toast.error('Erro ao carregar demandas fixas');
      return;
    }

    setResponsibles(responsiblesData || []);
    setTasks(tasksData || []);
  }

  const selectedTask = tasks.find((task) => task.id === selectedTaskId);
  const newResponsible = responsibles.find((resp) => resp.id === newResponsibleId);

  async function handleTransfer() {
    if (!selectedTask || !newResponsible) {
      toast.error('Selecione a demanda fixa e o novo responsável');
      return;
    }

    if (selectedTask.responsible_id === newResponsible.id) {
      toast.error('Essa demanda já está com esse responsável');
      return;
    }

    const confirmTransfer = window.confirm(
      `Transferir a demanda fixa "${selectedTask.title}" de "${selectedTask.responsible_name}" para "${newResponsible.name}"?\n\nO histórico antigo será mantido. As próximas repetições serão geradas para o novo responsável.`
    );

    if (!confirmTransfer) return;

    setLoading(true);

    const { error: taskError } = await supabase
      .from('tasks')
      .update({
        responsible_id: newResponsible.id,
        responsible_name: newResponsible.name,
      })
      .eq('id', selectedTask.id)
      .eq('is_recurring', true);

    if (taskError) {
      toast.error(taskError.message || 'Erro ao transferir demanda fixa');
      setLoading(false);
      return;
    }

    await supabase
      .from('task_responsibles')
      .delete()
      .eq('task_id', selectedTask.id);

    const { error: relationError } = await supabase
      .from('task_responsibles')
      .insert({
        task_id: selectedTask.id,
        responsible_id: newResponsible.id,
        responsible_name: newResponsible.name,
      });

    if (relationError) {
      toast.error(relationError.message || 'Erro ao atualizar vínculo do responsável');
      setLoading(false);
      return;
    }

    toast.success('Demanda fixa transferida com sucesso!');

    setSelectedTaskId('');
    setNewResponsibleId('');
    setLoading(false);

    await loadData();
  }

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-gray-900 dark:text-white">
          Transferir Demandas Fixas
        </h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          Use esta tela quando houver mudança de responsabilidade entre os usuários.
        </p>
      </div>

      <Card className="p-6 space-y-6">
        <div className="rounded-lg border bg-blue-50 dark:bg-blue-950/40 border-blue-100 dark:border-blue-900 p-4">
          <p className="text-sm text-blue-800 dark:text-blue-300">
            A transferência altera apenas a demanda fixa original. O histórico dos dias anteriores continua com o responsável antigo. As próximas tarefas diárias serão criadas para o novo responsável.
          </p>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Demanda fixa
          </label>

          <Select value={selectedTaskId} onValueChange={setSelectedTaskId}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione uma demanda fixa" />
            </SelectTrigger>

            <SelectContent>
              {tasks.map((task) => (
                <SelectItem key={task.id} value={task.id}>
                  {task.title} — {task.responsible_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {selectedTask && (
          <div className="rounded-lg border bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 p-4">
            <p className="font-semibold text-gray-900 dark:text-white">
              {selectedTask.title}
            </p>

            <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
              {selectedTask.description}
            </p>

            <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
              Responsável atual: {selectedTask.responsible_name}
            </p>

            <p className="text-sm text-gray-500 dark:text-gray-400">
              Horário limite: {selectedTask.recurring_deadline || '-'}
            </p>
          </div>
        )}

        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Novo responsável
          </label>

          <Select value={newResponsibleId} onValueChange={setNewResponsibleId}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione o novo responsável" />
            </SelectTrigger>

            <SelectContent>
              {responsibles.map((resp) => (
                <SelectItem key={resp.id} value={resp.id}>
                  {resp.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex justify-end">
          <Button
            type="button"
            onClick={handleTransfer}
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {loading ? 'Transferindo...' : 'Transferir demanda fixa'}
          </Button>
        </div>
      </Card>
    </div>
  );
}