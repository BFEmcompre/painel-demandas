import { useEffect, useState } from 'react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Upload } from 'lucide-react';
import { supabase } from '../../lib/supabase';

type Platform = {
  id: string;
  name: string;
  responsible_id: string;
  responsible_name: string;
  display_order: number;
};
type Section = {
  id: string;
  platform_id: string;
  name: string;
  display_order: number;
};

type SentImage = {
  platform_id: string;
  section_id: string | null;
};

export function MyIndicators() {
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [sections, setSections] = useState<Record<string, Section[]>>({});
const [newSectionName, setNewSectionName] = useState('');
const [newSectionOrder, setNewSectionOrder] = useState('');
  const [userId, setUserId] = useState('');
  const [userName, setUserName] = useState('');
const [sentImages, setSentImages] = useState<SentImage[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  function getToday() {
    return new Date().toLocaleDateString('sv-SE', {
      timeZone: 'America/Sao_Paulo',
    });
  }

  async function loadData() {
    const { data: authData } = await supabase.auth.getUser();

    if (!authData?.user) return;

    const { data: profile } = await supabase
      .from('profiles')
      .select('id, name')
      .eq('id', authData.user.id)
      .single();

    if (!profile) return;

    setUserId(profile.id);
    setUserName(profile.name);

    const { data } = await supabase
      .from('platforms')
      .select('*')
      .eq('responsible_id', profile.id)
      .eq('active', true)
      .order('display_order');

    setPlatforms(data || []);

const { data: sectionsData } = await supabase
  .from('platform_indicator_sections')
  .select('*')
  .eq('responsible_id', profile.id)
  .order('display_order');

const grouped: Record<string, Section[]> = {};

sectionsData?.forEach((section) => {
  if (!grouped[section.platform_id]) {
    grouped[section.platform_id] = [];
  }
  grouped[section.platform_id].push(section);
});

setSections(grouped);
const today = getToday();

const { data: sentData, error: sentError } = await supabase
  .from('platform_indicator_images')
  .select('platform_id, section_id')
  .eq('responsible_id', profile.id)
  .eq('reference_date', today);

if (sentError) {
  console.error(sentError);
  return;
}

setSentImages(sentData || []);

async function handleUploadWithSection(
  platform: Platform,
  sectionId: string,
  files: FileList | null
) {
  if (!files || files.length === 0) return;

  const { data: authData } = await supabase.auth.getUser();
  if (!authData?.user) return;

  const uploads = [];

  for (const file of Array.from(files)) {
    const fileName = `${platform.id}/${sectionId}/${Date.now()}-${file.name}`;

    const { error } = await supabase.storage
      .from('platform-indicators')
      .upload(fileName, file);

    if (error) {
      alert('Erro ao enviar');
      return;
    }

    const { data } = supabase.storage
      .from('platform-indicators')
      .getPublicUrl(fileName);

uploads.push({
  platform_id: platform.id,
  responsible_id: authData.user.id,
  responsible_name: userName,
  section_id: sectionId,
  image_url: data.publicUrl,
  reference_date: new Date().toLocaleDateString('sv-SE', {
    timeZone: 'America/Sao_Paulo',
  }),
});
  }

const { error: insertError } = await supabase
  .from('platform_indicator_images')
  .insert(uploads);

if (insertError) {
  alert(insertError.message || 'Erro ao salvar imagem');
  return;
}

alert('Enviado!');
loadData();
}

async function handleCreateSection(platformId: string) {
  if (!newSectionName) return;

  const { data: authData } = await supabase.auth.getUser();

  if (!authData?.user) return;

  const { error } = await supabase
    .from('platform_indicator_sections')
    .insert({
      platform_id: platformId,
      responsible_id: authData.user.id,
      name: newSectionName,
      display_order: Number(newSectionOrder || 0),
    });

  if (!error) {
    setNewSectionName('');
    setNewSectionOrder('');
    loadData();
  }
}

async function handleDeleteSection(sectionId: string) {
  const confirmDelete = confirm('Deseja excluir esta categoria?');

  if (!confirmDelete) return;

  const { error } = await supabase
    .from('platform_indicator_sections')
    .delete()
    .eq('id', sectionId);

  if (error) {
    alert(error.message || 'Erro ao excluir categoria');
    return;
  }

  loadData();
}

function hasSentImage(platformId: string, sectionId: string) {
  return sentImages.some(
    (img) => img.platform_id === platformId && img.section_id === sectionId
  );
}

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-gray-900">Meus Indicadores</h1>
        <p className="text-gray-500 mt-1">Envie os prints das plataformas do dia</p>
      </div>

      {platforms.length === 0 ? (
        <Card className="p-10 text-center text-gray-500">
          Nenhuma plataforma vinculada a você.
        </Card>
      ) : (
platforms.map((platform) => (
  <Card key={platform.id} className="p-6 space-y-4">
    <div className="flex justify-between items-center">
      <div>
        <h2 className="font-semibold text-lg">{platform.name}</h2>
      </div>
    </div>

    {/* Criar categoria */}
    <div className="flex gap-2">
<input
  value={newSectionName}
  onChange={(e) => setNewSectionName(e.target.value)}
  placeholder="Nome da categoria"
  className="border px-3 py-2 rounded w-full"
/>

<input
  type="number"
  value={newSectionOrder}
  onChange={(e) => setNewSectionOrder(e.target.value)}
  placeholder="Ordem da categoria"
  className="border px-3 py-2 rounded w-24"
/>
      <Button onClick={() => handleCreateSection(platform.id)}>
        Criar
      </Button>
    </div>

    {/* Lista de categorias */}
    {(sections[platform.id] || []).map((section) => (
      <div
  key={section.id}
  className="flex justify-between items-center border rounded p-3"
>
  <div>
    <span className="font-medium">{section.display_order} - {section.name}</span>
  </div>

  <div className="flex items-center gap-2">
{hasSentImage(platform.id, section.id) ? (
  <span className="text-green-600 text-sm font-medium">
    ✔ Enviado hoje
  </span>
) : null}

  <label className="cursor-pointer">
  <input
    type="file"
    accept="image/*"
    className="hidden"
    onChange={(e) =>
      handleUploadWithSection(platform, section.id, e.target.files)
    }
  />

<div
  className={`px-3 py-1 rounded text-white ${
    hasSentImage(platform.id, section.id)
      ? 'bg-yellow-500'
      : 'bg-blue-600'
  }`}
>
  {hasSentImage(platform.id, section.id) ? 'Substituir' : 'Upload'}
</div>
</label>

  <Button
    type="button"
    variant="outline"
    onClick={() => handleDeleteSection(section.id)}
  >
    Excluir
  </Button>
        </div>
      </div>
        ))}
  </Card>
))
      )}
    </div>
  );
}