import { useEffect, useMemo, useState } from 'react';
import { Download, FileDown, Printer, TrendingDown, TrendingUp } from 'lucide-react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { supabase } from '../../lib/supabase';

type Platform={id:string;name:string;display_order:number};
type Metric={id:string;platform_id:string;name:string;unit:string;direction:string;target_value:number|null;weekly_aggregation:string;display_order:number};
type Measurement={indicator_id:string;reference_date:string;value:number};
type Submission={platform_id:string;reference_date:string;is_late:boolean;status:string};

function iso(date:Date){return date.toLocaleDateString('sv-SE',{timeZone:'America/Sao_Paulo'});}
function shift(date:string,days:number){const d=new Date(`${date}T12:00:00`);d.setDate(d.getDate()+days);return iso(d);}
function format(value:number|null,unit:string){if(value===null)return '—';if(unit==='%')return `${value.toLocaleString('pt-BR',{maximumFractionDigits:2})}%`;if(unit==='R$')return value.toLocaleString('pt-BR',{style:'currency',currency:'BRL'});return `${value.toLocaleString('pt-BR',{maximumFractionDigits:2})}${unit==='p.p.'?' p.p.':''}`;}
function aggregate(values:number[],mode:string){if(!values.length)return null;if(mode==='sum')return values.reduce((a,b)=>a+b,0);if(mode==='avg')return values.reduce((a,b)=>a+b,0)/values.length;if(mode==='min')return Math.min(...values);if(mode==='max')return Math.max(...values);return values[values.length-1];}

