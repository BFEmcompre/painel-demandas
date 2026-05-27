import { useEffect, useState } from 'react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { supabase } from '../../lib/supabase';

type Responsible = {
  id: string;
  name: string;
};

type Platform = {
  id: string;
  name: string;
  responsible_id: string;
  responsible_name: string;
  display_order: number;
  upload_deadline: string;
  active: boolean;
};

export function Platforms() {
  const [responsibles, setResponsibles] = useState<Responsible[]>([]);
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [name, setName] = useState('');
  const [responsibleId, setResponsibleId] = useState('');
  const [displayOrder, setDisplayOrder] = useState('0');
  const [uploadDeadline, setUploadDeadline] = useState('09:00');
  const [uploadFilter, setUploadFilter] = useState('all');
  const [todayUploads, setTodayUploads] = useState<any[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const { data: respData } = await supabase
      .from('profiles')
      .select('id, name')
      .eq('role', 'responsible')
      .order('name');

    const { data: platformData } = await supabase
      .from('platforms')
      .select('*')
      .order('display_order', { ascending: true });

    setResponsibles(respData || []);
    setPlatforms(platformData || []);

    const today = new Date().toLocaleDateString('sv-SE', {
      timeZone: 'America/Sao_Paulo',
    });

    const { data: uploadsData } = await supabase
      .from('platform_indicator_images')
      .select('platform_id, responsible_id')
      .eq('reference_date', today);

    setTodayUploads(uploadsData || []);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();

    const responsible = responsibles.find(
      (r) => r.id === responsibleId
    );

    if (!name || !responsible) {
      alert('Preencha a plataforma e o responsável');
      return;
    }

    const { error } = await supabase.from('platforms').insert({
      name,
      responsible_id: responsible.id,
      responsible_name: responsible.name,
      display_order: Number(displayOrder || 0),
      upload_deadline: uploadDeadline,
      active: true,
    });

    if (error) {
      alert('Erro ao cadastrar plataforma');
      return;
    }

    setName('');
    setResponsibleId('');
    setDisplayOrder('0');

    loadData();
  }

  function hasSentToday(platform: Platform) {
    return todayUploads.some(
      (upload) =>
        upload.platform_id === platform.id &&
        upload.responsible_id === platform.responsible_id
    );
  }

  const filteredPlatforms = platforms.filter((platform) => {
    if (uploadFilter === 'sent') return hasSentToday(platform);
    if (uploadFilter === 'pending') return !hasSentToday(platform);
    return true;
  });

async function handleDeletePlatform(platformId: string) {
  const confirmDelete = window.confirm(
    'Tem certeza que deseja excluir este indicador definitivamente?\n\nIsso também removerá imagens e categorias vinculadas.'
  );

  if (!confirmDelete) return;

  const { error: imagesError } = await supabase
    .from('platform_indicator_images')
    .delete()
    .eq('platform_id', platformId);

  if (imagesError) {
    alert(imagesError.message || 'Erro ao excluir imagens');
    return;
  }

  const { error: sectionsError } = await supabase
    .from('platform_indicator_sections')
    .delete()
    .eq('platform_id', platformId);

  if (sectionsError) {
    alert(sectionsError.message || 'Erro ao excluir categorias');
    return;
  }

  const { error: platformError } = await supabase
    .from('platforms')
    .delete()
    .eq('id', platformId);

  if (platformError) {
    alert(platformError.message || 'Erro ao excluir indicador');
    return;
  }

  alert('Indicador excluído definitivamente!');
  loadData();
}


  return (
    <div className="space-y-6 min-h-screen bg-white dark:bg-[#0B0B0B] text-gray-900 dark:text-white p-1">

      <div>
        <h1 className="text-3xl font-semibold text-gray-900 dark:text-white">
          Indicadores
        </h1>

        <p className="text-gray-500 dark:text-[#A1A1A1] mt-1">
          Vincule plataformas a responsáveis
        </p>
      </div>

      <Card className="
        p-6
        bg-white
        dark:bg-[#121212]
        border
        border-gray-200
        dark:border-[#1F1F1F]
      ">

        <form
          onSubmit={handleCreate}
          className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end"
        >

          <div className="space-y-2">

            <Label className="text-gray-900 dark:text-white">
              Plataforma
            </Label>

            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="
                bg-white
                border-gray-300
                text-gray-900
                dark:bg-[#181818]
                dark:border-[#2A2A2A]
                dark:text-white
              "
            />

          </div>

          <div className="space-y-2">

            <Label className="text-gray-900 dark:text-white">
              Responsável
            </Label>

            <Select
              value={responsibleId}
              onValueChange={setResponsibleId}
            >

              <SelectTrigger className="
                bg-white
                border-gray-300
                text-gray-900
                dark:bg-[#181818]
                dark:border-[#2A2A2A]
                dark:text-white
              ">
                <SelectValue placeholder="Selecionar" />
              </SelectTrigger>

              <SelectContent className="
                dark:bg-[#181818]
                dark:border-[#2A2A2A]
              ">
                {responsibles.map((resp) => (
                  <SelectItem
                    key={resp.id}
                    value={resp.id}
                  >
                    {resp.name}
                  </SelectItem>
                ))}
              </SelectContent>

            </Select>

          </div>

          <div className="space-y-2">

            <Label className="text-gray-900 dark:text-white">
              Ordem
            </Label>

            <Input
              type="number"
              value={displayOrder}
              onChange={(e) =>
                setDisplayOrder(e.target.value)
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

          </div>

          <div className="space-y-2">

            <Label className="text-gray-900 dark:text-white">
              Enviar até
            </Label>

            <Input
              type="time"
              value={uploadDeadline}
              onChange={(e) =>
                setUploadDeadline(e.target.value)
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

          </div>

          <Button
            type="submit"
            className="
              bg-gray-900
              text-white
              hover:bg-black
              dark:bg-white
              dark:text-black
              dark:hover:bg-[#E5E5E5]
            "
          >
            Cadastrar
          </Button>

        </form>
      </Card>

      <Card className="
        p-6
        bg-white
        dark:bg-[#121212]
        border
        border-gray-200
        dark:border-[#1F1F1F]
      ">

        <h2 className="font-semibold mb-4 text-gray-900 dark:text-white">
          Plataformas cadastradas
        </h2>

        <div className="flex gap-2 mb-4 flex-wrap">

          <Button
            type="button"
            variant={uploadFilter === 'all' ? 'default' : 'outline'}
            onClick={() => setUploadFilter('all')}
            className="
              dark:border-[#2A2A2A]
              dark:bg-[#181818]
              dark:text-white
              dark:hover:bg-[#242424]
            "
          >
            Todos
          </Button>

          <Button
            type="button"
            variant={uploadFilter === 'sent' ? 'default' : 'outline'}
            onClick={() => setUploadFilter('sent')}
            className="
              dark:border-[#2A2A2A]
              dark:bg-[#181818]
              dark:text-white
              dark:hover:bg-[#242424]
            "
          >
            Enviados hoje
          </Button>

          <Button
            type="button"
            variant={uploadFilter === 'pending' ? 'default' : 'outline'}
            onClick={() => setUploadFilter('pending')}
            className="
              dark:border-[#2A2A2A]
              dark:bg-[#181818]
              dark:text-white
              dark:hover:bg-[#242424]
            "
          >
            Não enviados
          </Button>

        </div>

        <div className="space-y-3">

          {filteredPlatforms.map((platform) => (

            <div
              key={platform.id}
              className="
                border
                border-gray-200
                dark:border-[#1F1F1F]
                rounded-lg
                p-4
                bg-white
                dark:bg-[#181818]
              "
            >

              <div className="flex justify-between items-center gap-4">

                <div>

                  <p className="font-medium text-gray-900 dark:text-white">
                    {platform.name}
                  </p>

                  <p className="text-sm text-gray-500 dark:text-[#A1A1A1]">
                    Responsável: {platform.responsible_name}
                  </p>

                  <p className="text-sm text-gray-500 dark:text-[#A1A1A1]">
                    Ordem: {platform.display_order}
                  </p>

                  <p className="text-sm text-gray-500 dark:text-[#A1A1A1]">
                    Prazo: {platform.upload_deadline}
                  </p>

                  {hasSentToday(platform) ? (
                    <p className="text-green-600 dark:text-green-400 text-sm font-medium mt-2">
                      ✔ Enviado hoje
                    </p>
                  ) : (
                    <p className="text-red-600 dark:text-red-400 text-sm font-medium mt-2">
                      Pendente
                    </p>
                  )}

                </div>

<div className="flex gap-2">

  <Button
    variant="outline"
    onClick={async () => {

      const newName = prompt(
        'Novo nome da plataforma',
        platform.name
      );

      if (!newName) return;

      const newResponsible = prompt(
        'Novo ID do responsável',
        platform.responsible_id
      );

      if (!newResponsible) return;

      const newOrder = prompt(
        'Nova ordem',
        String(platform.display_order)
      );

      if (!newOrder) return;

      const newDeadline = prompt(
        'Novo prazo',
        platform.upload_deadline
      );

      if (!newDeadline) return;

      const responsible = responsibles.find(
        (r) => r.id === newResponsible
      );

      await supabase
        .from('platforms')
        .update({
          name: newName,
          responsible_id: newResponsible,
          responsible_name: responsible?.name || '',
          display_order: Number(newOrder),
          upload_deadline: newDeadline,
        })
        .eq('id', platform.id);

      loadData();
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
    Editar
  </Button>

  <Button
    variant="outline"
    onClick={() => handleDeletePlatform(platform.id)}
    className="
      border-red-300
      text-red-600
      hover:bg-red-50
      dark:border-red-900
      dark:text-red-400
      dark:hover:bg-red-950
    "
  >
    Excluir
  </Button>

</div>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}