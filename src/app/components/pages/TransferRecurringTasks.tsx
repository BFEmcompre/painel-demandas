import { useEffect, useMemo, useState } from 'react';
import { ArrowRightLeft, CalendarClock, RefreshCw, Search, UserRoundCheck, UserRoundPlus, X, Zap } from 'lucide-react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Checkbox } from '../ui/checkbox';
import { Label } from '../ui/label';
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
  responsible_id: string | null;
  responsible_name: string | null;
  recurring_deadline: string | null;
  responsible_ids: string[];
  responsible_names: string[];
};

type TransferLog = {
  id: string;
  task_id: string;
  task_title: string;
  from_responsible_name: string;
  to_responsible_name: string;
  transferred_at: string;
};

type TaskResponsibleRow = {
  task_id: string;
  responsible_id: string;
  responsible_name: string;
};

type OpenTask = {
  id: string;
  title: string;
  is_recurring: boolean;
};

type BackupAssignment = {
  id: string;
  from_responsible_name: string;
  backup_responsible_name: string;
  task_ids: string[];
  effective_date: string | null;
  status: 'pending' | 'executed' | 'cancelled';
  created_at: string;
  executed_at: string | null;
};

export function TransferRecurringTasks() {
  const [responsibles, setResponsibles] = useState<Responsible[]>([]);
  const [tasks, setTasks] = useState<RecurringTask[]>([]);
  const [logs, setLogs] = useState<TransferLog[]>([]);
  const [responsibleFilter, setResponsibleFilter] = useState('all');
  const [selectedTaskId, setSelectedTaskId] = useState('');
  const [newResponsibleId, setNewResponsibleId] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(false);

  const [absentId, setAbsentId] = useState('');
  const [backupUserId, setBackupUserId] = useState('');
  const [openTasks, setOpenTasks] = useState<OpenTask[]>([]);
  const [loadingOpenTasks, setLoadingOpenTasks] = useState(false);
  const [selectedBackupTaskIds, setSelectedBackupTaskIds] = useState<string[]>([]);
  const [scheduleMode, setScheduleMode] = useState<'now' | 'scheduled'>('now');
  const [effectiveDate, setEffectiveDate] = useState('');
  const [savingBackup, setSavingBackup] = useState(false);
  const [backupAssignments, setBackupAssignments] = useState<BackupAssignment[]>([]);

  useEffect(() => {
    void loadData();
    void loadBackupAssignments();
  }, []);

  useEffect(() => {
    setSelectedBackupTaskIds([]);
    if (!absentId) {
      setOpenTasks([]);
      return;
    }
    void loadOpenTasksFor(absentId);
  }, [absentId]);

  async function loadOpenTasksFor(personId: string) {
    setLoadingOpenTasks(true);

    const { data: relations, error: relationsError } = await supabase
      .from('task_responsibles')
      .select('task_id')
      .eq('responsible_id', personId);

    if (relationsError) {
      toast.error(relationsError.message || 'Erro ao carregar tarefas da pessoa.');
      setOpenTasks([]);
      setLoadingOpenTasks(false);
      return;
    }

    const taskIds = Array.from(new Set((relations || []).map((row) => row.task_id)));
    if (taskIds.length === 0) {
      setOpenTasks([]);
      setLoadingOpenTasks(false);
      return;
    }

    const { data: taskRows, error: tasksError } = await supabase
      .from('tasks')
      .select('id, title, is_recurring, status')
      .in('id', taskIds)
      .neq('status', 'completed')
      .order('title');

    if (tasksError) {
      toast.error(tasksError.message || 'Erro ao carregar tarefas da pessoa.');
      setOpenTasks([]);
      setLoadingOpenTasks(false);
      return;
    }

    setOpenTasks(
      (taskRows || []).map((task) => ({
        id: task.id,
        title: task.title,
        is_recurring: Boolean(task.is_recurring),
      })),
    );
    setLoadingOpenTasks(false);
  }

  async function loadBackupAssignments() {
    const { data, error } = await supabase
      .from('user_backup_assignments')
      .select('id, from_responsible_name, backup_responsible_name, task_ids, effective_date, status, created_at, executed_at')
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) return;
    setBackupAssignments((data || []) as BackupAssignment[]);
  }

  function toggleBackupTask(taskId: string) {
    setSelectedBackupTaskIds((current) =>
      current.includes(taskId) ? current.filter((id) => id !== taskId) : [...current, taskId],
    );
  }

  async function handleConfirmBackup() {
    const absent = responsibles.find((resp) => resp.id === absentId);
    const backup = responsibles.find((resp) => resp.id === backupUserId);

    if (!absent || !backup) {
      toast.error('Selecione quem vai se ausentar e quem assume o backup.');
      return;
    }

    if (absent.id === backup.id) {
      toast.error('O backup precisa ser uma pessoa diferente.');
      return;
    }

    if (selectedBackupTaskIds.length === 0) {
      toast.error('Selecione pelo menos uma tarefa para o backup.');
      return;
    }

    if (scheduleMode === 'scheduled' && !effectiveDate) {
      toast.error('Escolha a data em que o backup deve entrar em vigor.');
      return;
    }

    setSavingBackup(true);

    try {
      const { data: authData } = await supabase.auth.getUser();

      const { data: inserted, error: insertError } = await supabase
        .from('user_backup_assignments')
        .insert({
          from_responsible_id: absent.id,
          from_responsible_name: absent.name,
          backup_responsible_id: backup.id,
          backup_responsible_name: backup.name,
          task_ids: selectedBackupTaskIds,
          effective_date: scheduleMode === 'scheduled' ? effectiveDate : null,
          created_by: authData.user?.id || null,
        })
        .select('id')
        .single();

      if (insertError) throw insertError;

      if (scheduleMode === 'now') {
        const { error: execError } = await supabase.rpc('execute_backup_assignment', {
          p_assignment_id: inserted.id,
        });
        if (execError) throw execError;
        toast.success(`Backup aplicado — ${backup.name} assumiu ${selectedBackupTaskIds.length} tarefa(s) de ${absent.name}.`);
      } else {
        toast.success(`Backup programado para ${new Date(`${effectiveDate}T00:00:00`).toLocaleDateString('pt-BR')}.`);
      }

      setAbsentId('');
      setBackupUserId('');
      setSelectedBackupTaskIds([]);
      setEffectiveDate('');
      setScheduleMode('now');
      await Promise.all([loadData(), loadBackupAssignments()]);
    } catch (error: any) {
      toast.error(error?.message || 'Não foi possível salvar o backup.');
    } finally {
      setSavingBackup(false);
    }
  }

  async function handleCancelBackup(id: string) {
    if (!window.confirm('Cancelar este backup programado?')) return;

    const { error } = await supabase
      .from('user_backup_assignments')
      .update({ status: 'cancelled' })
      .eq('id', id)
      .eq('status', 'pending');

    if (error) {
      toast.error(error.message || 'Não foi possível cancelar.');
      return;
    }

    toast.success('Backup cancelado.');
    await loadBackupAssignments();
  }

  function formatDateBR(value: string | null) {
    if (!value) return '-';
    return new Date(`${value}T00:00:00`).toLocaleDateString('pt-BR');
  }

  async function loadData() {
    setLoadingData(true);

    const [{ data: responsiblesData, error: responsiblesError }, { data: tasksData, error: tasksError }, { data: logsData }] = await Promise.all([
      supabase
        .from('profiles')
        .select('id, name')
        .eq('role', 'responsible')
        .order('name'),
      supabase
        .from('tasks')
        .select('id, title, description, responsible_id, responsible_name, recurring_deadline')
        .eq('is_recurring', true)
        .order('title'),
      supabase
        .from('recurring_task_transfer_logs')
        .select('*')
        .order('transferred_at', { ascending: false })
        .limit(20),
    ]);

    if (responsiblesError) {
      toast.error(responsiblesError.message || 'Erro ao carregar responsáveis.');
      setLoadingData(false);
      return;
    }

    if (tasksError) {
      toast.error(tasksError.message || 'Erro ao carregar demandas fixas.');
      setLoadingData(false);
      return;
    }

    const baseTasks = tasksData || [];
    const taskIds = baseTasks.map((task) => task.id);
    let relationRows: TaskResponsibleRow[] = [];

    if (taskIds.length > 0) {
      const { data: relations, error: relationsError } = await supabase
        .from('task_responsibles')
        .select('task_id, responsible_id, responsible_name')
        .in('task_id', taskIds);

      if (relationsError) {
        toast.error(relationsError.message || 'Erro ao carregar vínculos das demandas fixas.');
      } else {
        relationRows = (relations || []) as TaskResponsibleRow[];
      }
    }

    const nextTasks = baseTasks.map((task) => {
      const relations = relationRows.filter((row) => row.task_id === task.id);
      const ids = relations.map((row) => row.responsible_id).filter(Boolean);
      const names = relations.map((row) => row.responsible_name).filter(Boolean);

      if (task.responsible_id && !ids.includes(task.responsible_id)) ids.unshift(task.responsible_id);
      if (task.responsible_name && names.length === 0) {
        task.responsible_name.split(',').map((name) => name.trim()).filter(Boolean).forEach((name) => names.push(name));
      }

      return {
        ...task,
        responsible_ids: Array.from(new Set(ids)),
        responsible_names: Array.from(new Set(names)),
      } as RecurringTask;
    });

    setResponsibles((responsiblesData || []) as Responsible[]);
    setTasks(nextTasks);
    setLogs((logsData || []) as TransferLog[]);
    setLoadingData(false);
  }

  const filteredTasks = useMemo(() => {
    if (responsibleFilter === 'all') return tasks;
    return tasks.filter((task) => task.responsible_ids.includes(responsibleFilter));
  }, [tasks, responsibleFilter]);

  const selectedTask = tasks.find((task) => task.id === selectedTaskId);
  const newResponsible = responsibles.find((resp) => resp.id === newResponsibleId);
  const sourceResponsibleId = selectedTask
    ? (responsibleFilter !== 'all' ? responsibleFilter : selectedTask.responsible_id)
    : null;
  const sourceResponsible = responsibles.find((resp) => resp.id === sourceResponsibleId);

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

  async function replaceResponsibleOnTask(taskId: string, oldResponsibleId: string, replacement: Responsible) {
    const { data: relationData, error: relationLoadError } = await supabase
      .from('task_responsibles')
      .select('responsible_id, responsible_name')
      .eq('task_id', taskId);

    if (relationLoadError) throw relationLoadError;

    const currentRelations = relationData || [];
    const sourceExists = currentRelations.some((row) => row.responsible_id === oldResponsibleId);
    const replacementAlreadyExists = currentRelations.some((row) => row.responsible_id === replacement.id);

    if (sourceExists) {
      const { error } = await supabase
        .from('task_responsibles')
        .delete()
        .eq('task_id', taskId)
        .eq('responsible_id', oldResponsibleId);
      if (error) throw error;
    }

    if (!replacementAlreadyExists) {
      const { error } = await supabase
        .from('task_responsibles')
        .insert({
          task_id: taskId,
          responsible_id: replacement.id,
          responsible_name: replacement.name,
        });
      if (error) throw error;
    }

    const { data: refreshedRelations, error: refreshedError } = await supabase
      .from('task_responsibles')
      .select('responsible_id, responsible_name')
      .eq('task_id', taskId);

    if (refreshedError) throw refreshedError;

    const finalRelations = refreshedRelations || [];
    const names = Array.from(new Set(finalRelations.map((row) => row.responsible_name).filter(Boolean)));

    const { data: taskRow, error: taskLoadError } = await supabase
      .from('tasks')
      .select('responsible_id')
      .eq('id', taskId)
      .single();

    if (taskLoadError) throw taskLoadError;

    let nextPrimaryId = taskRow.responsible_id;
    if (!nextPrimaryId || nextPrimaryId === oldResponsibleId) nextPrimaryId = replacement.id;
    if (!finalRelations.some((row) => row.responsible_id === nextPrimaryId)) {
      nextPrimaryId = finalRelations[0]?.responsible_id || replacement.id;
    }

    const { error: taskUpdateError } = await supabase
      .from('tasks')
      .update({
        responsible_id: nextPrimaryId,
        responsible_name: names.join(', ') || replacement.name,
      })
      .eq('id', taskId);

    if (taskUpdateError) throw taskUpdateError;
  }

  async function handleTransfer() {
    if (!selectedTask || !newResponsible || !sourceResponsibleId) {
      toast.error('Selecione a demanda fixa, o responsável atual e o novo responsável.');
      return;
    }

    if (sourceResponsibleId === newResponsible.id) {
      toast.error('Essa demanda já está vinculada a esse responsável.');
      return;
    }

    const sourceName = sourceResponsible?.name || selectedTask.responsible_names.find(Boolean) || selectedTask.responsible_name || 'Responsável atual';
    const confirmTransfer = window.confirm(
      `Transferir "${selectedTask.title}" de "${sourceName}" para "${newResponsible.name}"?\n\nA demanda fixa original e todas as ocorrências futuras ainda não concluídas serão atualizadas. O histórico já concluído será mantido.`
    );
    if (!confirmTransfer) return;

    setLoading(true);

    try {
      const { data: authData } = await supabase.auth.getUser();
      const today = getTodayBrazil();

      await replaceResponsibleOnTask(selectedTask.id, sourceResponsibleId, newResponsible);

      const { data: futureTasks, error: futureTasksError } = await supabase
        .from('tasks')
        .select('id')
        .eq('recurring_parent_id', selectedTask.id)
        .gte('date', today)
        .neq('status', 'completed');

      if (futureTasksError) throw futureTasksError;

      for (const childTask of futureTasks || []) {
        await replaceResponsibleOnTask(childTask.id, sourceResponsibleId, newResponsible);
      }

      const { error: logError } = await supabase
        .from('recurring_task_transfer_logs')
        .insert({
          task_id: selectedTask.id,
          task_title: selectedTask.title,
          from_responsible_id: sourceResponsibleId,
          from_responsible_name: sourceName,
          to_responsible_id: newResponsible.id,
          to_responsible_name: newResponsible.name,
          transferred_by: authData.user?.id || null,
          transferred_at: new Date().toISOString(),
        });

      if (logError) throw logError;

      toast.success('Demanda fixa transferida com sucesso.');
      setSelectedTaskId('');
      setNewResponsibleId('');
      await loadData();
    } catch (error: any) {
      toast.error(error?.message || 'Não foi possível transferir a demanda fixa.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flow-transfer-page max-w-6xl space-y-6 p-1">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="flow-kicker">ADMINISTRAÇÃO / ROTINAS</p>
          <h1 className="mt-1 text-3xl font-black">Transferir demandas fixas</h1>
          <p className="mt-1 text-sm text-[var(--ocean-muted)]">Localize as rotinas pelo responsável e transfira sem perder o histórico anterior.</p>
        </div>
        <Button type="button" variant="outline" className="flow-secondary-button" onClick={() => void loadData()} disabled={loadingData}>
          <RefreshCw className={`h-4 w-4 ${loadingData ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </div>

      <Card className="flow-ocean-card space-y-6 border-0 p-6">
        <div className="flow-transfer-info">
          <ArrowRightLeft className="h-5 w-5" />
          <p>A transferência altera o vínculo da rotina e também as ocorrências futuras que ainda não foram concluídas.</p>
        </div>

        <div className="grid gap-5 lg:grid-cols-3">
          <div className="space-y-2">
            <label className="text-sm font-bold">Responsável atual</label>
            <Select value={responsibleFilter} onValueChange={(value) => { setResponsibleFilter(value); setSelectedTaskId(''); }}>
              <SelectTrigger className="flow-input w-full"><SelectValue placeholder="Todos os responsáveis" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os responsáveis</SelectItem>
                {responsibles.map((resp) => <SelectItem key={resp.id} value={resp.id}>{resp.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-bold">Demanda fixa</label>
            <Select value={selectedTaskId} onValueChange={setSelectedTaskId}>
              <SelectTrigger className="flow-input w-full"><SelectValue placeholder="Selecione uma rotina" /></SelectTrigger>
              <SelectContent>
                {filteredTasks.length === 0 ? (
                  <SelectItem value="empty" disabled>Nenhuma demanda fixa encontrada</SelectItem>
                ) : filteredTasks.map((task) => (
                  <SelectItem key={task.id} value={task.id}>{task.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-bold">Novo responsável</label>
            <Select value={newResponsibleId} onValueChange={setNewResponsibleId}>
              <SelectTrigger className="flow-input w-full"><SelectValue placeholder="Selecione o novo responsável" /></SelectTrigger>
              <SelectContent>
                {responsibles.filter((resp) => resp.id !== sourceResponsibleId).map((resp) => (
                  <SelectItem key={resp.id} value={resp.id}>{resp.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {selectedTask && (
          <div className="flow-transfer-selected">
            <div className="flow-transfer-selected-icon"><UserRoundCheck className="h-5 w-5" /></div>
            <div className="min-w-0 flex-1">
              <strong>{selectedTask.title}</strong>
              <p>{selectedTask.description || 'Sem descrição.'}</p>
              <small>Responsáveis atuais: {selectedTask.responsible_names.join(', ') || selectedTask.responsible_name || '-'}</small>
            </div>
            <span>{selectedTask.recurring_deadline?.slice(0, 5) || '--:--'}</span>
          </div>
        )}

        {tasks.length === 0 && !loadingData && (
          <div className="flow-transfer-empty">
            <Search className="h-5 w-5" />
            <div>
              <strong>Nenhuma rotina cadastrada.</strong>
              <p>Esta tela lista somente as demandas marcadas como tarefa fixa/recorrente.</p>
            </div>
          </div>
        )}

        <div className="flex justify-end">
          <Button type="button" onClick={() => void handleTransfer()} disabled={loading || !selectedTask || !newResponsible} className="flow-primary-button">
            <ArrowRightLeft className="h-4 w-4" />
            {loading ? 'Transferindo...' : 'Transferir rotina'}
          </Button>
        </div>
      </Card>

      <Card className="flow-ocean-card space-y-6 border-0 p-6">
        <div>
          <p className="flow-kicker">FÉRIAS / ATESTADO</p>
          <h2 className="mt-1 text-xl font-black">Backup por ausência</h2>
          <p className="mt-1 text-sm text-[var(--ocean-muted)]">
            Defina quem assume as tarefas de alguém enquanto essa pessoa está fora — na hora ou numa data programada.
          </p>
        </div>

        <div className="grid gap-5 lg:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-bold">Quem vai se ausentar</label>
            <Select value={absentId} onValueChange={setAbsentId}>
              <SelectTrigger className="flow-input w-full"><SelectValue placeholder="Selecione a pessoa" /></SelectTrigger>
              <SelectContent>
                {responsibles.map((resp) => <SelectItem key={resp.id} value={resp.id}>{resp.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-bold">Quem assume (backup)</label>
            <Select value={backupUserId} onValueChange={setBackupUserId}>
              <SelectTrigger className="flow-input w-full"><SelectValue placeholder="Selecione o backup" /></SelectTrigger>
              <SelectContent>
                {responsibles.filter((resp) => resp.id !== absentId).map((resp) => (
                  <SelectItem key={resp.id} value={resp.id}>{resp.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {absentId && (
          <div className="space-y-2">
            <label className="text-sm font-bold">Quais tarefas entram no backup</label>
            {loadingOpenTasks ? (
              <p className="text-sm text-[var(--ocean-muted)]">Carregando tarefas em aberto...</p>
            ) : openTasks.length === 0 ? (
              <div className="flow-transfer-empty">
                <Search className="h-5 w-5" />
                <div>
                  <strong>Nenhuma tarefa em aberto.</strong>
                  <p>Essa pessoa não tem demandas fixas ou avulsas pendentes no momento.</p>
                </div>
              </div>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {openTasks.map((task) => (
                  <label key={task.id} className="flow-choice-panel flex cursor-pointer items-center gap-3 !justify-start">
                    <Checkbox
                      checked={selectedBackupTaskIds.includes(task.id)}
                      onCheckedChange={() => toggleBackupTask(task.id)}
                    />
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold">{task.title}</span>
                    {task.is_recurring && <span className="flow-reward-points-badge text-[9px]">FIXA</span>}
                  </label>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="grid gap-5 sm:grid-cols-[auto_1fr] sm:items-end">
          <div className="space-y-2">
            <label className="text-sm font-bold">Quando</label>
            <div className="flow-choice-toggle">
              <button type="button" className={scheduleMode === 'now' ? 'is-active' : ''} onClick={() => setScheduleMode('now')}>
                <Zap className="mr-1 inline h-3.5 w-3.5" /> Agora
              </button>
              <button type="button" className={scheduleMode === 'scheduled' ? 'is-active' : ''} onClick={() => setScheduleMode('scheduled')}>
                <CalendarClock className="mr-1 inline h-3.5 w-3.5" /> Programar
              </button>
            </div>
          </div>

          {scheduleMode === 'scheduled' && (
            <div className="space-y-2">
              <Label htmlFor="backup-effective-date" className="text-sm font-bold">Data em que o backup entra em vigor</Label>
              <input
                id="backup-effective-date"
                type="date"
                value={effectiveDate}
                onChange={(event) => setEffectiveDate(event.target.value)}
                className="flow-input flex h-10 w-full rounded-md px-3"
              />
            </div>
          )}
        </div>

        <div className="flex justify-end">
          <Button
            type="button"
            onClick={() => void handleConfirmBackup()}
            disabled={savingBackup || !absentId || !backupUserId || selectedBackupTaskIds.length === 0}
            className="flow-primary-button"
          >
            <UserRoundPlus className="h-4 w-4" />
            {savingBackup ? 'Salvando...' : scheduleMode === 'now' ? 'Aplicar backup agora' : 'Programar backup'}
          </Button>
        </div>

        {backupAssignments.length > 0 && (
          <div className="grid gap-3 border-t border-white/10 pt-5">
            {backupAssignments.map((assignment) => (
              <div key={assignment.id} className="flow-transfer-log">
                <div>
                  <strong>{assignment.from_responsible_name} <span>→</span> {assignment.backup_responsible_name}</strong>
                  <p>
                    {assignment.task_ids.length} tarefa(s) ·{' '}
                    {assignment.status === 'pending'
                      ? `programado para ${formatDateBR(assignment.effective_date)}`
                      : assignment.status === 'executed'
                        ? `aplicado em ${formatDateTimeBR(assignment.executed_at)}`
                        : 'cancelado'}
                  </p>
                </div>
                {assignment.status === 'pending' ? (
                  <Button type="button" size="sm" variant="outline" className="flow-secondary-button" onClick={() => void handleCancelBackup(assignment.id)}>
                    <X className="h-3.5 w-3.5" /> Cancelar
                  </Button>
                ) : (
                  <small className={assignment.status === 'executed' ? 'is-active' : ''}>{assignment.status === 'executed' ? 'Aplicado' : 'Cancelado'}</small>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="flow-ocean-card border-0 p-6">
        <div className="mb-4">
          <h2 className="text-xl font-black">Últimas transferências</h2>
          <p className="mt-1 text-sm text-[var(--ocean-muted)]">Registro das mudanças de responsabilidade das rotinas.</p>
        </div>

        {logs.length === 0 ? (
          <p className="text-sm text-[var(--ocean-muted)]">Nenhuma transferência registrada ainda.</p>
        ) : (
          <div className="grid gap-3">
            {logs.map((log) => (
              <div key={log.id} className="flow-transfer-log">
                <div>
                  <strong>{log.task_title}</strong>
                  <p>{log.from_responsible_name} <span>→</span> {log.to_responsible_name}</p>
                </div>
                <small>{formatDateTimeBR(log.transferred_at)}</small>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
