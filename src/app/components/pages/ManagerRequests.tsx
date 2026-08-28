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
  urgent: boolean;
  response_text: string | null;
  responded_at: string | null;
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
    return (
      ['open', 'unresolved'].includes(request.status) &&
      new Date(request.due_at) < new Date()
    );
  }

  function getStatusLabel(status: string) {
    if (status === 'open') return 'Em aberto';
    if (status === 'answered') return 'Respondida';
    if (status === 'unresolved') return 'Não resolvida';
    if (status === 'closed') return 'Finalizada';
    return status;
  }

  function getStatusClass(status: string) {
    if (status === 'open') {
      return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-500/10 dark:text-yellow-300';
    }

    if (status === 'answered') {
      return 'bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400';
    }

    if (status === 'unresolved') {
      return 'bg-orange-100 text-orange-700 dark:bg-orange-500/10 dark:text-orange-400';
    }

    if (status === 'closed') {
      return 'bg-green-100 text-green-700 dark:bg-green-500/10 dark:text-green-400';
    }

    return 'bg-gray-100 text-gray-700 dark:bg-gray-500/10 dark:text-gray-300';
  }

  const filteredRequests = requests.filter((request) => {
    if (filter === 'open') {
      return (
        ['open', 'unresolved'].includes(request.status) &&
        !isOverdue(request)
      );
    }

    if (filter === 'overdue') return isOverdue(request);
    if (filter === 'urgent') return request.urgent === true;
    if (filter === 'unresolved') return request.status === 'unresolved';
    if (filter === 'answered') return request.status === 'answered';
    if (filter === 'closed') return request.status === 'closed';

    return true;
  });

  const orderedRequests = [...filteredRequests].sort((a, b) => {
    if (a.urgent && !b.urgent) return -1;
    if (!a.urgent && b.urgent) return 1;

    const aOverdue = isOverdue(a);
    const bOverdue = isOverdue(b);

    if (aOverdue && !bOverdue) return -1;
    if (!aOverdue && bOverdue) return 1;

    return (
      new Date(a.due_at).getTime() -
      new Date(b.due_at).getTime()
    );
  });

  function formatCreatedAtBR(value: string | null | undefined) {
    if (!value) return '-';

    const normalizedValue = value.endsWith('Z')
      ? value
      : `${value}Z`;

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

  function formatDeadlineBR(value: string | null | undefined) {
    if (!value) return '-';

    const cleanValue = value.replace('T', ' ').replace('Z', '');
    const [datePart, timePart = ''] = cleanValue.split(' ');
    const [year, month, day] = datePart.split('-');
    const [hour = '00', minute = '00'] = timePart.split(':');

    return `${day}/${month}/${year}, ${hour}:${minute}`;
  }

  function formatResponseDateBR(value: string | null | undefined) {
    if (!value) return '-';

    return new Date(value).toLocaleString('pt-BR', {
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
    <div className="space-y-6 min-h-screen bg-white dark:bg-[#0B0B0B] text-gray-900 dark:text-white p-1">
      
      <div>
        <h1 className="text-3xl font-semibold text-gray-900 dark:text-white">
          Demandas Recebidas
        </h1>

        <p className="text-gray-500 dark:text-[#A1A1A1] mt-1">
          Acompanhe demandas enviadas pelos responsáveis
        </p>
      </div>

      <div className="flex flex-wrap gap-2">

        <Button
          type="button"
          variant={filter === 'open' ? 'default' : 'outline'}
          onClick={() => setFilter('open')}
          className="
            dark:border-[#2A2A2A]
            dark:bg-[#181818]
            dark:text-white
            dark:hover:bg-[#242424]
          "
        >
          Em aberto
        </Button>

        <Button
          type="button"
          variant={filter === 'overdue' ? 'default' : 'outline'}
          onClick={() => setFilter('overdue')}
          className="
            dark:border-[#2A2A2A]
            dark:bg-[#181818]
            dark:text-white
            dark:hover:bg-[#242424]
          "
        >
          Vencidas
        </Button>

        <Button
          type="button"
          variant={filter === 'urgent' ? 'default' : 'outline'}
          onClick={() => setFilter('urgent')}
          className="
            dark:border-[#2A2A2A]
            dark:bg-[#181818]
            dark:text-white
            dark:hover:bg-[#242424]
          "
        >
          Urgentes
        </Button>

        <Button
          type="button"
          variant={filter === 'unresolved' ? 'default' : 'outline'}
          onClick={() => setFilter('unresolved')}
          className="
            dark:border-[#2A2A2A]
            dark:bg-[#181818]
            dark:text-white
            dark:hover:bg-[#242424]
          "
        >
          Não resolvidas
        </Button>

        <Button
          type="button"
          variant={filter === 'answered' ? 'default' : 'outline'}
          onClick={() => setFilter('answered')}
          className="
            dark:border-[#2A2A2A]
            dark:bg-[#181818]
            dark:text-white
            dark:hover:bg-[#242424]
          "
        >
          Respondidas
        </Button>

        <Button
          type="button"
          variant={filter === 'closed' ? 'default' : 'outline'}
          onClick={() => setFilter('closed')}
          className="
            dark:border-[#2A2A2A]
            dark:bg-[#181818]
            dark:text-white
            dark:hover:bg-[#242424]
          "
        >
          Finalizadas
        </Button>

        <Button
          type="button"
          variant={filter === 'all' ? 'default' : 'outline'}
          onClick={() => setFilter('all')}
          className="
            dark:border-[#2A2A2A]
            dark:bg-[#181818]
            dark:text-white
            dark:hover:bg-[#242424]
          "
        >
          Todas
        </Button>

      </div>

      {orderedRequests.length === 0 ? (

        <Card className="
          p-10
          text-center
          text-gray-500
          dark:text-[#A1A1A1]
          bg-white
          dark:bg-[#121212]
          border
          border-gray-200
          dark:border-[#1F1F1F]
        ">
          Nenhuma demanda encontrada.
        </Card>

      ) : (

        <div className="space-y-4">

          {orderedRequests.map((request) => (

            <Card
              key={request.id}
              className={`
                p-6
                cursor-pointer
                transition-colors
                bg-white
                dark:bg-[#121212]
                border
                border-gray-200
                dark:border-[#1F1F1F]
                hover:bg-gray-50
                dark:hover:bg-[#181818]
                ${request.urgent ? 'border-red-300 dark:border-red-500/30' : ''}
              `}
              onClick={() =>
                navigate(`/demandas-gestor/${request.id}`)
              }
            >

              <div className="flex flex-col gap-4">

                <div className="flex items-start justify-between gap-4">

                  <div className="space-y-2">

                    <div className="flex items-center gap-2 flex-wrap">

                      <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                        {request.subject}
                      </h2>

                      {request.urgent && (
                        <span className="
                          px-2
                          py-1
                          rounded-full
                          text-xs
                          font-bold
                          bg-red-100
                          text-red-700
                          dark:bg-red-500/10
                          dark:text-red-400
                        ">
                          ⚠ URGENTE
                        </span>
                      )}

                      {isOverdue(request) && (
                        <span className="
                          px-2
                          py-1
                          rounded-full
                          text-xs
                          font-bold
                          bg-red-100
                          text-red-700
                          dark:bg-red-500/10
                          dark:text-red-400
                        ">
                          Vencida
                        </span>
                      )}

                      <span
                        className={`
                          px-2
                          py-1
                          rounded-full
                          text-xs
                          font-medium
                          ${getStatusClass(request.status)}
                        `}
                      >
                        {getStatusLabel(request.status)}
                      </span>

                    </div>

                    <p className="text-sm text-gray-500 dark:text-[#A1A1A1]">
                      Enviado por: {request.requester_name}
                    </p>

                    <p className="text-sm text-gray-500 dark:text-[#A1A1A1]">
                      Criada em: {formatCreatedAtBR(request.created_at)}
                    </p>

                    <p className="text-sm text-gray-500 dark:text-[#A1A1A1]">
                      Prazo: {formatDeadlineBR(request.due_at)}
                    </p>

                  </div>
                </div>

                <div className="
                  rounded-lg
                  border
                  border-gray-200
                  dark:border-[#1F1F1F]
                  bg-gray-50
                  dark:bg-[#181818]
                  p-4
                ">
                  <p className="text-sm font-medium text-gray-700 dark:text-[#A1A1A1] mb-2">
                    Demanda enviada
                  </p>

                  <p className="text-gray-800 dark:text-white whitespace-pre-wrap line-clamp-3">
                    {request.message}
                  </p>
                </div>

                {request.response_text && (

                  <div className="
                    rounded-lg
                    border
                    border-blue-200
                    dark:border-blue-500/20
                    bg-blue-50
                    dark:bg-blue-500/5
                    p-4
                  ">

                    <p className="text-sm font-medium text-blue-800 dark:text-blue-400 mb-2">
                      Última resposta do gestor
                    </p>

                    <p className="text-gray-800 dark:text-white whitespace-pre-wrap line-clamp-3">
                      {request.response_text}
                    </p>

                    {request.responded_at && (
                      <p className="text-xs text-gray-500 dark:text-[#A1A1A1] mt-3">
                        Respondida em:{' '}
                        {formatResponseDateBR(request.responded_at)}
                      </p>
                    )}

                  </div>
                )}

                <div className="flex justify-end">

                  <Button
                    type="button"
                    variant="outline"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/demandas-gestor/${request.id}`);
                    }}
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
                    Abrir demanda
                  </Button>

                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}