import { useEffect, useState } from 'react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
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
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [openUnresolvedId, setOpenUnresolvedId] = useState<string | null>(null);
  const [newDueDates, setNewDueDates] = useState<Record<string, string>>({});

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

  function getStatusLabel(status: string) {
    if (status === 'open') return 'Em aberto';
    if (status === 'answered') return 'Respondida';
    if (status === 'unresolved') return 'Não resolvida';
    if (status === 'closed') return 'Finalizada';
    return status;
  }

  function getStatusClass(status: string) {
    if (status === 'open') return 'bg-yellow-100 text-yellow-700';
    if (status === 'answered') return 'bg-blue-100 text-blue-700';
    if (status === 'unresolved') return 'bg-orange-100 text-orange-700';
    if (status === 'closed') return 'bg-green-100 text-green-700';
    return 'bg-gray-100 text-gray-700';
  }

  const filteredRequests = requests.filter((request) => {
    if (filter === 'open') return request.status === 'open';
    if (filter === 'answered') return request.status === 'answered';
    if (filter === 'unresolved') return request.status === 'unresolved';
    if (filter === 'closed') return request.status === 'closed';
    return true;
  });

  async function handleMarkAsUnresolved(requestId: string) {
    const newDueAt = newDueDates[requestId];

    if (!newDueAt) {
      alert('Defina um novo prazo para resposta');
      return;
    }

    setLoadingId(requestId);

    const { error } = await supabase
      .from('manager_requests')
      .update({
        status: 'unresolved',
        due_at: newDueAt,
      })
      .eq('id', requestId);

    if (error) {
      alert(error.message || 'Erro ao marcar como não resolvida');
      setLoadingId(null);
      return;
    }

    setOpenUnresolvedId(null);
    setLoadingId(null);
    await loadRequests();
    alert('Demanda marcada como não resolvida!');
  }

  async function handleMarkAsFinalized(requestId: string) {
    setLoadingId(requestId);

    const { data: authData } = await supabase.auth.getUser();

    if (!authData.user) {
      setLoadingId(null);
      return;
    }

    const { error } = await supabase
      .from('manager_requests')
      .update({
        status: 'closed',
      })
      .eq('id', requestId);

    if (error) {
      alert(error.message || 'Erro ao finalizar demanda');
      setLoadingId(null);
      return;
    }

    await supabase.from('manager_request_alert_views').upsert(
      {
        request_id: requestId,
        user_id: authData.user.id,
        alert_type: 'response_viewed',
      },
      {
        onConflict: 'request_id,user_id,alert_type',
      }
    );

    setLoadingId(null);
    await loadRequests();
    alert('Demanda finalizada com sucesso!');
  }

function formatCreatedAtBR(value: string | null | undefined) {
  if (!value) return '-';

  const normalizedValue = value.endsWith('Z') ? value : `${value}Z`;

  return new Date(normalizedValue).toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}


  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-gray-900">
          Minhas Demandas ao Gestor
        </h1>
        <p className="text-gray-500 mt-1">
          Acompanhe os retornos do gestor de forma organizada
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
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

        <Button
          type="button"
          variant={filter === 'unresolved' ? 'default' : 'outline'}
          onClick={() => setFilter('unresolved')}
        >
          Não resolvidas
        </Button>

        <Button
          type="button"
          variant={filter === 'closed' ? 'default' : 'outline'}
          onClick={() => setFilter('closed')}
        >
          Finalizadas
        </Button>
      </div>

      {filteredRequests.length === 0 ? (
        <Card className="p-10 text-center text-gray-500">
          Nenhuma demanda encontrada.
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredRequests.map((request) => (
            <Card key={request.id} className="p-6">
              <div className="flex flex-col gap-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-xl font-semibold text-gray-900">
                        {request.subject}
                      </h2>

                      {request.urgent && (
                        <span className="px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">
                          Urgente
                        </span>
                      )}

                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusClass(
                          request.status
                        )}`}
                      >
                        {getStatusLabel(request.status)}
                      </span>
                    </div>

                    <p className="text-sm text-gray-500">
	    	      Criada em: {formatCreatedAtBR(request.created_at)}
                    </p>

                    <p className="text-sm text-gray-500">
                      Prazo:{' '}
                      {new Date(request.due_at).toLocaleString('pt-BR', {
                        timeZone: 'America/Sao_Paulo',
                      })}
                    </p>
                  </div>
                </div>

                <div className="rounded-lg border bg-gray-50 p-4">
                  <p className="text-sm font-medium text-gray-700 mb-2">
                    Sua demanda
                  </p>
                  <p className="text-gray-800 whitespace-pre-wrap">
                    {request.message}
                  </p>
                </div>

                {request.response_text && (
                  <div className="rounded-lg border bg-blue-50 p-4">
                    <p className="text-sm font-medium text-blue-800 mb-2">
                      Resposta do gestor
                    </p>
                    <p className="text-gray-800 whitespace-pre-wrap">
                      {request.response_text}
                    </p>

                    {request.responded_at && (
                      <p className="text-xs text-gray-500 mt-3">
                        Respondida em:{' '}
                        {new Date(request.responded_at).toLocaleString('pt-BR', {
                          timeZone: 'America/Sao_Paulo',
                        })}
                      </p>
                    )}
                  </div>
                )}

                {(request.status === 'answered' || request.status === 'unresolved') && (
                  <div className="rounded-lg border bg-amber-50 p-4 space-y-3">
                    <p className="text-sm font-medium text-amber-800">
                      Se a resposta ainda não resolveu, você pode pedir continuidade
                      nesta mesma demanda.
                    </p>

                    {openUnresolvedId === request.id && (
                      <div className="space-y-2">
                        <label className="block text-sm font-medium text-gray-700">
                          Novo prazo para resposta
                        </label>

                        <Input
                          type="datetime-local"
                          value={newDueDates[request.id] || ''}
                          onChange={(e) =>
                            setNewDueDates((prev) => ({
                              ...prev,
                              [request.id]: e.target.value,
                            }))
                          }
                        />
                      </div>
                    )}

                    <div className="flex flex-wrap gap-2">
                      {request.status !== 'unresolved' && (
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() =>
                            setOpenUnresolvedId((prev) =>
                              prev === request.id ? null : request.id
                            )
                          }
                        >
                          {openUnresolvedId === request.id
                            ? 'Cancelar'
                            : 'Marcar com não resolvida'}
                        </Button>
                      )}

                      {openUnresolvedId === request.id && (
                        <Button
                          type="button"
                          onClick={() => handleMarkAsUnresolved(request.id)}
                          disabled={loadingId === request.id}
                          className="bg-orange-600 hover:bg-orange-700"
                        >
                          {loadingId === request.id
                            ? 'Salvando...'
                            : 'Confirmar não resolvida'}
                        </Button>
                      )}

                      <Button
                        type="button"
                        onClick={() => handleMarkAsFinalized(request.id)}
                        disabled={loadingId === request.id}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        {loadingId === request.id
                          ? 'Finalizando...'
                          : 'Marcar como finalizada'}
                      </Button>
                    </div>
                  </div>
                )}

                {request.status === 'closed' && (
                  <div className="rounded-lg border bg-green-50 p-4">
                    <p className="text-sm font-medium text-green-700">
                      Esta demanda foi finalizada e não gerará mais notificações.
                    </p>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}