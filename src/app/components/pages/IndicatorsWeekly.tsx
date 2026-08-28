import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { CalendarRange, Sparkles } from 'lucide-react';
import { Card } from '../ui/card';
import { supabase } from '../../lib/supabase';

type Platform = { id: string; name: string };
type Definition = { id: string; platform_id: string; name: string; unit: string; weekly_aggregation: 'last'|'avg'|'sum'|'min'|'max' };
type Measurement = { indicator_id: string; reference_date: string; value: number };

function startOfWeek(date: Date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0,0,0,0);
  return d;
}

function iso(d: Date) { return d.toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' }); }
function aggregate(rows: Measurement[], kind: Definition['weekly_aggregation']) {
  if (!rows.length) return null;
  const vals = rows.map((r) => Number(r.value));
  if (kind === 'sum') return vals.reduce((a,b)=>a+b,0);
  if (kind === 'avg') return vals.reduce((a,b)=>a+b,0)/vals.length;
  if (kind === 'min') return Math.min(...vals);
  if (kind === 'max') return Math.max(...vals);
  return Number([...rows].sort((a,b)=>b.reference_date.localeCompare(a.reference_date))[0].value);
}

export function IndicatorsWeekly() {
  const [params, setParams] = useSearchParams();
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [definitions, setDefinitions] = useState<Definition[]>([]);
  const [measurements, setMeasurements] = useState<Measurement[]>([]);

  useEffect(() => { void load(); }, []);
  async function load() {
    const [{data:p},{data:d},{data:m}] = await Promise.all([
      supabase.from('platforms').select('id,name').eq('active',true).order('display_order'),
      supabase.from('indicator_definitions').select('id,platform_id,name,unit,weekly_aggregation').eq('active',true).order('display_order'),
      supabase.from('indicator_measurements').select('indicator_id,reference_date,value').order('reference_date',{ascending:true}).limit(3000),
    ]);
    const ps=(p||[]) as Platform[]; setPlatforms(ps); setDefinitions((d||[]) as Definition[]); setMeasurements((m||[]) as Measurement[]);
    if (!params.get('platform') && ps[0]) setParams({platform:ps[0].id},{replace:true});
  }

  const platformId=params.get('platform')||'';
  const platform=platforms.find((p)=>p.id===platformId);
  const currentStart=startOfWeek(new Date());
  const currentEnd=new Date(currentStart); currentEnd.setDate(currentEnd.getDate()+6);
  const previousStart=new Date(currentStart); previousStart.setDate(previousStart.getDate()-7);
  const previousEnd=new Date(currentEnd); previousEnd.setDate(previousEnd.getDate()-7);
  const defs=definitions.filter((d)=>d.platform_id===platformId);

  const comparison=useMemo(()=>defs.map((d)=>{
    const rows=measurements.filter((m)=>m.indicator_id===d.id);
    const current=aggregate(rows.filter((m)=>m.reference_date>=iso(currentStart)&&m.reference_date<=iso(currentEnd)),d.weekly_aggregation);
    const previous=aggregate(rows.filter((m)=>m.reference_date>=iso(previousStart)&&m.reference_date<=iso(previousEnd)),d.weekly_aggregation);
    const delta=current!==null&&previous!==null?current-previous:null;
    return {...d,current,previous,delta};
  }),[defs,measurements,platformId]);

  return <div className="space-y-6">
    <section className="rounded-[28px] border border-white/10 bg-black/35 p-6 text-white backdrop-blur-xl lg:p-8"><div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between"><div><div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.24em] text-emerald-300/75"><CalendarRange className="h-4 w-4"/> Weekly Review</div><h1 className="mt-2 text-3xl font-black sm:text-4xl">Semana atual × semana anterior</h1><p className="mt-2 text-sm text-white/55">{iso(currentStart)} a {iso(currentEnd)} comparado com {iso(previousStart)} a {iso(previousEnd)}.</p></div><select value={platformId} onChange={(e)=>setParams({platform:e.target.value})} className="rounded-xl border border-white/15 bg-black/40 px-4 py-2 text-sm text-white">{platforms.map((p)=><option key={p.id} value={p.id}>{p.name}</option>)}</select></div></section>

    {!platform || !comparison.length ? <Card className="border-white/10 bg-black/30 p-8 text-white/50">Ainda não existem KPIs estruturados suficientes para gerar o comparativo semanal.</Card> : <>
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{comparison.slice(0,8).map((item)=><Card key={item.id} className="border-white/10 bg-black/30 p-5 text-white"><p className="text-xs uppercase tracking-[0.16em] text-white/40">{item.name}</p><div className="mt-3 flex items-end justify-between gap-3"><div><p className="text-xs text-white/35">Semana atual</p><p className="text-2xl font-black">{item.current===null?'—':item.current.toLocaleString('pt-BR',{maximumFractionDigits:2})}{item.unit==='%'?'%':''}</p></div>{item.delta!==null&&<span className={`text-xs font-bold ${item.delta>=0?'text-emerald-300':'text-rose-300'}`}>{item.delta>=0?'+':''}{item.delta.toLocaleString('pt-BR',{maximumFractionDigits:2})}</span>}</div><p className="mt-2 text-xs text-white/35">Anterior: {item.previous===null?'—':item.previous.toLocaleString('pt-BR',{maximumFractionDigits:2})}{item.unit==='%'?'%':''}</p></Card>)}</section>
      <Card className="border-white/10 bg-black/30 p-5 text-white"><div className="mb-5 flex items-center gap-2"><Sparkles className="h-4 w-4 text-emerald-300"/><h2 className="font-bold">Comparativo consolidado • {platform.name}</h2></div><div className="h-[360px]"><ResponsiveContainer width="100%" height="100%"><BarChart data={comparison.slice(0,10).map((i)=>({name:i.name,Anterior:i.previous,Atual:i.current}))}><CartesianGrid strokeDasharray="3 3" opacity={0.08}/><XAxis dataKey="name" tick={{fill:'#9ca3af',fontSize:10}} interval={0} angle={-15} textAnchor="end" height={70}/><YAxis tick={{fill:'#9ca3af',fontSize:11}}/><Tooltip contentStyle={{background:'#07100b',border:'1px solid rgba(255,255,255,.12)',borderRadius:12}}/><Legend/><Bar dataKey="Anterior" fill="rgba(255,255,255,.25)" radius={[6,6,0,0]}/><Bar dataKey="Atual" fill="#34d399" radius={[6,6,0,0]}/></BarChart></ResponsiveContainer></div></Card>
    </>}
  </div>;
}
