import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Textarea } from '../ui/textarea';
import { Label } from '../ui/label';
import { supabase } from '../../lib/supabase';

type ManagerRequest = {
  id: string;
  subject: string;
  message: string;
  requester_name: string;
  due_at: string;
  status: string;
  response_text: string | null;
  responded_at: string | null;
};

type Attachment = {
  id: string;
  file_url: string;
  file_name: string | null;
};

export function ManagerRequestDetails() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [request, setRequest] = useState<ManagerRequest | null>(null);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [responseText, setResponseText] = useState('');

  useEffect(() => {
    loadRequest();
  }, []);

  async function loadRequest() {
    const { data: requestData } = await supabase
      .from('manager_requests')
      .select('*')
      .eq('id', id)
      .single();

    const { data: attachmentData } = await supabase
      .from('manager_request_attachments')
      .select('*')
      .eq('request_id', id);

    setRequest(requestData);
    setResponseText(requestData?.response_text || '');
    setAttachments(attachmentData || []);
  }

  async function handleRespond() {
    if (!responseText) {
      alert('Digite uma resposta');
      return;
    }

    const { error } = await supabase
      .from('manager_requests')
      .update({
        response_text: responseText,
        responded_at: new Date().toLocaleString('sv-SE', {
          timeZone: 'America/Sao_Paulo',
        }),
        status: 'answered',
      })
      .eq('id', id);

    if (error) {
      alert(error.message || 'Erro ao responder demanda');
      return;
    }

    alert('Resposta enviada!');
    navigate('/demandas-gestor');
  }

  function formatDateTimeBR(value: string | null | undefined) {
    if (!value) return '-';

    return new Date(value).toLocaleString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
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

  if (!request) {
    return (
      <p className="text-gray-600 dark:text-[#A1A1A1]">
        Carregando...
      </p>
    );
  }

  return (
    <div className="max-w-4xl space-y-6 min-h-screen bg-white dark:bg-[#0B0B0B] text-gray-900 dark:text-white p-1">
      <Button
        variant="outline"
        onClick={() => navigate(-1)}
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
        Voltar
      </Button>

      <Card className="p-6 bg-white dark:bg-[#121212] border border-gray-200 dark:border-[#1F1F1F]">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
          {request.subject}
        </h1>

        <p className="text-sm text-gray-500 dark:text-[#A1A1A1] mt-1">
          Enviado por: {request.requester_name}
        </p>

        <p className="text-sm text-gray-500 dark:text-[#A1A1A1] mt-1">
          Prazo: {formatDeadlineBR(request.due_at)}
        </p>

        <div className="mt-5">
          <h2 className="font-semibold mb-2 text-gray-900 dark:text-white">
            Mensagem
          </h2>

          <p className="text-gray-700 dark:text-[#A1A1A1] whitespace-pre-wrap">
            {request.message}
          </p>
        </div>

        {attachments.length > 0 && (
          <div className="mt-5">
            <h2 className="font-semibold mb-2 text-gray-900 dark:text-white">
              Anexos
            </h2>

            <div className="space-y-2">
              {attachments.map((attachment) => (
                <a
                  key={attachment.id}
                  href={attachment.file_url}
                  target="_blank"
                  rel="noreferrer"
                  className="block text-blue-600 dark:text-blue-400 hover:underline"
                >
                  {attachment.file_name || 'Ver anexo'}
                </a>
              ))}
            </div>
          </div>
        )}
      </Card>

      <Card className="p-6 bg-white dark:bg-[#121212] border border-gray-200 dark:border-[#1F1F1F]">
        <Label className="text-gray-900 dark:text-white">
          Resposta do gestor
        </Label>

        <Textarea
          value={responseText}
          onChange={(e) => setResponseText(e.target.value)}
          disabled={request.status === 'answered'}
          className="
            mt-2
            bg-white
            border-gray-300
            text-gray-900
            disabled:opacity-70
            dark:bg-[#181818]
            dark:border-[#2A2A2A]
            dark:text-white
          "
        />

        {request.status === 'answered' ? (
          <p className="text-green-600 dark:text-green-400 text-sm font-medium mt-3">
            Respondida em {formatDeadlineBR(request.responded_at)}
          </p>
        ) : (
          <Button
            onClick={handleRespond}
            className="
              bg-gray-900
              text-white
              hover:bg-black
              dark:bg-white
              dark:text-black
              dark:hover:bg-[#E5E5E5]
              mt-4
            "
          >
            Enviar resposta
          </Button>
        )}
      </Card>
    </div>
  );
}