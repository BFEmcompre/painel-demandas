import { useEffect, useState } from 'react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { supabase } from '../../lib/supabase';

type Platform = {
  id: string;
  name: string;
  responsible_name: string;
};

type IndicatorImage = {
  id: string;
  platform_id: string;
  image_url: string;
  reference_date: string;
};

type Slide = {
  platform: Platform;
  yesterdayImages: IndicatorImage[];
  todayImages: IndicatorImage[];
};

export function IndicatorsPresentation() {
  const [slides, setSlides] = useState<Slide[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    loadPresentation();
  }, []);

  function getDate(offset: number) {
    const date = new Date();
    date.setDate(date.getDate() + offset);

    return date.toLocaleDateString('sv-SE', {
      timeZone: 'America/Sao_Paulo',
    });
  }

  async function loadPresentation() {
    const today = getDate(0);
    const yesterday = getDate(-1);

    const { data: platforms } = await supabase
      .from('platforms')
      .select('id, name, responsible_name')
      .eq('active', true)
      .order('display_order');

    const { data: images } = await supabase
      .from('platform_indicator_images')
      .select('*')
      .in('reference_date', [today, yesterday]);

    const result =
      platforms?.map((platform) => ({
        platform,
        yesterdayImages:
          images?.filter(
            (img) =>
              img.platform_id === platform.id &&
              img.reference_date === yesterday
          ) || [],
        todayImages:
          images?.filter(
            (img) =>
              img.platform_id === platform.id &&
              img.reference_date === today
          ) || [],
      })) || [];

    setSlides(result);
  }

  const currentSlide = slides[currentIndex];

  function nextSlide() {
    setCurrentIndex((current) =>
      current + 1 >= slides.length ? 0 : current + 1
    );
  }

  function previousSlide() {
    setCurrentIndex((current) =>
      current - 1 < 0 ? slides.length - 1 : current - 1
    );
  }

  if (!currentSlide) {
    return (
      <Card className="p-10 text-center text-gray-500">
        Nenhum indicador encontrado para apresentação.
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-semibold text-gray-900">
            Apresentação de Indicadores
          </h1>
          <p className="text-gray-500 mt-1">
            {currentSlide.platform.name} — {currentSlide.platform.responsible_name}
          </p>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" onClick={previousSlide}>
            Anterior
          </Button>
          <Button onClick={nextSlide} className="bg-blue-600 hover:bg-blue-700">
            Próximo
          </Button>
        </div>
      </div>

      <Card className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h2 className="text-xl font-semibold mb-4 text-center">Ontem</h2>

            {currentSlide.yesterdayImages.length === 0 ? (
              <div className="h-96 border rounded-lg flex items-center justify-center text-gray-400">
                Sem imagem de ontem
              </div>
            ) : (
              <div className="space-y-4">
                {currentSlide.yesterdayImages.map((img) => (
                  <img
                    key={img.id}
                    src={img.image_url}
                    className="w-full rounded-lg border object-contain max-h-[70vh]"
                  />
                ))}
              </div>
            )}
          </div>

          <div>
            <h2 className="text-xl font-semibold mb-4 text-center">Hoje</h2>

            {currentSlide.todayImages.length === 0 ? (
              <div className="h-96 border rounded-lg flex items-center justify-center text-gray-400">
                Sem imagem de hoje
              </div>
            ) : (
              <div className="space-y-4">
                {currentSlide.todayImages.map((img) => (
                  <img
                    key={img.id}
                    src={img.image_url}
                    className="w-full rounded-lg border object-contain max-h-[70vh]"
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </Card>

      <p className="text-center text-sm text-gray-500">
        {currentIndex + 1} de {slides.length}
      </p>
    </div>
  );
}