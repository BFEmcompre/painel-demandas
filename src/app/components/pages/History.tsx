import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { Card } from '../ui/card';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../ui/table';
import { Button } from '../ui/button';
import { Search, Filter, Download, Eye } from 'lucide-react';
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

  const matchesStatus = statusFilter === 'all' || task.status === statusFilter;

const matchesResponsible =
  !isAdmin ||
  responsibleFilter === 'all' ||
  task.responsible_id === responsibleFilter;

  const today = new Date();
  const taskDate = new Date(task.date + 'T12:00:00');

  const diffInDays = Math.floor(
    (today.getTime() - taskDate.getTime()) / (1000 * 60 * 60 * 24)
  );

  const matchesPeriod =
    periodFilter === 'all' ||
    (periodFilter === '7days' && diffInDays <= 7) ||
    (periodFilter === '30days' && diffInDays <= 30);

  return matchesSearch && matchesStatus && matchesResponsible && matchesPeriod;
});

  const getStatusBadge = (status: string) => {
    const styles = {
      completed: 'bg-green-100 text-green-700',
      overdue: 'bg-red-100 text-red-700',
      pending: 'bg-yellow-100 text-yellow-700',
    };

    const labels = {
      completed: 'Concluída',
      overdue: 'Atrasada',
      pending: 'Pendente',
    };

    return (
      <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${styles[status as keyof typeof styles]}`}>
        {labels[status as keyof typeof labels]}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-gray-900">Histórico</h1>
          <p className="text-gray-500 mt-1">Visualize todas as demandas registradas</p>
        </div>

        <Button variant="outline">
          <Download className="w-4 h-4 mr-2" />
          Exportar
        </Button>
      </div>

      <Card className="p-6">
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <Input
              placeholder="Buscar por tarefa ou responsável..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full md:w-48">
              <Filter className="w-4 h-4 mr-2" />
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="pending">Pendentes</SelectItem>
              <SelectItem value="completed">Concluídas</SelectItem>
              <SelectItem value="overdue">Atrasadas</SelectItem>
            </SelectContent>
          </Select>

{isAdmin === true && (
  <Select value={responsibleFilter} onValueChange={setResponsibleFilter}>
    <SelectTrigger className="w-full md:w-48">
      <SelectValue placeholder="Responsável" />
    </SelectTrigger>
    <SelectContent>
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
  <SelectTrigger className="w-full md:w-48">
    <SelectValue placeholder="Período" />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="all">Todos</SelectItem>
    <SelectItem value="7days">Últimos 7 dias</SelectItem>
    <SelectItem value="30days">Últimos 30 dias</SelectItem>
  </SelectContent>
</Select>
        </div>

        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50">
                <TableHead>Data</TableHead>
                <TableHead>Tarefa</TableHead>
                <TableHead>Responsável</TableHead>
                <TableHead>Prazo</TableHead>
                <TableHead>Conclusão</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Foto</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {filteredTasks.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-12 text-gray-500">
                    Nenhum registro encontrado
                  </TableCell>
                </TableRow>
              ) : (
                filteredTasks.map((task) => (
                  <TableRow key={task.id}>
<TableCell>
  {task.date.split('-').reverse().join('/')}
</TableCell>
                    <TableCell>
                      <p className="font-medium">{task.title}</p>
                      <p className="text-sm text-gray-500">{task.description}</p>
                    </TableCell>

<TableCell>{task.responsible_name}</TableCell>

<TableCell>
  {new Date(task.deadline).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Sao_Paulo',
  })}
</TableCell>

<TableCell>
  {task.completed_at
    ? new Date(task.completed_at).toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'America/Sao_Paulo',
      })
    : '-'}
</TableCell>

<TableCell>{getStatusBadge(task.status)}</TableCell>

<TableCell>
  {task.photo_url ? (
<button
  type="button"
  onClick={() => navigate(`/tarefa/${task.id}`)}
  className="text-blue-600 text-sm hover:underline"
>
  Ver fotos
</button>
  ) : (
    '-'
  )}
</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <div className="mt-4 text-sm text-gray-600">
          {filteredTasks.length} registro(s)
        </div>
      </Card>
    </div>
  );
}