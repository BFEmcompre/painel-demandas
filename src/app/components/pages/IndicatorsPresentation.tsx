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
  section_id: string | null;
  image_url: string;
  reference_date: string;
};

type Section = {
  id: string;
  platform_id: string;
  name: string;
  display_order: number;
};

type Slide = {
  platform: Platform;
  section: Section;
  yesterdayImages: IndicatorImage[];
  todayImages: IndicatorImage[];
};

export function IndicatorsPresentation() {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [slides, setSlides] = useState<Slide[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    loadPresentation();
  }, []);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'ArrowRight') {
        e.preventDefault();

        setCurrentIndex((current) =>
          current + 1 >= slides.length ? 0 : current + 1
        );
      }

      if (e.key === 'ArrowLeft') {
        e.preventDefault();

        setCurrentIndex((current) =>
          current - 1 < 0 ? slides.length - 1 : current - 1
        );
      }

      if (e.key === 'Escape') {
        setIsFullscreen(false);
      }
    }

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [slides.length]);

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

    const { data: sections } = await supabase
      .from('platform_indicator_sections')
      .select('id, platform_id, name, display_order')
      .eq('active', true)
      .order('display_order');

    const result =
      platforms?.flatMap((platform) => {
        const platformSections =
          sections
            ?.filter((section) => section.platform_id === platform.id)
            .sort((a, b) => a.display_order - b.display_order) || [];

        return platformSections.map((section) => ({
          platform,
          section,
          yesterdayImages:
            images?.filter(
              (img) =>
                img.platform_id === platform.id &&
                img.section_id === section.id &&
                img.reference_date === yesterday
            ) || [],
          todayImages:
            images?.filter(
              (img) =>
                img.platform_id === platform.id &&
                img.section_id === section.id &&
                img.reference_date === today
            ) || [],
        }));
      }) || [];

    setSlides(result as Slide[]);
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
        Nenhum indicador encontrado para apresentação.
      </Card>
    );
  }

  if (isFullscreen && currentSlide) {
    return (
      <div className="fixed inset-0 bg-white dark:bg-[#0B0B0B] z-50 p-6 flex flex-col">
        
        <div className="flex justify-between items-center mb-4">
          <div>
            <h1 className="text-3xl font-semibold text-gray-900 dark:text-white">
              {currentSlide.platform.name} - {currentSlide.section.name}
            </h1>

            <p className="text-gray-500 dark:text-[#A1A1A1]">
              {currentSlide.platform.responsible_name}
            </p>
          </div>

          <div className="flex gap-2">

            <Button
              variant="outline"
              onClick={previousSlide}
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
              Anterior
            </Button>

            <Button
              variant="outline"
              onClick={nextSlide}
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
              Próximo
            </Button>

            <Button
              onClick={() => setIsFullscreen(false)}
              className="
                bg-gray-900
                text-white
                hover:bg-black
                dark:bg-white
                dark:text-black
                dark:hover:bg-[#E5E5E5]
              "
            >
              Sair
            </Button>

          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 flex-1 min-h-0">

          <div className="
            bg-white
            dark:bg-[#121212]
            border
            border-gray-200
            dark:border-[#1F1F1F]
            rounded-lg
            p-3
            flex
            flex-col
            min-h-0
          ">
            <h2 className="text-center font-semibold mb-2 text-gray-900 dark:text-white">
              Ontem
            </h2>

            <div className="flex-1 min-h-0 flex items-center justify-center">
              {currentSlide.yesterdayImages[0] ? (
                <img
                  src={currentSlide.yesterdayImages[0].image_url}
                  className="max-w-full max-h-full object-contain rounded-lg"
                />
              ) : (
                <p className="text-gray-400 dark:text-[#707070]">
                  Sem imagem de ontem
                </p>
              )}
            </div>
          </div>

          <div className="
            bg-white
            dark:bg-[#121212]
            border
            border-gray-200
            dark:border-[#1F1F1F]
            rounded-lg
            p-3
            flex
            flex-col
            min-h-0
          ">
            <h2 className="text-center font-semibold mb-2 text-gray-900 dark:text-white">
              Hoje
            </h2>

            <div className="flex-1 min-h-0 flex items-center justify-center">
              {currentSlide.todayImages[0] ? (
                <img
                  src={currentSlide.todayImages[0].image_url}
                  className="max-w-full max-h-full object-contain rounded-lg"
                />
              ) : (
                <p className="text-gray-400 dark:text-[#707070]">
                  Sem imagem de hoje
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 min-h-screen bg-white dark:bg-[#0B0B0B] p-1">

      <div className="flex justify-between items-center">

        <div>
          <h1 className="text-3xl font-semibold text-gray-900 dark:text-white">
            Apresentação de Indicadores
          </h1>

          <p className="text-gray-500 dark:text-[#A1A1A1] mt-1">
            {currentSlide.platform.name} — {currentSlide.section.name} —{' '}
            {currentSlide.platform.responsible_name}
          </p>
        </div>

        <div className="flex gap-2">

          <Button
            variant="outline"
            onClick={previousSlide}
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
            Anterior
          </Button>

          <Button
            onClick={nextSlide}
            className="
              bg-gray-900
              text-white
              hover:bg-black
              dark:bg-white
              dark:text-black
              dark:hover:bg-[#E5E5E5]
            "
          >
            Próximo
          </Button>

          <Button
            variant="outline"
            onClick={() => setIsFullscreen(true)}
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
            Tela cheia
          </Button>

        </div>
      </div>

      <Card className="
        p-6
        bg-white
        dark:bg-[#121212]
        border
        border-gray-200
        dark:border-[#1F1F1F]
      ">

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

          <div>
            <h2 className="text-xl font-semibold mb-4 text-center text-gray-900 dark:text-white">
              Ontem
            </h2>

            {currentSlide.yesterdayImages.length === 0 ? (
              <div className="
                h-96
                border
                border-gray-200
                dark:border-[#1F1F1F]
                rounded-lg
                flex
                items-center
                justify-center
                text-gray-400
                dark:text-[#707070]
                bg-gray-50
                dark:bg-[#181818]
              ">
                Sem imagem de ontem
              </div>
            ) : (
              <div className="space-y-4">
                {currentSlide.yesterdayImages.map((img) => (
                  <img
                    key={img.id}
                    src={img.image_url}
                    className="
                      w-full
                      rounded-lg
                      border
                      border-gray-200
                      dark:border-[#1F1F1F]
                      object-contain
                      max-h-[70vh]
                      bg-white
                      dark:bg-[#181818]
                    "
                  />
                ))}
              </div>
            )}
          </div>

          <div>
            <h2 className="text-xl font-semibold mb-4 text-center text-gray-900 dark:text-white">
              Hoje
            </h2>

            {currentSlide.todayImages.length === 0 ? (
              <div className="
                h-96
                border
                border-gray-200
                dark:border-[#1F1F1F]
                rounded-lg
                flex
                items-center
                justify-center
                text-gray-400
                dark:text-[#707070]
                bg-gray-50
                dark:bg-[#181818]
              ">
                Sem imagem de hoje
              </div>
            ) : (
              <div className="space-y-4">
                {currentSlide.todayImages.map((img) => (
                  <img
                    key={img.id}
                    src={img.image_url}
                    className="
                      w-full
                      rounded-lg
                      border
                      border-gray-200
                      dark:border-[#1F1F1F]
                      object-contain
                      max-h-[70vh]
                      bg-white
                      dark:bg-[#181818]
                    "
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </Card>

      <p className="text-center text-sm text-gray-500 dark:text-[#A1A1A1]">
        {currentIndex + 1} de {slides.length}
      </p>
    </div>
  );
}