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
responded_at: new Date().toISOString(),
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


  if (!request) return <p>Carregando...</p>;




  return (
    <div className="max-w-4xl space-y-6">
      <Button variant="outline" onClick={() => navigate(-1)}>
        Voltar
      </Button>

      <Card className="p-6">
        <h1 className="text-2xl font-semibold">{request.subject}</h1>

        <p className="text-sm text-gray-500 mt-1">
          Enviado por: {request.requester_name}
        </p>

        <p className="text-sm text-gray-500 mt-1">
          Prazo: {formatDateTimeBR(request.due_at)}
        </p>

        <div className="mt-5">
          <h2 className="font-semibold mb-2">Mensagem</h2>
          <p className="text-gray-700 whitespace-pre-wrap">{request.message}</p>
        </div>

        {attachments.length > 0 && (
          <div className="mt-5">
            <h2 className="font-semibold mb-2">Anexos</h2>
            <div className="space-y-2">
              {attachments.map((attachment) => (
                <a
                  key={attachment.id}
                  href={attachment.file_url}
                  target="_blank"
                  rel="noreferrer"
                  className="block text-blue-600 hover:underline"
                >
                  {attachment.file_name || 'Ver anexo'}
                </a>
              ))}
            </div>
          </div>
        )}
      </Card>

      <Card className="p-6">
        <Label>Resposta do gestor</Label>

        <Textarea
          value={responseText}
          onChange={(e) => setResponseText(e.target.value)}
          disabled={request.status === 'answered'}
          className="mt-2"
        />

        {request.status === 'answered' ? (
          <p className="text-green-600 text-sm font-medium mt-3">
            Respondida em {formatDateTimeBR(request.responded_at)}
          </p>
        ) : (
          <Button
            onClick={handleRespond}
            className="bg-blue-600 hover:bg-blue-700 mt-4"
          >
            Enviar resposta
          </Button>
        )}
      </Card>
    </div>
  );
}