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
};

export function MyIndicators() {
  const [platforms, setPlatforms] = useState<Platform[]>([]);
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
  }

  async function handleUpload(platform: Platform, files: FileList | null) {
    if (!files || files.length === 0) return;

    const uploads = [];

    for (const file of Array.from(files)) {
      const extension = file.name.split('.').pop() || 'jpg';
      const fileName = `${platform.id}-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2)}.${extension}`;

      const { error: uploadError } = await supabase.storage
        .from('platform-indicators')
        .upload(fileName, file);

      if (uploadError) {
        alert('Erro ao enviar imagem');
        return;
      }

      const { data } = supabase.storage
        .from('platform-indicators')
        .getPublicUrl(fileName);

      uploads.push({
        platform_id: platform.id,
        responsible_id: userId,
        responsible_name: userName,
        image_url: data.publicUrl,
        reference_date: getToday(),
      });
    }

    const { error } = await supabase
      .from('platform_indicator_images')
      .insert(uploads);

    if (error) {
      alert('Erro ao salvar indicadores');
      return;
    }

    alert('Imagem(ns) enviada(s) com sucesso!');
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
          <Card key={platform.id} className="p-6 flex justify-between items-center">
            <div>
              <h2 className="font-semibold text-lg">{platform.name}</h2>
              <p className="text-sm text-gray-500">Responsável: {platform.responsible_name}</p>
            </div>

            <label>
              <input
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => handleUpload(platform, e.target.files)}
              />

              <Button type="button" className="bg-blue-600 hover:bg-blue-700">
                <Upload className="w-4 h-4 mr-2" />
                Enviar prints
              </Button>
            </label>
          </Card>
        ))
      )}
    </div>
  );
}