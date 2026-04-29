import { useEffect, useState } from 'react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { supabase } from '../../lib/supabase';

type ManagerRequest = {
  id: string;
  subject: string;
  message: string;
  due_at: string;
  status: string;
  response_text: string | null;
  responded_at: string | null;
  urgent: boolean;
  created_at: string;
};

export function MyManagerRequests() {
  const [requests, setRequests] = useState<ManagerRequest[]>([]);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    loadRequests();
  }, []);

  async function loadRequests() {
    const { data: authData } = await supabase.auth.getUser();

    if (!authData.user) return;

    const { data } = await supabase
      .from('manager_requests')
      .select('*')
      .eq('requester_id', authData.user.id)
      .order('created_at', { ascending: false });

    setRequests(data || []);
  }

  const filteredRequests = requests.filter((request) => {
    if (filter === 'open') return request.status === 'open';
    if (filter === 'answered') return request.status === 'answered';
    return true;
  });


async function markResponseAsViewed(requestId: string) {
  const { data: authData } = await supabase.auth.getUser();

  if (!authData.user) return;

  const { error } = await supabase
    .from('manager_request_alert_views')
    .upsert(
      {
        request_id: requestId,
        user_id: authData.user.id,
        alert_type: 'response_viewed',
      },
      {
        onConflict: 'request_id,user_id,alert_type',
      }
    );

  if (error) {
    alert(error.message || 'Erro ao marcar como visto');
    return;
  }

  loadRequests();
}



  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-gray-900">Minhas Demandas ao Gestor</h1>
        <p className="text-gray-500 mt-1">Acompanhe os retornos do gestor</p>
      </div>

      <div className="flex gap-2">
        <Button
          type="button"
          variant={filter === 'all' ? 'default' : 'outline'}
          onClick={() => setFilter('all')}
        >
          Todas
        </Button>

        <Button
          type="button"
          variant={filter === 'open' ? 'default' : 'outline'}
          onClick={() => setFilter('open')}
        >
          Em aberto
        </Button>

        <Button
          type="button"
          variant={filter === 'answered' ? 'default' : 'outline'}
          onClick={() => setFilter('answered')}
        >
          Respondidas
        </Button>
      </div>

      {filteredRequests.length === 0 ? (
        <Card className="p-10 text-center text-gray-500">
          Nenhuma demanda encontrada.
        </Card>
      ) : (
        filteredRequests.map((request) => (
          <Card key={request.id} className="p-5">
            <div className="flex justify-between gap-4">
              <div>
                <h2 className="font-semibold text-lg">{request.subject}</h2>

                {request.urgent && (
                  <p className="text-red-600 text-sm font-semibold mt-1">
                    ⚠ Urgente
                  </p>
                )}

                <p className="text-sm text-gray-600 mt-2 whitespace-pre-wrap">
                  {request.message}
                </p>

                <p className="text-xs text-gray-500 mt-3">
                  Prazo: {new Date(request.due_at).toLocaleString('pt-BR')}
                </p>
              </div>

              <div>
                {request.status === 'answered' ? (
                  <span className="text-green-600 text-sm font-medium">
                    Respondida
                  </span>
                ) : (
                  <span className="text-yellow-600 text-sm font-medium">
                    Em aberto
                  </span>
                )}
              </div>
            </div>

            {request.status === 'answered' && (
              <div className="mt-5 border-t pt-4">
                <h3 className="font-semibold mb-2">Resposta do gestor</h3>
                <p className="text-gray-700 whitespace-pre-wrap">
                  {request.response_text}
                </p>

                <p className="text-xs text-gray-500 mt-2">
                  Respondida em:{' '}
                  {request.responded_at
                    ? new Date(request.responded_at).toLocaleString('pt-BR')
                    : ''}
                </p>
			
		<Button
  type="button"
  variant="outline"
  className="mt-3"
  onClick={() => markResponseAsViewed(request.id)}
>
  Marcar resposta como vista
</Button>
	  	
              </div>
            )}
          </Card>
        ))
      )}
    </div>
  );
}