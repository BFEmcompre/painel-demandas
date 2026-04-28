import { useEffect, useState } from 'react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
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
      .order('display_order');

    setResponsibles(respData || []);
    setPlatforms(platformData || []);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();

    const responsible = responsibles.find((r) => r.id === responsibleId);

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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-gray-900">Indicadores</h1>
        <p className="text-gray-500 mt-1">Cadastre as plataformas e responsáveis</p>
      </div>

      <Card className="p-6">
        <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
          <div className="space-y-2">
            <Label>Plataforma</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label>Responsável</Label>
            <Select value={responsibleId} onValueChange={setResponsibleId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecionar" />
              </SelectTrigger>
              <SelectContent>
                {responsibles.map((resp) => (
                  <SelectItem key={resp.id} value={resp.id}>
                    {resp.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Ordem</Label>
            <Input
              type="number"
              value={displayOrder}
              onChange={(e) => setDisplayOrder(e.target.value)}
            />
          </div>
	<div className="space-y-2">
  <Label>Enviar até</Label>
  <Input
    type="time"
    value={uploadDeadline}
    onChange={(e) => setUploadDeadline(e.target.value)}
  />
</div>

<Button
  variant="outline"
  onClick={async () => {
    const today = new Date().toLocaleDateString('sv-SE', {
      timeZone: 'America/Sao_Paulo',
    });

    const { data: platformsData } = await supabase
      .from('platforms')
      .select('*');

    const { data: images } = await supabase
      .from('platform_indicator_images')
      .select('*')
      .eq('reference_date', today);

    const pending = platformsData?.filter((p) => {
      return !images?.some(
        (img) =>
          img.platform_id === p.id &&
          img.responsible_id === p.responsible_id
      );
    });

    alert(
      pending?.length === 0
        ? 'Todos enviaram'
        : pending?.map((p) => `${p.name} - ${p.responsible_name}`).join('\n')
    );
  }}
>
  Ver quem não enviou
</Button>

          <Button type="submit" className="bg-blue-600 hover:bg-blue-700">
            Cadastrar
          </Button>
        </form>
      </Card>

      <Card className="p-6">
        <h2 className="font-semibold mb-4">Plataformas cadastradas</h2>

        <div className="space-y-3">
          {platforms.map((platform) => (
            <div key={platform.id} className="border rounded-lg p-4 flex justify-between">
              <div key={platform.id} className="border p-4 rounded flex justify-between items-center">
  <div>
    <p className="font-medium">{platform.name}</p>
    <p className="text-sm text-gray-500">
      Responsável: {platform.responsible_name}
    </p>
  </div>

  <Button
    variant="outline"
    onClick={async () => {
      const newName = prompt('Novo nome', platform.name);
      if (!newName) return;

      await supabase
        .from('platforms')
        .update({ name: newName })
        .eq('id', platform.id);

      loadData();
    }}
  >
    Editar
  </Button>
</div>
              <span className="text-sm text-gray-500">Ordem: {platform.display_order}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}