import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { Card } from '../ui/card';
import { Input } from '../ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../ui/table';
import { Button } from '../ui/button';
import { Search, Filter, Download } from 'lucide-react';
import { supabase } from '../../lib/supabase';

type Task = {
  id: string;
  title: string;
  description: string;
  responsible_id: string;
  responsible_name: string;
  date: string;
  deadline: string;
  completed_at: string | null;
  status: 'pending' | 'completed' | 'overdue';
  photo_url: string | null;
  recurring_parent_id?: string | null;
};

type Responsible = {
  id: string;
  name: string;
};

export function History() {
  const navigate = useNavigate();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [responsibles, setResponsibles] = useState<Responsible[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [responsibleFilter, setResponsibleFilter] = useState<string>('all');
  const [periodFilter, setPeriodFilter] = useState<string>('all');
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const { data: authData } = await supabase.auth.getUser();

    if (!authData?.user) return;

    const userId = authData.user.id;

    const { data: profile } = await supabase
      .from('profiles')
      .select('id, name, role')
      .eq('id', userId)
      .single();

    const adminAccess = ['admin', 'manager', 'gestor'].includes(
      String(profile?.role).toLowerCase()
    );

    setIsAdmin(adminAccess);

    let tasksQuery = supabase.from('tasks').select('*');

    tasksQuery = tasksQuery.or('is_recurring.eq.false,is_recurring.is.null');

    if (!adminAccess) {
      tasksQuery = tasksQuery.eq('responsible_id', userId);
    }

    const { data: tasksData } = await tasksQuery.order('date', {
      ascending: false,
    });

    const { data: respData } = await supabase
      .from('profiles')
      .select('id, name')
      .eq('role', 'responsible');

    setTasks(tasksData || []);
    setResponsibles(respData || []);
  }

  const filteredTasks = tasks.filter((task) => {
    const matchesSearch =
      task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      task.responsible_name.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus =
      statusFilter === 'all' || task.status === statusFilter;

    const matchesResponsible =
      !isAdmin ||
      responsibleFilter === 'all' ||
      task.responsible_id === responsibleFilter;

    const today = new Date();
    const taskDate = new Date(task.date + 'T12:00:00');

    const diffInDays = Math.floor(
      (today.getTime() - taskDate.getTime()) /
        (1000 * 60 * 60 * 24)
    );

    const matchesPeriod =
      periodFilter === 'all' ||
      (periodFilter === '7days' && diffInDays <= 7) ||
      (periodFilter === '30days' && diffInDays <= 30);

    return (
      matchesSearch &&
      matchesStatus &&
      matchesResponsible &&
      matchesPeriod
    );
  });

  const getStatusBadge = (status: string) => {
    const styles = {
      completed:
        'bg-green-100 text-green-700 dark:bg-green-500/10 dark:text-green-400',
      overdue:
        'bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400',
      pending:
        'bg-yellow-100 text-yellow-700 dark:bg-yellow-500/10 dark:text-yellow-300',
    };

    const labels = {
      completed: 'Concluída',
      overdue: 'Atrasada',
      pending: 'Pendente',
    };

    return (
      <span
        className={`px-2.5 py-1 rounded-full text-xs font-medium ${
          styles[status as keyof typeof styles]
        }`}
      >
        {labels[status as keyof typeof labels]}
      </span>
    );
  };

  return (
    <div className="space-y-6 min-h-screen bg-white dark:bg-[#0B0B0B] text-gray-900 dark:text-white p-1">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-gray-900 dark:text-white">
            Histórico
          </h1>

          <p className="text-gray-500 dark:text-[#A1A1A1] mt-1">
            Visualize todas as demandas registradas
          </p>
        </div>

        <Button
          variant="outline"
          className="
            bg-white
            border-gray-300
            text-gray-900
            hover:bg-gray-100
            dark:bg-[#181818]
            dark:border-[#2A2A2A]
            dark:text-white
            dark:hover:bg-[#242424]
          "
        >
          <Download className="w-4 h-4 mr-2" />
          Exportar
        </Button>
      </div>

      <Card className="p-6 bg-white dark:bg-[#121212] border border-gray-200 dark:border-[#1F1F1F]">
        
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-[#707070]" />

            <Input
              placeholder="Buscar por tarefa ou responsável..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="
                pl-10
                bg-white
                border-gray-300
                text-gray-900
                dark:bg-[#181818]
                dark:border-[#2A2A2A]
                dark:text-white
              "
            />
          </div>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="
              w-full
              md:w-48
              bg-white
              border-gray-300
              text-gray-900
              dark:bg-[#181818]
              dark:border-[#2A2A2A]
              dark:text-white
            ">
              <Filter className="w-4 h-4 mr-2" />
              <SelectValue placeholder="Status" />
            </SelectTrigger>

            <SelectContent className="dark:bg-[#181818] dark:border-[#2A2A2A]">
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="pending">Pendentes</SelectItem>
              <SelectItem value="completed">Concluídas</SelectItem>
              <SelectItem value="overdue">Atrasadas</SelectItem>
            </SelectContent>
          </Select>

          {isAdmin === true && (
            <Select
              value={responsibleFilter}
              onValueChange={setResponsibleFilter}
            >
              <SelectTrigger className="
                w-full
                md:w-48
                bg-white
                border-gray-300
                text-gray-900
                dark:bg-[#181818]
                dark:border-[#2A2A2A]
                dark:text-white
              ">
                <SelectValue placeholder="Responsável" />
              </SelectTrigger>

              <SelectContent className="dark:bg-[#181818] dark:border-[#2A2A2A]">
                <SelectItem value="all">Todos</SelectItem>

                {responsibles.map((resp) => (
                  <SelectItem key={resp.id} value={resp.id}>
                    {resp.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <Select value={periodFilter} onValueChange={setPeriodFilter}>
            <SelectTrigger className="
              w-full
              md:w-48
              bg-white
              border-gray-300
              text-gray-900
              dark:bg-[#181818]
              dark:border-[#2A2A2A]
              dark:text-white
            ">
              <SelectValue placeholder="Período" />
            </SelectTrigger>

            <SelectContent className="dark:bg-[#181818] dark:border-[#2A2A2A]">
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="7days">Últimos 7 dias</SelectItem>
              <SelectItem value="30days">Últimos 30 dias</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="border border-gray-200 dark:border-[#1F1F1F] rounded-lg overflow-hidden">
          
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50 dark:bg-[#181818] border-b border-gray-200 dark:border-[#1F1F1F]">
                <TableHead className="text-gray-700 dark:text-[#A1A1A1]">
                  Data
                </TableHead>

                <TableHead className="text-gray-700 dark:text-[#A1A1A1]">
                  Tarefa
                </TableHead>

                <TableHead className="text-gray-700 dark:text-[#A1A1A1]">
                  Responsável
                </TableHead>

                <TableHead className="text-gray-700 dark:text-[#A1A1A1]">
                  Prazo
                </TableHead>

                <TableHead className="text-gray-700 dark:text-[#A1A1A1]">
                  Conclusão
                </TableHead>

                <TableHead className="text-gray-700 dark:text-[#A1A1A1]">
                  Status
                </TableHead>

                <TableHead className="text-gray-700 dark:text-[#A1A1A1]">
                  Foto
                </TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {filteredTasks.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="text-center py-12 text-gray-500 dark:text-[#707070]"
                  >
                    Nenhum registro encontrado
                  </TableCell>
                </TableRow>
              ) : (
                filteredTasks.map((task) => (
                  <TableRow
                    key={task.id}
                    className="border-b border-gray-100 dark:border-[#1F1F1F] hover:bg-gray-50 dark:hover:bg-[#181818]"
                  >
                    <TableCell className="text-gray-900 dark:text-white">
                      {task.date.split('-').reverse().join('/')}
                    </TableCell>

                    <TableCell>
                      <p className="font-medium text-gray-900 dark:text-white">
                        {task.title}
                      </p>

                      <p className="text-sm text-gray-500 dark:text-[#A1A1A1]">
                        {task.description}
                      </p>
                    </TableCell>

                    <TableCell className="text-gray-900 dark:text-white">
                      {task.responsible_name}
                    </TableCell>

                    <TableCell className="text-gray-900 dark:text-white">
                      {new Date(task.deadline).toLocaleTimeString('pt-BR', {
                        hour: '2-digit',
                        minute: '2-digit',
                        timeZone: 'America/Sao_Paulo',
                      })}
                    </TableCell>

                    <TableCell className="text-gray-900 dark:text-white">
                      {task.completed_at
                        ? new Date(task.completed_at).toLocaleTimeString(
                            'pt-BR',
                            {
                              hour: '2-digit',
                              minute: '2-digit',
                              timeZone: 'America/Sao_Paulo',
                            }
                          )
                        : '-'}
                    </TableCell>

                    <TableCell>
                      {getStatusBadge(task.status)}
                    </TableCell>

                    <TableCell>
                      <button
                        type="button"
                        onClick={() => navigate(`/tarefa/${task.id}`)}
                        className="
                          text-blue-600
                          dark:text-blue-400
                          text-sm
                          hover:underline
                        "
                      >
                        {task.photo_url
                          ? 'Ver fotos'
                          : 'Ver detalhes'}
                      </button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <div className="mt-4 text-sm text-gray-600 dark:text-[#A1A1A1]">
          {filteredTasks.length} registro(s)
        </div>
      </Card>
    </div>
  );
}