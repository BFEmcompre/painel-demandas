import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';

import {
  PlusCircle,
} from 'lucide-react';

import { supabase } from '../../lib/supabase';
import {
  PRIORITY_LEVELS,
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
  is_recurring?: boolean | null;
  priority?: number | null;
};

type Responsible = {
  id: string;
  name: string;
  email: string;
};

export function ManagerDashboard() {
  const navigate = useNavigate();

  const [tasks, setTasks] = useState<Task[]>([]);

  const [responsibles, setResponsibles] =
    useState<Responsible[]>([]);

  const [searchQuery, setSearchQuery] =
    useState('');

  const [statusFilter, setStatusFilter] =
    useState<string>('all');

  const [
    responsibleFilter,
    setResponsibleFilter,
  ] = useState<string>('all');

  const [
    priorityFilter,
    setPriorityFilter,
  ] = useState<string>('all');

  useEffect(() => {
    loadData();
  }, []);

  async function generateTodayRecurringTasks(
    today: string
  ) {
    const { data: recurringTasks } =
      await supabase
        .from('tasks')
        .select('*')
        .eq('is_recurring', true)
        .lte('date', today);

    if (
      !recurringTasks ||
      recurringTasks.length === 0
    )
      return;

    for (const recurringTask of recurringTasks) {
      const { data: existingTask } =
        await supabase
          .from('tasks')
          .select('id')
          .eq('date', today)
          .eq(
            'recurring_parent_id',
            recurringTask.id
          )
          .maybeSingle();

      if (existingTask) continue;

      const deadlineTime =
        recurringTask.recurring_deadline ||
        '17:00';

      const deadlineFull = `${today}T${deadlineTime}`;

      const {
        data: newTask,
        error: taskError,
      } = await supabase
        .from('tasks')
        .insert({
          title: recurringTask.title,
          description:
            recurringTask.description,
          responsible_id:
            recurringTask.responsible_id,
          responsible_name:
            recurringTask.responsible_name,
          date: today,
          deadline: deadlineFull,
          status: 'pending',
          is_recurring: false,
          recurring_deadline:
            recurringTask.recurring_deadline,
          recurring_parent_id:
            recurringTask.id,
          priority: recurringTask.priority,
          requires_photo: recurringTask.requires_photo,
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

      const { data: oldResponsibles } =
        await supabase
          .from('task_responsibles')
          .select(
            'responsible_id, responsible_name'
          )
          .eq('task_id', recurringTask.id);

      if (
        oldResponsibles &&
        oldResponsibles.length > 0
      ) {
        await supabase
          .from('task_responsibles')
          .insert(
            oldResponsibles.map((item) => ({
              task_id: newTask.id,
              responsible_id:
                item.responsible_id,
              responsible_name:
                item.responsible_name,
            }))
          );
      }

      const { data: oldChecklist } =
        await supabase
          .from('checklist_items')
          .select('text')
          .eq('task_id', recurringTask.id);

      if (
        oldChecklist &&
        oldChecklist.length > 0
      ) {
        await supabase
          .from('checklist_items')
          .insert(
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
    const today =
      new Date().toLocaleDateString(
        'sv-SE',
        {
          timeZone:
            'America/Sao_Paulo',
        }
      );

    await generateTodayRecurringTasks(
      today
    );

    const { data: tasksData } =
      await supabase
        .from('tasks')
        .select('*');

    const { data: respData } =
      await supabase
        .from('profiles')
        .select('id, name, email')
        .eq('role', 'responsible');

    setTasks(tasksData || []);

    setResponsibles(respData || []);
  }

  const today =
    new Date().toLocaleDateString(
      'sv-SE',
      {
        timeZone:
          'America/Sao_Paulo',
      }
    );

  const todayTasks = tasks.filter(
    (t: any) =>
      t.date === today &&
      t.is_recurring !== true
  );

  const completedCount =
    todayTasks.filter(
      (t) => t.status === 'completed'
    ).length;

  const pendingCount =
    todayTasks.filter(
      (t) => t.status === 'pending'
    ).length;

  const overdueCount =
    todayTasks.filter(
      (t) => t.status === 'overdue'
    ).length;

  const filteredTasks = sortByPriorityThenDeadline(
    todayTasks.filter((task) => {
      const matchesSearch =
        task.title
          .toLowerCase()
          .includes(
            searchQuery.toLowerCase()
          ) ||
        task.description
          .toLowerCase()
          .includes(
            searchQuery.toLowerCase()
          );

      const matchesStatus =
        statusFilter === 'all' ||
        task.status === statusFilter;

      const matchesResponsible =
        responsibleFilter === 'all' ||
        task.responsible_id ===
          responsibleFilter;

      const matchesPriority =
        priorityFilter === 'all' ||
        String(task.priority ?? 3) ===
          priorityFilter;

      return (
        matchesSearch &&
        matchesStatus &&
        matchesResponsible &&
        matchesPriority
      );
    })
  );

  const getStatusColor = (
    status: string
  ) => {
    switch (status) {
      case 'completed':
        return `
          bg-green-500/10
          text-green-400
          border
          border-green-500/20
        `;

      case 'overdue':
        return `
          bg-red-500/10
          text-red-400
          border
          border-red-500/20
        `;

      default:
        return `
          bg-yellow-500/10
          text-yellow-300
          border
          border-yellow-500/20
        `;
    }
  };

  const getStatusText = (
    status: string
  ) => {
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

      {/* TOPO */}

      <div className="flex items-center justify-between">

        <div>

          <h1 className="
            text-3xl
            font-semibold
            text-gray-900
            dark:text-white
          ">
            Dashboard
          </h1>

          <p className="
            text-gray-500
            dark:text-[#A1A1A1]
            mt-1
          ">
            Visão geral das demandas do dia
          </p>

        </div>

        <Button
          onClick={() =>
            navigate('/criar-demanda')
          }
          className="
            bg-gray-900
            text-white
            hover:bg-black

            dark:bg-white
            dark:text-black
            dark:hover:bg-[#E5E5E5]
          "
        >

          <PlusCircle className="w-4 h-4 mr-2" />

          Criar Nova Demanda

        </Button>

      </div>

      {/* CARDS */}

      <div className="
        grid
        grid-cols-1
        md:grid-cols-4
        gap-4
      ">

        <Card className="
          p-5
          bg-white
          border
          border-gray-200

          dark:bg-[#121212]
          dark:border-[#1F1F1F]
        ">

          <p className="
            text-sm
            text-gray-500
            dark:text-[#A1A1A1]
          ">
            Demandas do Dia
          </p>

          <p className="
            text-3xl
            font-semibold
            mt-2
            text-gray-900
            dark:text-white
          ">
            {todayTasks.length}
          </p>

        </Card>

        <Card className="
          p-5
          bg-white
          border
          border-gray-200

          dark:bg-[#121212]
          dark:border-[#1F1F1F]
        ">

          <p className="
            text-sm
            text-gray-500
            dark:text-[#A1A1A1]
          ">
            Concluídas
          </p>

          <p className="
            text-3xl
            font-semibold
            mt-2
            text-green-600
            dark:text-green-400
          ">
            {completedCount}
          </p>

        </Card>

        <Card className="
          p-5
          bg-white
          border
          border-gray-200

          dark:bg-[#121212]
          dark:border-[#1F1F1F]
        ">

          <p className="
            text-sm
            text-gray-500
            dark:text-[#A1A1A1]
          ">
            Pendentes
          </p>

          <p className="
            text-3xl
            font-semibold
            mt-2
            text-yellow-600
            dark:text-yellow-300
          ">
            {pendingCount}
          </p>

        </Card>

        <Card className="
          p-5
          bg-white
          border
          border-gray-200

          dark:bg-[#121212]
          dark:border-[#1F1F1F]
        ">

          <p className="
            text-sm
            text-gray-500
            dark:text-[#A1A1A1]
          ">
            Atrasadas
          </p>

          <p className="
            text-3xl
            font-semibold
            mt-2
            text-red-600
            dark:text-red-400
          ">
            {overdueCount}
          </p>

        </Card>

      </div>

      {/* ALERTA */}

      {overdueCount > 0 && (

        <Card className="
          p-4
          bg-red-50
          border-red-200

          dark:bg-red-500/10
          dark:border-red-500/20
        ">

          <p className="
            text-red-700
            dark:text-red-400
            font-medium
          ">
            ⚠️ {overdueCount} tarefa(s)
            atrasada(s)
          </p>

        </Card>

      )}

      {/* LISTA */}

      <Card className="
        p-6
        bg-white
        border
        border-gray-200

        dark:bg-[#121212]
        dark:border-[#1F1F1F]
      ">

        {/* FILTROS */}

        <div className="
          flex
          flex-col
          lg:flex-row
          gap-4
          mb-6
        ">

          <Input
            placeholder="Buscar..."
            value={searchQuery}
            onChange={(e) =>
              setSearchQuery(
                e.target.value
              )
            }
            className="
              bg-white
              border-gray-300
              text-gray-900

              dark:bg-[#181818]
              dark:border-[#2A2A2A]
              dark:text-white
            "
          />

          <Select
            value={statusFilter}
            onValueChange={
              setStatusFilter
            }
          >

            <SelectTrigger className="
              w-full
              lg:w-48

              bg-white
              border-gray-300
              text-gray-900

              dark:bg-[#181818]
              dark:border-[#2A2A2A]
              dark:text-white
            ">

              <SelectValue placeholder="Status" />

            </SelectTrigger>

            <SelectContent className="
              dark:bg-[#181818]
              dark:border-[#2A2A2A]
            ">

              <SelectItem value="all">
                Todos
              </SelectItem>

              <SelectItem value="pending">
                Pendentes
              </SelectItem>

              <SelectItem value="completed">
                Concluídas
              </SelectItem>

              <SelectItem value="overdue">
                Atrasadas
              </SelectItem>

            </SelectContent>
          </Select>

          <Select
            value={responsibleFilter}
            onValueChange={
              setResponsibleFilter
            }
          >

            <SelectTrigger className="
              w-full
              lg:w-48

              bg-white
              border-gray-300
              text-gray-900

              dark:bg-[#181818]
              dark:border-[#2A2A2A]
              dark:text-white
            ">

              <SelectValue placeholder="Responsável" />

            </SelectTrigger>

            <SelectContent className="
              dark:bg-[#181818]
              dark:border-[#2A2A2A]
            ">

              <SelectItem value="all">
                Todos
              </SelectItem>

              {responsibles.map((r) => (

                <SelectItem
                  key={r.id}
                  value={r.id}
                >
                  {r.name}
                </SelectItem>

              ))}

            </SelectContent>
          </Select>

          <Select
            value={priorityFilter}
            onValueChange={setPriorityFilter}
          >

            <SelectTrigger className="
              w-full
              lg:w-48

              bg-white
              border-gray-300
              text-gray-900

              dark:bg-[#181818]
              dark:border-[#2A2A2A]
              dark:text-white
            ">

              <SelectValue placeholder="Prioridade" />

            </SelectTrigger>

            <SelectContent className="
              dark:bg-[#181818]
              dark:border-[#2A2A2A]
            ">

              <SelectItem value="all">
                Todas prioridades
              </SelectItem>

              {PRIORITY_LEVELS.map((level) => (
                <SelectItem key={level} value={String(level)}>
                  {priorityLabel(level)}
                </SelectItem>
              ))}

            </SelectContent>
          </Select>

        </div>

        {/* TAREFAS */}

        <div className="space-y-3">

          {filteredTasks.length === 0 ? (

            <div className="
              py-16
              text-center
            ">

              <p className="
                text-gray-500
                dark:text-[#A1A1A1]
              ">
                Nenhuma demanda encontrada.
              </p>

            </div>

          ) : (

            filteredTasks.map((task) => (

              <div
                key={task.id}
                onClick={() =>
                  navigate(
                    `/tarefa/${task.id}`
                  )
                }
                className={`
                  p-4
                  rounded-xl
                  cursor-pointer
                  transition-all

                  bg-white
                  border
                  border-gray-200
                  hover:bg-gray-50

                  dark:bg-[#181818]
                  dark:border-[#1F1F1F]
                  dark:hover:bg-[#1D1D1D]

                  ${priorityBorderClass(task.priority)}
                `}
              >

                <div className="
                  flex
                  justify-between
                  gap-4
                ">

                  <div>

                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="
                        font-semibold
                        text-gray-900
                        dark:text-white
                      ">
                        {task.title}
                      </h3>

                      <span
                        className={`
                          px-2
                          py-0.5
                          rounded-full
                          text-xs
                          font-medium
                          ${priorityBadgeClass(task.priority)}
                        `}
                      >
                        {priorityLabel(task.priority)}
                      </span>
                    </div>

                    <p className="
                      text-sm
                      mt-1
                      text-gray-500
                      dark:text-[#A1A1A1]
                    ">
                      {task.description}
                    </p>

                    <p className="
                      text-xs
                      mt-3
                      text-gray-400
                      dark:text-[#707070]
                    ">
                      {
                        task.responsible_name
                      }{' '}
                      •{' '}
                      {new Date(
                        task.deadline
                      ).toLocaleTimeString(
                        'pt-BR'
                      )}
                    </p>

                  </div>

                  <span
                    className={`
                      h-fit
                      px-3
                      py-1
                      rounded-full
                      text-xs
                      font-medium
                      ${getStatusColor(
                        task.status
                      )}
                    `}
                  >
                    {getStatusText(
                      task.status
                    )}
                  </span>

                </div>
              </div>

            ))
          )}

        </div>
      </Card>
    </div>
  );
}
