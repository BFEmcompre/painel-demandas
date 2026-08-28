import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ImagePlus, Save, Sparkles, Target, TrendingUp } from 'lucide-react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { supabase } from '../../lib/supabase';

type Platform = { id: string; name: string; responsible_id: string; responsible_name: string };
type Definition = { id: string; platform_id: string; name: string; unit: string; direction: 'higher'|'lower'|'target'; target_value: number|null };
type Measurement = { indicator_id: string; reference_date: string; value: number };

export function IndicatorStudio() {
  const [params, setParams] = useSearchParams();
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [definitions, setDefinitions] = useState<Definition[]>([]);
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [values, setValues] = useState<Record<string,string>>({});
  const [notes, setNotes] = useState<Record<string,string>>({});
  const [saving, setSaving] = useState(false);
  const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });

  useEffect(() => { void load(); }, []);

  async function load() {
    const [{ data: p }, { data: d }, { data: m }] = await Promise.all([
      supabase.from('platforms').select('id,name,responsible_id,responsible_name').eq('active', true).order('display_order'),
      supabase.from('indicator_definitions').select('id,platform_id,name,unit,direction,target_value').eq('active', true).order('display_order'),
      supabase.from('indicator_measurements').select('indicator_id,reference_date,value').order('reference_date', { ascending: true }).limit(1000),
    ]);
    const ps = (p || []) as Platform[];
    setPlatforms(ps); setDefinitions((d || []) as Definition[]); setMeasurements((m || []) as Measurement[]);
    if (!params.get('platform') && ps[0]) setParams({ platform: ps[0].id }, { replace: true });
  }

  const platformId = params.get('platform') || '';
  const platform = platforms.find((p) => p.id === platformId);
  const defs = definitions.filter((d) => d.platform_id === platformId);

  const existingToday = useMemo(() => new Map(measurements.filter((m) => m.reference_date === today).map((m) => [m.indicator_id, m])), [measurements, today]);

  async function saveAll() {
    if (!platform) return;
    setSaving(true);
    const { data: authData } = await supabase.auth.getUser();
    const uid = authData.user?.id || null;
    const rows = defs.flatMap((d) => {
      const raw = values[d.id];
      if (raw === undefined || raw.trim() === '') return [];
      const value = Number(raw.replace(',', '.'));
      if (Number.isNaN(value)) return [];
      return [{ indicator_id: d.id, reference_date: today, value, source_type: 'manual', created_by: uid }];
    });
    if (rows.length) await supabase.from('indicator_measurements').upsert(rows, { onConflict: 'indicator_id,reference_date' });
    const insightRows = defs.flatMap((d) => notes[d.id]?.trim() ? [{ platform_id: platform.id, indicator_id: d.id, reference_date: today, kind: 'observation', text: notes[d.id].trim(), created_by: uid }] : []);
    if (insightRows.length) await supabase.from('indicator_insights').insert(insightRows);
    await supabase.from('indicator_reports').upsert({ platform_id: platform.id, responsible_id: platform.responsible_id, report_type: 'daily', reference_date: today, title: `${platform.name} • ${today}`, status: 'ready' }, { onConflict: 'platform_id,report_type,reference_date' });
    setSaving(false); await load();
  }

  return <div className="space-y-6">
    <section className="rounded-[28px] border border-white/10 bg-black/35 p-6 text-white backdrop-blur-xl lg:p-8">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between"><div><p className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-300/75">Presentation Studio • Diário</p><h1 className="mt-2 text-3xl font-black sm:text-4xl">Prepare a história por trás dos números.</h1><p className="mt-2 max-w-3xl text-sm text-white/55">Atualize os KPIs, registre o contexto e deixe o FLOW montar a comparação com a última medição válida.</p></div><div className="flex gap-2"><select value={platformId} onChange={(e) => setParams({ platform: e.target.value })} className="rounded-xl border border-white/15 bg-black/40 px-4 py-2 text-sm text-white">{platforms.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select><Button onClick={saveAll} disabled={saving} className="bg-emerald-400 text-black hover:bg-emerald-300"><Save className="mr-2 h-4 w-4" />{saving ? 'Salvando...' : 'Finalizar hoje'}</Button></div></div>
    </section>

    {!platform ? <Card className="border-white/10 bg-black/30 p-8 text-white/50">Selecione uma plataforma.</Card> : defs.length === 0 ? <Card className="border-white/10 bg-black/30 p-8 text-white"><h2 className="font-bold">Ainda não existem KPIs estruturados para {platform.name}.</h2><p className="mt-2 text-sm text-white/50">O banco novo já suporta KPIs, medições e narrativa. Cadastre as definições no próximo passo administrativo; o fluxo legado de prints não foi removido.</p></Card> : defs.map((d) => {
      const history = measurements.filter((m) => m.indicator_id === d.id).sort((a,b) => a.reference_date.localeCompare(b.reference_date));
      const previous = [...history].reverse().find((m) => m.reference_date < today);
      const current = existingToday.get(d.id);
      const chartData = history.slice(-12).map((m) => ({ date: m.reference_date.slice(5), value: Number(m.value) }));
      return <Card key={d.id} className="overflow-hidden border-white/10 bg-black/30 text-white backdrop-blur-xl"><div className="grid xl:grid-cols-[0.9fr_1.2fr_1fr]"><div className="border-b border-white/10 p-5 xl:border-b-0 xl:border-r"><div className="flex items-center justify-between"><div><p className="text-xs uppercase tracking-[0.18em] text-white/40">KPI</p><h2 className="mt-1 text-xl font-black">{d.name}</h2></div><Target className="h-5 w-5 text-emerald-300" /></div><div className="mt-5 grid grid-cols-2 gap-3"><div className="rounded-2xl border border-white/10 bg-white/[0.035] p-3"><p className="text-xs text-white/40">Último válido</p><p className="mt-1 text-xl font-bold">{previous ? `${previous.value}${d.unit === '%' ? '%' : ''}` : '—'}</p></div><div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.06] p-3"><p className="text-xs text-emerald-200/60">Hoje</p><Input value={values[d.id] ?? (current ? String(current.value) : '')} onChange={(e) => setValues((v) => ({...v,[d.id]:e.target.value}))} className="mt-1 border-white/10 bg-black/30 text-lg font-black" placeholder="Valor" /></div></div>{d.target_value !== null && <p className="mt-3 text-xs text-white/40">Meta configurada: <span className="font-bold text-white/70">{d.target_value}{d.unit === '%' ? '%' : ''}</span></p>}</div><div className="h-[240px] border-b border-white/10 p-4 xl:border-b-0 xl:border-r"><ResponsiveContainer width="100%" height="100%"><AreaChart data={chartData}><defs><linearGradient id={`g-${d.id}`} x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="currentColor" stopOpacity={0.35}/><stop offset="95%" stopColor="currentColor" stopOpacity={0}/></linearGradient></defs><CartesianGrid strokeDasharray="3 3" opacity={0.08}/><XAxis dataKey="date" tick={{fill:'#9ca3af',fontSize:11}} axisLine={false}/><YAxis tick={{fill:'#9ca3af',fontSize:11}} axisLine={false}/><Tooltip contentStyle={{background:'#07100b',border:'1px solid rgba(255,255,255,.12)',borderRadius:12}}/><Area type="monotone" dataKey="value" stroke="currentColor" fill={`url(#g-${d.id})`} className="text-emerald-300" /></AreaChart></ResponsiveContainer></div><div className="p-5"><div className="mb-2 flex items-center gap-2 text-sm font-bold"><Sparkles className="h-4 w-4 text-emerald-300" /> O que está acontecendo?</div><Textarea value={notes[d.id] || ''} onChange={(e) => setNotes((n) => ({...n,[d.id]:e.target.value}))} placeholder="Por que subiu ou desceu? O que está afetando? O que merece atenção na apresentação?" className="min-h-[120px] border-white/10 bg-black/25 text-white"/><div className="mt-3 flex flex-wrap gap-2 text-xs text-white/40"><span className="rounded-full border border-white/10 px-2 py-1"><TrendingUp className="mr-1 inline h-3 w-3" />Comparação automática</span><span className="rounded-full border border-white/10 px-2 py-1"><ImagePlus className="mr-1 inline h-3 w-3" />Evidência em fase 2</span></div></div></div></Card>;
    })}
  </div>;
}
