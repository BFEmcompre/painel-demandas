import { useEffect, useMemo, useState } from 'react';
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

type TransferLog = {
  id: string;
  task_id: string;
  task_title: string;
  from_responsible_name: string;
  to_responsible_name: string;
  transferred_at: string;
};

export function TransferRecurringTasks() {
  const [responsibles, setResponsibles] = useState<Responsible[]>([]);
  const [tasks, setTasks] = useState<RecurringTask[]>([]);
  const [logs, setLogs] = useState<TransferLog[]>([]);

  const [responsibleFilter, setResponsibleFilter] = useState('all');
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
      .order('responsible_name')
      .order('title');

    if (tasksError) {
      toast.error('Erro ao carregar demandas fixas');
      return;
    }

    const { data: logsData } = await supabase
      .from('recurring_task_transfer_logs')
      .select('*')
      .order('transferred_at', { ascending: false })
      .limit(20);

    setResponsibles(responsiblesData || []);
    setTasks(tasksData || []);
    setLogs(logsData || []);
  }

  const filteredTasks = useMemo(() => {
    if (responsibleFilter === 'all') return tasks;

    return tasks.filter((task) => task.responsible_id === responsibleFilter);
  }, [tasks, responsibleFilter]);

  const selectedTask = tasks.find((task) => task.id === selectedTaskId);
  const newResponsible = responsibles.find((resp) => resp.id === newResponsibleId);

  function formatDateTimeBR(value: string | null | undefined) {
    if (!value) return '-';

    const normalizedValue = value.endsWith('Z') ? value : `${value}Z`;

    return new Date(normalizedValue).toLocaleString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  function getTodayBrazil() {
    return new Date().toLocaleDateString('sv-SE', {
      timeZone: 'America/Sao_Paulo',
    });
  }

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
      `Transferir a demanda fixa "${selectedTask.title}" de "${selectedTask.responsible_name}" para "${newResponsible.name}"?\n\nO histórico antigo será mantido. A tarefa de hoje, se existir e ainda não estiver concluída, também será transferida para o novo responsável.`
    );

    if (!confirmTransfer) return;

    setLoading(true);

    const { data: authData } = await supabase.auth.getUser();
    const today = getTodayBrazil();

    const oldResponsibleId = selectedTask.responsible_id;
    const oldResponsibleName = selectedTask.responsible_name;

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
      toast.error(relationError.message || 'Erro ao atualizar vínculo da demanda fixa');
      setLoading(false);
      return;
    }

    const { data: todayTask } = await supabase
      .from('tasks')
      .select('id, status')
      .eq('recurring_parent_id', selectedTask.id)
      .eq('date', today)
      .maybeSingle();

    if (todayTask && todayTask.status !== 'completed') {
      const { error: todayTaskError } = await supabase
        .from('tasks')
        .update({
          responsible_id: newResponsible.id,
          responsible_name: newResponsible.name,
        })
        .eq('id', todayTask.id);

      if (todayTaskError) {
        toast.error(todayTaskError.message || 'Demanda fixa transferida, mas erro ao transferir tarefa de hoje');
        setLoading(false);
        return;
      }

      await supabase
        .from('task_responsibles')
        .delete()
        .eq('task_id', todayTask.id);

      const { error: todayRelationError } = await supabase
        .from('task_responsibles')
        .insert({
          task_id: todayTask.id,
          responsible_id: newResponsible.id,
          responsible_name: newResponsible.name,
        });

      if (todayRelationError) {
        toast.error(todayRelationError.message || 'Erro ao atualizar vínculo da tarefa de hoje');
        setLoading(false);
        return;
      }
    }

    await supabase.from('recurring_task_transfer_logs').insert({
      task_id: selectedTask.id,
      task_title: selectedTask.title,
      from_responsible_id: oldResponsibleId,
      from_responsible_name: oldResponsibleName,
      to_responsible_id: newResponsible.id,
      to_responsible_name: newResponsible.name,
      transferred_by: authData.user?.id || null,
      transferred_at: new Date().toISOString(),
    });

    toast.success('Demanda fixa transferida com sucesso!');

    setSelectedTaskId('');
    setNewResponsibleId('');
    setLoading(false);

    await loadData();
  }

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-gray-900 dark:text-white">
          Transferir Demandas Fixas
        </h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          Use esta tela quando houver mudança de responsabilidade entre os usuários.
        </p>
      </div>

      <Card className="p-6 space-y-6 bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800">
        <div className="rounded-lg border bg-blue-50 dark:bg-blue-950/40 border-blue-100 dark:border-blue-900 p-4">
          <p className="text-sm text-blue-800 dark:text-blue-300">
            A transferência altera a demanda fixa original e também transfere a tarefa de hoje, caso ela exista e ainda não esteja concluída. O histórico antigo continua com o responsável anterior.
          </p>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Filtrar demandas fixas por responsável
          </label>

          <Select
            value={responsibleFilter}
            onValueChange={(value) => {
              setResponsibleFilter(value);
              setSelectedTaskId('');
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Todos os responsáveis" />
            </SelectTrigger>

            <SelectContent>
              <SelectItem value="all">Todos os responsáveis</SelectItem>

              {responsibles.map((resp) => (
                <SelectItem key={resp.id} value={resp.id}>
                  {resp.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
              {filteredTasks.length === 0 ? (
                <SelectItem value="empty" disabled>
                  Nenhuma demanda fixa encontrada
                </SelectItem>
              ) : (
                filteredTasks.map((task) => (
                  <SelectItem key={task.id} value={task.id}>
                    {task.title} — {task.responsible_name}
                  </SelectItem>
                ))
              )}
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

      <Card className="p-6 bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800">
        <div className="mb-4">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Log de transferências
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Últimas transferências realizadas.
          </p>
        </div>

        {logs.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Nenhuma transferência registrada ainda.
          </p>
        ) : (
          <div className="space-y-3">
            {logs.map((log) => (
              <div
                key={log.id}
                className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-4"
              >
                <p className="font-medium text-gray-900 dark:text-white">
                  {log.task_title}
                </p>

                <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                  {log.from_responsible_name} → {log.to_responsible_name}
                </p>

                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                  Transferida em: {formatDateTimeBR(log.transferred_at)}
                </p>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}