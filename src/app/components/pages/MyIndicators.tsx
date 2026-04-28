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

export function MyIndicators() {
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [sections, setSections] = useState<Record<string, Section[]>>({});
const [newSectionName, setNewSectionName] = useState('');
  const [userId, setUserId] = useState('');
  const [userName, setUserName] = useState('');

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

  }

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
    const fileName = `${Date.now()}-${file.name}`;

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
      section_id: sectionId,
      image_url: data.publicUrl,
      reference_date: new Date().toLocaleDateString('sv-SE', {
        timeZone: 'America/Sao_Paulo',
      }),
    });
  }

  await supabase.from('platform_indicator_images').insert(uploads);

  alert('Enviado!');
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
      display_order: Date.now(),
    });

  if (!error) {
    setNewSectionName('');
    loadData();
  }
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
        placeholder="Nova categoria"
        className="border px-3 py-2 rounded w-full"
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
        <span>{section.name}</span>

        <label className="cursor-pointer">
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) =>
              handleUploadWithSection(
                platform,
                section.id,
                e.target.files
              )
            }
          />

          <div className="bg-blue-600 text-white px-3 py-1 rounded">
            Upload
          </div>
        </label>
      </div>
    ))}
  </Card>
))
      )}
    </div>
  );
}