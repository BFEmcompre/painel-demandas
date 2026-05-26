import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Checkbox } from '../ui/checkbox';
import { Textarea } from '../ui/textarea';
import { Label } from '../ui/label';
import {
  ArrowLeft,
  Upload,
  CheckCircle,
  Clock,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../../lib/supabase';

type Task = {
  id: string;
  title: string;
  description: string;
  responsible_name: string;
  deadline: string;
  date: string;
  status: 'pending' | 'completed' | 'overdue';
  completed_at: string | null;
  photo_url: string | null;
  observation: string | null;
  recurring_parent_id?: string | null;
  is_recurring?: boolean | null;
};

type ChecklistItem = {
  id: string;
  text: string;
  completed: boolean;
};

type TaskPhoto = {
  id: string;
  photo_url: string;
};

type NewPhoto = {
  file: File;
  preview: string;
};

export function TaskDetails() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [task, setTask] = useState<Task | null>(null);
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [savedPhotos, setSavedPhotos] = useState<TaskPhoto[]>([]);
  const [newPhotos, setNewPhotos] = useState<NewPhoto[]>([]);
  const [observation, setObservation] = useState('');
  const [editingTask, setEditingTask] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editDeadline, setEditDeadline] = useState('');

  const [isAdmin, setIsAdmin] = useState(false);
  const [logs, setLogs] = useState<any[]>([]);

  const [updatingChecklistId, setUpdatingChecklistId] =
    useState<string | null>(null);

  const [clickedChecklistId, setClickedChecklistId] =
    useState<string | null>(null);

  const [hoveredLogItemId, setHoveredLogItemId] =
    useState<string | null>(null);

  const [pinnedLogItemId, setPinnedLogItemId] =
    useState<string | null>(null);

  useEffect(() => {
    loadTask();
  }, []);

  async function loadTask() {
    const { data: authData } = await supabase.auth.getUser();

    if (authData?.user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', authData.user.id)
        .single();

      const admin = ['admin', 'manager', 'gestor'].includes(
        String(profile?.role).toLowerCase()
      );

      setIsAdmin(admin);
    }

    const { data: logsData } = await supabase
      .from('checklist_item_logs')
      .select('*')
      .eq('task_id', id)
      .order('created_at', { ascending: false });

    setLogs(logsData || []);

    const { data: taskData } = await supabase
      .from('tasks')
      .select('*')
      .eq('id', id)
      .single();

    const { data: checklistData } = await supabase
      .from('checklist_items')
      .select('*')
      .eq('task_id', id);

    const { data: photosData } = await supabase
      .from('task_photos')
      .select('id, photo_url')
      .eq('task_id', id)
      .order('created_at', { ascending: true });

    setTask(taskData);
    setChecklist(checklistData || []);
    setSavedPhotos(photosData || []);
    setObservation(taskData?.observation || '');
    setEditTitle(taskData?.title || '');
    setEditDescription(taskData?.description || '');
    setEditDeadline(taskData?.deadline?.split('T')[1]?.slice(0, 5) || '');

  }

  if (!task) {
    return (
      <p className="text-gray-600 dark:text-[#A1A1A1]">
        Carregando...
      </p>
    );
  }

  const handlePhotoUpload = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const files = Array.from(e.target.files || []);

    if (files.length === 0) return;

    const photos = files.map((file) => ({
      file,
      preview: URL.createObjectURL(file),
    }));

    setNewPhotos((current) => [...current, ...photos]);

    toast.success(`${files.length} foto(s) adicionada(s)`);
  };

  const removeNewPhoto = (index: number) => {
    setNewPhotos((current) =>
      current.filter((_, i) => i !== index)
    );
  };

  const toggleChecklist = async (
    itemId: string,
    current: boolean
  ) => {
    if (!task || updatingChecklistId === itemId) return;

    const nextValue = !current;

    setUpdatingChecklistId(itemId);
    setClickedChecklistId(itemId);

    setChecklist((currentItems) =>
      currentItems.map((item) =>
        item.id === itemId
          ? { ...item, completed: nextValue }
          : item
      )
    );

    setTimeout(() => {
      setClickedChecklistId((currentId) =>
        currentId === itemId ? null : currentId
      );
    }, 500);

    try {
      const { data: authData } =
        await supabase.auth.getUser();

      if (!authData?.user) {
        throw new Error('Usuário não autenticado');
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('name')
        .eq('id', authData.user.id)
        .single();

      const { error: updateError } = await supabase
        .from('checklist_items')
        .update({ completed: nextValue })
        .eq('id', itemId);

      if (updateError) {
        throw updateError;
      }

      const { error: logError } = await supabase
        .from('checklist_item_logs')
        .insert({
          checklist_item_id: itemId,
          task_id: task.id,
          user_id: authData.user.id,
          user_name: profile?.name || 'Usuário',
          action: nextValue ? 'marcou' : 'desmarcou',
        });

      if (logError) {
        console.error(logError);
      }

      await loadTask();
    } catch (error: any) {
      setChecklist((currentItems) =>
        currentItems.map((item) =>
          item.id === itemId
            ? { ...item, completed: current }
            : item
        )
      );

      toast.error(
        error?.message || 'Erro ao atualizar checklist'
      );
    } finally {
      setUpdatingChecklistId(null);
    }
  };

  const handleCompleteTask = async () => {
    if (isReadOnlyFixedDailyTask) {
      toast.error(
        'Essa tarefa fixa diária é de um dia anterior e está disponível apenas para consulta.'
      );

      return;
    }

    const hasAnyPhoto =
      savedPhotos.length > 0 || newPhotos.length > 0;

    if (!hasAnyPhoto) {
      toast.error(
        'Envie pelo menos uma foto antes de concluir'
      );

      return;
    }

    const hasIncompleteChecklist = checklist.some(
      (item) => !item.completed
    );

    if (hasIncompleteChecklist) {
      toast.error(
        'Marque todos os itens do checklist antes de concluir a tarefa'
      );

      return;
    }

    const uploadedPhotos: {
      task_id: string;
      photo_url: string;
    }[] = [];

    for (const photo of newPhotos) {
      const fileExtension =
        photo.file.name.split('.').pop() || 'jpg';

      const fileName = `${task.id}-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2)}.${fileExtension}`;

      const { error: uploadError } =
        await supabase.storage
          .from('task-photos')
          .upload(fileName, photo.file);

      if (uploadError) {
        console.error(uploadError);

        toast.error(
          uploadError.message ||
            'Erro ao enviar uma das fotos'
        );

        return;
      }

      const { data } = supabase.storage
        .from('task-photos')
        .getPublicUrl(fileName);

      uploadedPhotos.push({
        task_id: task.id,
        photo_url: data.publicUrl,
      });
    }

    if (uploadedPhotos.length > 0) {
      const { error: photoError } = await supabase
        .from('task_photos')
        .insert(uploadedPhotos);

      if (photoError) {
        toast.error('Erro ao salvar fotos da tarefa');
        return;
      }
    }

    const firstPhotoUrl =
      savedPhotos[0]?.photo_url ||
      uploadedPhotos[0]?.photo_url ||
      task.photo_url;

    const completedAt = new Date().toLocaleString(
      'sv-SE',
      {
        timeZone: 'America/Sao_Paulo',
      }
    );

    const { error } = await supabase
      .from('tasks')
      .update({
        status: 'completed',
        photo_url: firstPhotoUrl,
        completed_at: completedAt,
        observation,
      })
      .eq('id', task.id);

    if (error) {
      toast.error('Erro ao concluir tarefa');
      return;
    }

    toast.success('Tarefa concluída!');

    navigate('/minhas-demandas');
  };

  const totalPhotos =
    savedPhotos.length + newPhotos.length;

  const todayBrazil = new Date().toLocaleDateString(
    'sv-SE',
    {
      timeZone: 'America/Sao_Paulo',
    }
  );

  const isFixedDailyTask = Boolean(
    task?.recurring_parent_id
  );

  const isPastTask = task
    ? task.date < todayBrazil
    : false;

  const isReadOnlyFixedDailyTask =
    isFixedDailyTask && isPastTask;

  const canInteractWithTask =
    task?.status !== 'completed' &&
    !isReadOnlyFixedDailyTask;

  async function handleUpdateTask() {
    if (!task) return;

    if (!editTitle || !editDescription || !editDeadline) {
      toast.error('Preencha título, descrição e horário limite');
      return;
    }

    const deadlineFull = `${task.date}T${editDeadline}`;

    const updateData: any = {
      title: editTitle,
      description: editDescription,
      deadline: deadlineFull,
    };

    if (task.is_recurring) {
      updateData.recurring_deadline = editDeadline;
    }

    const { error } = await supabase
      .from('tasks')
      .update(updateData)
      .eq('id', task.id);

    if (error) {
      toast.error(error.message || 'Erro ao editar demanda');
      return;
    }

    toast.success('Demanda atualizada com sucesso!');
    setEditingTask(false);
    await loadTask();
  }

  async function deleteTaskRelations(taskIds: string[]) {
    if (taskIds.length === 0) return;

    await supabase.from('checklist_item_logs').delete().in('task_id', taskIds);
    await supabase.from('checklist_items').delete().in('task_id', taskIds);
    await supabase.from('task_photos').delete().in('task_id', taskIds);
    await supabase.from('task_alert_views').delete().in('task_id', taskIds);
    await supabase.from('task_responsibles').delete().in('task_id', taskIds);
  }

  async function handleDeleteTask() {
    if (!task) return;

    const confirmDelete = window.confirm(
      `Tem certeza que deseja excluir a demanda "${task.title}"?\n\nEssa ação não pode ser desfeita.`
    );

    if (!confirmDelete) return;

    await deleteTaskRelations([task.id]);

    const { error } = await supabase
      .from('tasks')
      .delete()
      .eq('id', task.id);

    if (error) {
      toast.error(error.message || 'Erro ao excluir demanda');
      return;
    }

    toast.success('Demanda excluída com sucesso!');
    navigate('/');
  }

  async function handleDeleteRecurringTask() {
    if (!task) return;

    const recurringId = task.recurring_parent_id || task.id;

    const confirmDelete = window.confirm(
      `Tem certeza que deseja excluir esta demanda fixa inteira?\n\nIsso apagará o modelo fixo e todas as repetições já geradas dessa demanda.`
    );

    if (!confirmDelete) return;

    const { data: relatedTasks, error: relatedError } = await supabase
      .from('tasks')
      .select('id')
      .or(`id.eq.${recurringId},recurring_parent_id.eq.${recurringId}`);

    if (relatedError) {
      toast.error(relatedError.message || 'Erro ao buscar demandas relacionadas');
      return;
    }

    const taskIds = relatedTasks?.map((item) => item.id) || [];

    if (taskIds.length === 0) {
      toast.error('Nenhuma demanda encontrada para excluir');
      return;
    }

    await deleteTaskRelations(taskIds);

    const { error } = await supabase
      .from('tasks')
      .delete()
      .in('id', taskIds);

    if (error) {
      toast.error(error.message || 'Erro ao excluir demanda fixa');
      return;
    }

    toast.success('Demanda fixa excluída com sucesso!');
    navigate('/');
  }

  return (
    <div className="max-w-3xl min-h-screen bg-white dark:bg-[#0B0B0B] text-gray-900 dark:text-white p-1">

      <button
        onClick={() => navigate(-1)}
        className="
          flex
          items-center
          gap-2
          text-gray-600
          dark:text-[#A1A1A1]
          hover:text-black
          dark:hover:text-white
          mb-6
          transition-colors
        "
      >
        <ArrowLeft className="w-4 h-4" />
        Voltar
      </button>

      <Card className="
        p-6
        mb-6
        bg-white
        dark:bg-[#121212]
        border
        border-gray-200
        dark:border-[#1F1F1F]
      ">

        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
          {task.title}
        </h1>

        <p className="text-gray-600 dark:text-[#A1A1A1] mt-2">
          {task.description}
        </p>

        <p className="text-sm mt-3 text-gray-600 dark:text-[#A1A1A1]">
          Prazo:{' '}
          {new Date(task.deadline).toLocaleTimeString(
            'pt-BR',
            {
              hour: '2-digit',
              minute: '2-digit',
            }
          )}
        </p>

        {task.status === 'overdue' &&
          !isReadOnlyFixedDailyTask && (
            <p className="text-sm text-red-600 dark:text-red-400 mt-2">
              Tarefa atrasada — ainda pode ser concluída.
            </p>
          )}

        {task.status === 'overdue' &&
          isReadOnlyFixedDailyTask && (
            <p className="text-sm text-red-600 dark:text-red-400 mt-2">
              Tarefa fixa diária atrasada — disponível apenas para consulta.
            </p>
          )}
      </Card>

      {isAdmin && (
        <Card className="p-6 mb-6 bg-white dark:bg-[#121212] border border-gray-200 dark:border-[#1F1F1F]">
          <div className="flex items-center justify-between gap-3 mb-4">
            <h2 className="font-semibold text-gray-900 dark:text-white">
              Ações do gestor
            </h2>

            <Button
              type="button"
              variant="outline"
              onClick={() => setEditingTask((current) => !current)}
            >
              {editingTask ? 'Cancelar edição' : 'Editar demanda'}
            </Button>
          </div>

          {editingTask && (
            <div className="space-y-4">
              <div>
                <Label className="text-gray-900 dark:text-white">
                  Título
                </Label>

                <input
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full border rounded px-3 py-2 mt-1 bg-white border-gray-300 text-gray-900 dark:bg-[#181818] dark:border-[#2A2A2A] dark:text-white"
                />
              </div>

              <div>
                <Label className="text-gray-900 dark:text-white">
                  Descrição
                </Label>

                <Textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  className="mt-1 bg-white border-gray-300 text-gray-900 dark:bg-[#181818] dark:border-[#2A2A2A] dark:text-white"
                />
              </div>

              <div>
                <Label className="text-gray-900 dark:text-white">
                  Horário limite
                </Label>

                <input
                  type="time"
                  value={editDeadline}
                  onChange={(e) => setEditDeadline(e.target.value)}
                  className="w-full border rounded px-3 py-2 mt-1 bg-white border-gray-300 text-gray-900 dark:bg-[#181818] dark:border-[#2A2A2A] dark:text-white"
                />
              </div>

              <Button
                type="button"
                onClick={handleUpdateTask}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                Salvar alterações
              </Button>
            </div>
          )}

          <div className="flex flex-wrap gap-2 mt-5 pt-5 border-t border-gray-200 dark:border-[#1F1F1F]">
            <Button
              type="button"
              variant="outline"
              onClick={handleDeleteTask}
              className="text-red-600 dark:text-red-400 border-red-200 dark:border-red-900 hover:bg-red-50 dark:hover:bg-red-950/30"
            >
              Excluir esta demanda
            </Button>

            {(task.is_recurring || task.recurring_parent_id) && (
              <Button
                type="button"
                variant="outline"
                onClick={handleDeleteRecurringTask}
                className="text-red-700 dark:text-red-300 border-red-300 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-950/30"
              >
                Excluir demanda fixa inteira
              </Button>
            )}
          </div>
        </Card>
      )}

      <Card className="
        p-6
        mb-6
        bg-white
        dark:bg-[#121212]
        border
        border-gray-200
        dark:border-[#1F1F1F]
      ">

        <h2 className="font-semibold mb-3 text-gray-900 dark:text-white">
          Checklist
        </h2>

        {isReadOnlyFixedDailyTask && (
          <div className="
            p-3
            bg-gray-100
            dark:bg-[#181818]
            border
            border-gray-200
            dark:border-[#1F1F1F]
            rounded-lg
            text-sm
            text-gray-700
            dark:text-[#A1A1A1]
          ">
            Esta é uma tarefa fixa diária de um dia anterior.
            Ela está disponível apenas para consulta.
          </div>
        )}

        {checklist.map((item) => {
          const itemLogs = logs.filter(
            (log) =>
              log.checklist_item_id === item.id
          );

          const isUpdating =
            updatingChecklistId === item.id;

          const wasClicked =
            clickedChecklistId === item.id;

          const showLog =
            isAdmin &&
            itemLogs.length > 0 &&
            (hoveredLogItemId === item.id ||
              pinnedLogItemId === item.id);

          return (
            <div
              key={item.id}
              className="relative mb-2"
              onMouseEnter={() =>
                setHoveredLogItemId(item.id)
              }
              onMouseLeave={() =>
                setHoveredLogItemId(null)
              }
            >
              <div
                className={`
                  flex
                  items-center
                  gap-2
                  rounded-lg
                  p-2
                  transition-all
                  ${
                    wasClicked
                      ? 'bg-blue-50 dark:bg-blue-500/10 ring-1 ring-blue-200 dark:ring-blue-500/20'
                      : ''
                  }
                  ${isUpdating ? 'opacity-80' : ''}
                `}
              >
                <div
                  className={`transition-transform ${
                    wasClicked
                      ? 'scale-110'
                      : 'scale-100'
                  }`}
                >
                  <Checkbox
                    checked={item.completed}
                    onCheckedChange={() =>
                      toggleChecklist(
                        item.id,
                        item.completed
                      )
                    }
                    disabled={
                      !canInteractWithTask ||
                      isUpdating
                    }
                  />
                </div>

                <span
                  className={
                    item.completed
                      ? 'line-through text-gray-500 dark:text-[#707070]'
                      : 'text-gray-900 dark:text-white'
                  }
                >
                  {item.text}
                </span>

                {isUpdating && (
                  <span className="text-xs text-blue-600 dark:text-blue-400 ml-2">
                    Salvando...
                  </span>
                )}

                {isAdmin &&
                  itemLogs.length > 0 && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();

                        setPinnedLogItemId(
                          (current) =>
                            current === item.id
                              ? null
                              : item.id
                        );
                      }}
                      className="
                        ml-auto
                        text-xs
                        text-blue-600
                        dark:text-blue-400
                        hover:underline
                      "
                    >
                      {pinnedLogItemId === item.id
                        ? 'Desfixar log'
                        : 'Fixar log'}
                    </button>
                  )}
              </div>

              {showLog && (
                <div className="
                  ml-8
                  mt-1
                  mb-3
                  max-h-44
                  overflow-y-auto
                  bg-white
                  dark:bg-[#181818]
                  border
                  border-gray-200
                  dark:border-[#1F1F1F]
                  shadow-lg
                  rounded-lg
                  p-3
                  z-50
                  text-xs
                ">

                  <div className="flex items-center justify-between mb-2">

                    <strong className="text-gray-900 dark:text-white">
                      Histórico do checklist
                    </strong>

                    {pinnedLogItemId === item.id && (
                      <button
                        type="button"
                        onClick={() =>
                          setPinnedLogItemId(null)
                        }
                        className="
                          text-gray-500
                          dark:text-[#A1A1A1]
                          hover:text-black
                          dark:hover:text-white
                        "
                      >
                        Fechar
                      </button>
                    )}

                  </div>

                  {itemLogs.map((log) => (
                    <p
                      key={log.id}
                      className="
                        mb-2
                        border-b
                        border-gray-200
                        dark:border-[#1F1F1F]
                        last:border-b-0
                        pb-2
                        text-gray-700
                        dark:text-[#A1A1A1]
                      "
                    >
                      <strong className="text-gray-900 dark:text-white">
                        {log.user_name}
                      </strong>{' '}
                      {log.action}

                      <br />

                      <span className="text-gray-500 dark:text-[#707070]">
                        {new Date(
                          log.created_at
                        ).toLocaleString(
                          'pt-BR',
                          {
                            timeZone:
                              'America/Sao_Paulo',
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          }
                        )}
                      </span>
                    </p>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        <div className="
          mt-4
          p-3
          bg-blue-50
          dark:bg-blue-950/20
          border
          border-blue-100
          dark:border-blue-900/30
          rounded-lg
          flex
          items-center
          gap-2
          text-sm
          text-blue-800
          dark:text-blue-300
        ">

          <Clock className="w-4 h-4" />

          <span>
            {
              checklist.filter((c) => c.completed)
                .length
            }{' '}
            de {checklist.length} itens concluídos
          </span>

        </div>
      </Card>
               <Card className="p-6 mb-6 bg-white dark:bg-[#121212] border border-gray-200 dark:border-[#1F1F1F]">
        <h2 className="font-semibold mb-3 text-gray-900 dark:text-white">
          Imagens para verificação
        </h2>

        {totalPhotos > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
            {savedPhotos.map((photo) => (
              <a
                key={photo.id}
                href={photo.photo_url}
                target="_blank"
                rel="noreferrer"
                className="block border border-gray-200 dark:border-[#1F1F1F] rounded-lg overflow-hidden"
              >
                <img
                  src={photo.photo_url}
                  className="w-full h-32 object-cover"
                  alt="Comprovação"
                />
              </a>
            ))}

            {newPhotos.map((photo, index) => (
              <div
                key={photo.preview}
                className="relative border border-gray-200 dark:border-[#1F1F1F] rounded-lg overflow-hidden"
              >
                <img
                  src={photo.preview}
                  className="w-full h-32 object-cover"
                  alt="Nova comprovação"
                />

                {task.status !== 'completed' && (
                  <button
                    type="button"
                    onClick={() => removeNewPhoto(index)}
                    className="absolute top-2 right-2 bg-white dark:bg-[#181818] rounded-full p-1 shadow"
                  >
                    <X className="w-4 h-4 text-red-600 dark:text-red-400" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {canInteractWithTask && (
          <label className="block">
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={handlePhotoUpload}
              className="hidden"
            />

            <div className="border-2 border-dashed border-gray-300 dark:border-[#2A2A2A] rounded-lg p-8 text-center hover:border-gray-400 dark:hover:border-[#3A3A3A] hover:bg-gray-50 dark:hover:bg-[#181818] transition-colors cursor-pointer">
              <Upload className="w-10 h-10 mx-auto mb-3 text-gray-400 dark:text-[#707070]" />

              <p className="text-gray-600 dark:text-white font-medium">
                Clique para enviar uma ou mais fotos
              </p>

              <p className="text-sm text-gray-500 dark:text-[#A1A1A1]">
                PNG, JPG ou WEBP
              </p>
            </div>
          </label>
        )}

        <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-500/10 border border-yellow-200 dark:border-yellow-500/20 rounded-lg">
          <p className="text-sm text-yellow-800 dark:text-yellow-300 font-medium">
            É obrigatório enviar pelo menos uma foto para concluir.
          </p>
        </div>
      </Card>

      <Card className="p-6 mb-6 bg-white dark:bg-[#121212] border border-gray-200 dark:border-[#1F1F1F]">
        <Label className="text-gray-900 dark:text-white">
          Observação
        </Label>

        <Textarea
          value={observation}
          onChange={(e) => setObservation(e.target.value)}
          disabled={!canInteractWithTask}
          className="mt-2 bg-white border-gray-300 text-gray-900 dark:bg-[#181818] dark:border-[#2A2A2A] dark:text-white"
        />
      </Card>

      {canInteractWithTask && (
        <Button
          onClick={handleCompleteTask}
          className="bg-green-600 hover:bg-green-700 text-white"
        >
          <CheckCircle className="w-4 h-4 mr-2" />
          Concluir Tarefa
        </Button>
      )}
    </div>
  );
}