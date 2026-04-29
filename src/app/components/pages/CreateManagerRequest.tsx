import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { supabase } from '../../lib/supabase';

export function CreateManagerRequest() {
  const navigate = useNavigate();
  const [urgent, setUrgent] = useState(false);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [dueAt, setDueAt] = useState('');
  const [files, setFiles] = useState<FileList | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!subject || !message || !dueAt) {
      alert('Preencha assunto, texto e prazo');
      return;
    }

    const { data: authData } = await supabase.auth.getUser();

    if (!authData.user) return;

    const { data: profile } = await supabase
      .from('profiles')
      .select('id, name')
      .eq('id', authData.user.id)
      .single();

    if (!profile) return;

    const { data: request, error } = await supabase
      .from('manager_requests')
      .insert({
        subject,
        message,
        requester_id: profile.id,
        requester_name: profile.name,
        due_at: dueAt,
        status: 'open',
        urgent,
      })
      .select()
      .single();

    if (error || !request) {
      alert(error?.message || 'Erro ao enviar demanda');
      return;
    }

    if (files && files.length > 0) {
      const attachments = [];

      for (const file of Array.from(files)) {
        const fileName = `${request.id}/${Date.now()}-${file.name}`;

        const { error: uploadError } = await supabase.storage
          .from('manager-request-attachments')
          .upload(fileName, file);

        if (uploadError) {
          alert(uploadError.message || 'Erro ao enviar anexo');
          return;
        }

        const { data } = supabase.storage
          .from('manager-request-attachments')
          .getPublicUrl(fileName);

        attachments.push({
          request_id: request.id,
          file_url: data.publicUrl,
          file_name: file.name,
        });
      }

      const { error: attachError } = await supabase
        .from('manager_request_attachments')
        .insert(attachments);

      if (attachError) {
        alert(attachError.message || 'Erro ao salvar anexos');
        return;
      }
    }

    alert('Demanda enviada ao gestor!');
    navigate('/minhas-demandas-gestor');
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-gray-900">Enviar Demanda ao Gestor</h1>
        <p className="text-gray-500 mt-1">Solicite uma resposta do gestor com prazo definido</p>
      </div>

      <Card className="p-6">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label>Assunto *</Label>
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label>Texto *</Label>
            <Textarea value={message} onChange={(e) => setMessage(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label>Prazo para resposta *</Label>
            <Input
              type="datetime-local"
              value={dueAt}
              onChange={(e) => setDueAt(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Anexo</Label>
            <Input
              type="file"
              multiple
              onChange={(e) => setFiles(e.target.files)}
            />
          </div>

	<label className="flex items-center gap-2">
  <input
    type="checkbox"
    checked={urgent}
    onChange={(e) => setUrgent(e.target.checked)}
  />
  <span className="text-sm font-medium text-red-600">
    Marcar como urgente
  </span>
</label>	

          <Button type="submit" className="bg-blue-600 hover:bg-blue-700">
            Enviar demanda
          </Button>
        </form>
      </Card>
    </div>
  );
}