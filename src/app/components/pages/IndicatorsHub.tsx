import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { Activity, ArrowRight, BarChart3, CalendarDays, Presentation, Sparkles } from 'lucide-react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { supabase } from '../../lib/supabase';

type Platform = {
  id: string;
  name: string;
  responsible_name: string;
  responsible_id: string;
};

type Definition = {
  id: string;
  platform_id: string;
  name: string;
  unit: string;
  target_value: number | null;
};

type Measurement = {
  indicator_id: string;
  reference_date: string;
  value: number;
};

function formatValue(value: number, unit: string) {
  if (unit === '%') return `${Number(value).toLocaleString('pt-BR')}%`;
  if (unit === 'R$') return Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  return Number(value).toLocaleString('pt-BR');
}

export function IndicatorsHub() {
  const navigate = useNavigate();
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [definitions, setDefinitions] = useState<Definition[]>([]);
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setLoading(true);
    const [{ data: p }, { data: d }, { data: m }] = await Promise.all([
      supabase.from('platforms').select('id,name,responsible_name,responsible_id').eq('active', true).order('display_order'),
      supabase.from('indicator_definitions').select('id,platform_id,name,unit,target_value').eq('active', true).order('display_order'),
      supabase.from('indicator_measurements').select('indicator_id,reference_date,value').order('reference_date', { ascending: false }).limit(500),
    ]);
    setPlatforms((p || []) as Platform[]);
    setDefinitions((d || []) as Definition[]);
    setMeasurements((m || []) as Measurement[]);
    setLoading(false);
  }

  const stats = useMemo(() => {
    const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });
    const todayCount = new Set(measurements.filter((m) => m.reference_date === today).map((m) => m.indicator_id)).size;
    return {
      platforms: platforms.length,
      indicators: definitions.length,
      today: todayCount,
      pending: Math.max(0, definitions.length - todayCount),
    };
  }, [platforms, definitions, measurements]);

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-[28px] border border-white/10 bg-black/35 p-6 shadow-2xl backdrop-blur-xl lg:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.24em] text-emerald-300/80">
              <Sparkles className="h-4 w-4" /> FLOW Intelligence
            </div>
            <h1 className="max-w-4xl text-3xl font-black tracking-tight text-white sm:text-4xl lg:text-5xl">Central de Indicadores</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-white/60 sm:text-base">Dados, contexto e narrativa operacional em um único lugar. Acompanhe o que mudou, por que mudou e o que precisa acontecer a seguir.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => navigate('/indicadores/studio')} className="bg-emerald-400 text-black hover:bg-emerald-300">
              <Presentation className="mr-2 h-4 w-4" /> Preparar apresentação
            </Button>
            <Button variant="outline" onClick={() => navigate('/indicadores/semanal')} className="border-white/15 bg-white/5 text-white hover:bg-white/10">
              <CalendarDays className="mr-2 h-4 w-4" /> Weekly Review
            </Button>
          </div>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ['Plataformas', stats.platforms, BarChart3],
          ['KPIs ativos', stats.indicators, Activity],
          ['Atualizados hoje', stats.today, Sparkles],
          ['Pendentes', stats.pending, CalendarDays],
        ].map(([label, value, Icon]: any) => (
          <Card key={label} className="border-white/10 bg-black/30 p-5 text-white backdrop-blur-xl">
            <div className="flex items-center justify-between">
              <div><p className="text-xs uppercase tracking-[0.18em] text-white/45">{label}</p><p className="mt-2 text-3xl font-black">{loading ? '—' : value}</p></div>
              <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-3"><Icon className="h-5 w-5 text-emerald-300" /></div>
            </div>
          </Card>
        ))}
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        {platforms.map((platform) => {
          const defs = definitions.filter((d) => d.platform_id === platform.id);
          return (
            <Card key={platform.id} className="overflow-hidden border-white/10 bg-black/30 text-white backdrop-blur-xl">
              <div className="border-b border-white/10 p-5">
                <div className="flex items-start justify-between gap-4">
                  <div><p className="text-xs uppercase tracking-[0.18em] text-emerald-300/70">Plataforma</p><h2 className="mt-1 text-xl font-bold">{platform.name}</h2><p className="mt-1 text-sm text-white/45">{platform.responsible_name}</p></div>
                  <Button variant="outline" onClick={() => navigate(`/indicadores/studio?platform=${platform.id}`)} className="border-white/15 bg-white/5 text-white hover:bg-white/10">Abrir <ArrowRight className="ml-2 h-4 w-4" /></Button>
                </div>
              </div>
              <div className="grid gap-3 p-5 sm:grid-cols-2">
                {defs.length === 0 ? <p className="col-span-full text-sm text-white/40">Nenhum KPI estruturado ainda. O fluxo legado de prints continua disponível.</p> : defs.slice(0, 6).map((definition) => {
                  const history = measurements.filter((m) => m.indicator_id === definition.id).sort((a, b) => b.reference_date.localeCompare(a.reference_date));
                  const latest = history[0];
                  const previous = history[1];
                  const delta = latest && previous ? Number(latest.value) - Number(previous.value) : null;
                  return <div key={definition.id} className="rounded-2xl border border-white/10 bg-white/[0.035] p-4"><p className="text-xs text-white/45">{definition.name}</p><div className="mt-2 flex items-end justify-between gap-2"><p className="text-2xl font-black">{latest ? formatValue(latest.value, definition.unit) : '—'}</p>{delta !== null && <span className={`text-xs font-bold ${delta >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>{delta >= 0 ? '+' : ''}{delta.toLocaleString('pt-BR')}</span>}</div></div>;
                })}
              </div>
            </Card>
          );
        })}
      </section>
    </div>
  );
}