export function IndicatorAnalytics(){
  const now=new Date();const initialEnd=iso(now);const startDate=new Date(now);startDate.setDate(startDate.getDate()-6);
  const [platforms,setPlatforms]=useState<Platform[]>([]);const [metrics,setMetrics]=useState<Metric[]>([]);const [measurements,setMeasurements]=useState<Measurement[]>([]);const [submissions,setSubmissions]=useState<Submission[]>([]);
  const [platformId,setPlatformId]=useState('all');const [start,setStart]=useState(iso(startDate));const [end,setEnd]=useState(initialEnd);

  useEffect(()=>{void load()},[]);
  async function load(){const [{data:p},{data:m},{data:v},{data:s}]=await Promise.all([
    supabase.from('platforms').select('id,name,display_order').eq('active',true).order('display_order'),
    supabase.from('indicator_definitions').select('id,platform_id,name,unit,direction,target_value,weekly_aggregation,display_order').eq('active',true).order('display_order'),
    supabase.from('indicator_measurements').select('indicator_id,reference_date,value').order('reference_date'),
    supabase.from('indicator_submissions').select('platform_id,reference_date,is_late,status').order('reference_date'),
  ]);setPlatforms((p||[]) as Platform[]);setMetrics((m||[]) as Metric[]);setMeasurements((v||[]) as Measurement[]);setSubmissions((s||[]) as Submission[]);}

  const filteredMetrics=useMemo(()=>metrics.filter(m=>platformId==='all'||m.platform_id===platformId),[metrics,platformId]);
  const days=Math.max(1,Math.round((new Date(`${end}T12:00:00`).getTime()-new Date(`${start}T12:00:00`).getTime())/86400000)+1);const previousEnd=shift(start,-1);const previousStart=shift(previousEnd,-days+1);

  const rows=useMemo(()=>filteredMetrics.map(metric=>{
    const period=measurements.filter(v=>v.indicator_id===metric.id&&v.reference_date>=start&&v.reference_date<=end).sort((a,b)=>a.reference_date.localeCompare(b.reference_date));
    const previous=measurements.filter(v=>v.indicator_id===metric.id&&v.reference_date>=previousStart&&v.reference_date<=previousEnd).sort((a,b)=>a.reference_date.localeCompare(b.reference_date));
    const currentValue=aggregate(period.map(v=>Number(v.value)),metric.weekly_aggregation);const previousValue=aggregate(previous.map(v=>Number(v.value)),metric.weekly_aggregation);const delta=currentValue!==null&&previousValue!==null?currentValue-previousValue:null;
    return {...metric,currentValue,previousValue,delta,series:period.map(v=>({date:v.reference_date.slice(5),value:Number(v.value)}))};
  }),[filteredMetrics,measurements,start,end,previousStart,previousEnd]);

  const selectedPlatformIds=platformId==='all'?new Set(platforms.map(p=>p.id)):new Set([platformId]);
  const periodSubmissions=submissions.filter(s=>selectedPlatformIds.has(s.platform_id)&&s.reference_date>=start&&s.reference_date<=end);const late=periodSubmissions.filter(s=>s.is_late).length;const onTime=periodSubmissions.filter(s=>!s.is_late).length;

  function setPreset(kind:'week'|'month'|'quarter') {const e=new Date();const s=new Date(e);if(kind==='week')s.setDate(e.getDate()-6);if(kind==='month')s.setDate(e.getDate()-29);if(kind==='quarter')s.setDate(e.getDate()-89);setStart(iso(s));setEnd(iso(e));}
  function exportCsv(){const header=['Plataforma','Métrica','Período atual','Período anterior','Variação','Unidade'];const lines=rows.map(r=>[platforms.find(p=>p.id===r.platform_id)?.name||'',r.name,r.currentValue??'',r.previousValue??'',r.delta??'',r.unit]);const csv=[header,...lines].map(line=>line.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(';')).join('\n');const blob=new Blob([`\ufeff${csv}`],{type:'text/csv;charset=utf-8'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`flow-indicadores-${start}-${end}.csv`;a.click();URL.revokeObjectURL(url);}

  return <div className="space-y-6 text-white">
    <section className="rounded-[28px] border border-white/10 bg-black/35 p-6 backdrop-blur-xl lg:p-8"><div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between"><div><p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-300/75">Análises e relatórios</p><h1 className="mt-2 text-3xl font-black">Compare qualquer período.</h1><p className="mt-2 max-w-3xl text-sm text-white/55">O período escolhido é comparado automaticamente com o período imediatamente anterior de mesma duração.</p></div><div className="flex gap-2"><Button variant="outline" onClick={exportCsv} className="border-white/10 bg-white/5 text-white"><Download className="mr-2 h-4 w-4"/>CSV</Button><Button onClick={()=>window.print()} className="bg-emerald-400 text-black hover:bg-emerald-300"><Printer className="mr-2 h-4 w-4"/>Exportar PDF</Button></div></div></section>

    <Card className="border-white/10 bg-black/30 p-5 text-white backdrop-blur-xl"><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-[1.3fr_1fr_1fr_auto]"><div><p className="text-xs text-white/40">Plataforma</p><select value={platformId} onChange={e=>setPlatformId(e.target.value)} className="mt-2 h-10 w-full rounded-lg border border-white/10 bg-[#07131f] px-3 text-sm"><option value="all">Todas as plataformas</option>{platforms.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></div><div><p className="text-xs text-white/40">De</p><Input type="date" value={start} onChange={e=>setStart(e.target.value)} className="mt-2 border-white/10 bg-black/30"/></div><div><p className="text-xs text-white/40">Até</p><Input type="date" value={end} onChange={e=>setEnd(e.target.value)} className="mt-2 border-white/10 bg-black/30"/></div><div className="flex items-end gap-2"><Button size="sm" variant="outline" onClick={()=>setPreset('week')} className="border-white/10 bg-white/5 text-white">7 dias</Button><Button size="sm" variant="outline" onClick={()=>setPreset('month')} className="border-white/10 bg-white/5 text-white">30 dias</Button><Button size="sm" variant="outline" onClick={()=>setPreset('quarter')} className="border-white/10 bg-white/5 text-white">90 dias</Button></div></div><p className="mt-3 text-xs text-white/35">Comparando {start} → {end} com {previousStart} → {previousEnd}.</p></Card>

    <section className="grid gap-3 sm:grid-cols-3"><Card className="border-white/10 bg-black/30 p-5 text-white"><p className="text-xs uppercase tracking-[0.15em] text-white/40">Métricas analisadas</p><p className="mt-2 text-3xl font-black">{rows.length}</p></Card><Card className="border-white/10 bg-black/30 p-5 text-white"><p className="text-xs uppercase tracking-[0.15em] text-white/40">Envios no prazo</p><p className="mt-2 text-3xl font-black text-emerald-300">{onTime}</p></Card><Card className="border-white/10 bg-black/30 p-5 text-white"><p className="text-xs uppercase tracking-[0.15em] text-white/40">Envios atrasados</p><p className="mt-2 text-3xl font-black text-rose-300">{late}</p></Card></section>

    <section className="grid gap-4 xl:grid-cols-2">{rows.map(row=>{const good=row.delta===null?null:row.direction==='lower'?row.delta<0:row.direction==='higher'?row.delta>0:Math.abs((row.currentValue??0)-(row.target_value??0))<Math.abs((row.previousValue??0)-(row.target_value??0));return <Card key={row.id} className="overflow-hidden border-white/10 bg-black/30 text-white backdrop-blur-xl"><div className="grid lg:grid-cols-[.9fr_1.1fr]"><div className="border-b border-white/10 p-5 lg:border-b-0 lg:border-r"><p className="text-[10px] uppercase tracking-[.16em] text-white/35">{platforms.find(p=>p.id===row.platform_id)?.name}</p><h2 className="mt-1 text-lg font-black">{row.name}</h2><div className="mt-5 grid grid-cols-2 gap-3"><div className="rounded-xl border border-white/10 bg-white/[.03] p-3"><p className="text-[10px] text-white/35">Período atual</p><p className="mt-1 text-2xl font-black">{format(row.currentValue,row.unit)}</p></div><div className="rounded-xl border border-white/10 bg-white/[.03] p-3"><p className="text-[10px] text-white/35">Anterior</p><p className="mt-1 text-2xl font-black text-white/65">{format(row.previousValue,row.unit)}</p></div></div><div className={`mt-3 flex items-center gap-2 text-sm font-bold ${good===null?'text-white/35':good?'text-emerald-300':'text-rose-300'}`}>{row.delta===null?'Sem base comparativa':<>{row.delta>=0?<TrendingUp className="h-4 w-4"/>:<TrendingDown className="h-4 w-4"/>}{row.delta>=0?'+':''}{format(row.delta,row.unit)} de variação</>}</div>{row.target_value!==null&&<p className="mt-2 text-xs text-white/35">Meta: {format(row.target_value,row.unit)}</p>}</div><div className="h-[260px] p-4"><ResponsiveContainer width="100%" height="100%"><AreaChart data={row.series}><defs><linearGradient id={`analytics-${row.id}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#5eead4" stopOpacity={.4}/><stop offset="100%" stopColor="#059669" stopOpacity={.02}/></linearGradient></defs><CartesianGrid strokeDasharray="3 3" opacity={.08}/><XAxis dataKey="date" tick={{fill:'#8ba0b5',fontSize:10}} axisLine={false}/><YAxis tick={{fill:'#8ba0b5',fontSize:10}} axisLine={false}/><Tooltip contentStyle={{background:'#06111b',border:'1px solid rgba(255,255,255,.12)',borderRadius:12}}/><Area type="monotone" dataKey="value" stroke="#5eead4" strokeWidth={3} fill={`url(#analytics-${row.id})`}/></AreaChart></ResponsiveContainer></div></div></Card>})}</section>

    {rows.length===0&&<Card className="border-white/10 bg-black/30 p-10 text-center text-white/40"><FileDown className="mx-auto mb-3 h-6 w-6"/>Ainda não há medições nesse período.</Card>}
  </div>;
}
