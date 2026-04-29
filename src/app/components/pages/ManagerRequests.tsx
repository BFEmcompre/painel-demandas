import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { supabase } from '../../lib/supabase';

type ManagerRequest = {
  id: string;
  subject: string;
  message: string;
  requester_name: string;
  due_at: string;
  status: string;
  created_at: string;
};

export function ManagerRequests() {
  const navigate = useNavigate();

  const [requests, setRequests] = useState<ManagerRequest[]>([]);
  const [filter, setFilter] = useState('open');

  useEffect(() => {
    loadRequests();
  }, []);

  async function loadRequests() {
    const { data } = await supabase
      .from('manager_requests')
      .select('*')
      .order('due_at', { ascending: true });

    setRequests(data || []);
  }

  function isOverdue(request: ManagerRequest) {
    return request.status === 'open' && new Date(request.due_at) < new Date();
  }

  const filteredRequests = requests.filter((request) => {
    if (filter === 'open') return request.status === 'open' && !isOverdue(request);
    if (filter === 'overdue') return isOverdue(request);
    if (filter === 'answered') return request.status === 'answered';
    return true;
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-gray-900">Demandas Recebidas</h1>
        <p className="text-gray-500 mt-1">Acompanhe demandas enviadas pelos responsáveis</p>
      </div>

      <div className="flex gap-2">
        <Button
          type="button"
          variant={filter === 'open' ? 'default' : 'outline'}
          onClick={() => setFilter('open')}
        >
          Em aberto
        </Button>

        <Button
          type="button"
          variant={filter === 'overdue' ? 'default' : 'outline'}
          onClick={() => setFilter('overdue')}
        >
          Vencidas
        </Button>

        <Button
          type="button"
          variant={filter === 'answered' ? 'default' : 'outline'}
          onClick={() => setFilter('answered')}
        >
          Respondidas
        </Button>

        <Button
          type="button"
          variant={filter === 'all' ? 'default' : 'outline'}
          onClick={() => setFilter('all')}
        >
          Todas
        </Button>
      </div>

      {filteredRequests.length === 0 ? (
        <Card className="p-10 text-center text-gray-500">
          Nenhuma demanda encontrada.
        </Card>
      ) : (
        filteredRequests.map((request) => (
          <Card
            key={request.id}
            className="p-5 cursor-pointer hover:bg-gray-50"
            onClick={() => navigate(`/demandas-gestor/${request.id}`)}
          >
            <div className="flex justify-between gap-4">
              <div>
                <h2 className="font-semibold text-lg">{request.subject}</h2>
                <p className="text-sm text-gray-500">
                  Enviado por: {request.requester_name}
                </p>
                <p className="text-sm text-gray-600 mt-2 line-clamp-2">
                  {request.message}
                </p>
              </div>

              <div className="text-right">
                {request.status === 'answered' ? (
                  <p className="text-green-600 text-sm font-medium">Respondida</p>
                ) : isOverdue(request) ? (
                  <p className="text-red-600 text-sm font-medium">Vencida</p>
                ) : (
                  <p className="text-yellow-600 text-sm font-medium">Em aberto</p>
                )}

                <p className="text-xs text-gray-500 mt-2">
                  Prazo: {new Date(request.due_at).toLocaleString('pt-BR')}
                </p>
              </div>
            </div>
          </Card>
        ))
      )}
    </div>
  );
}