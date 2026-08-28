import { PointerEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import {
  BarChart3, ChevronLeft, ChevronRight, Copy, FileImage, Grip, ImagePlus, LayoutDashboard,
  Maximize2, MonitorPlay, Plus, RefreshCcw, Save, Settings2, Sparkles, Trash2, Type,
} from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { supabase } from '../../lib/supabase';
import { buildSmartPresentationBlocks } from '../../lib/indicatorPresentationLayout';

type Platform={id:string;name:string;responsible_name:string;display_order:number};
type Metric={id:string;platform_id:string;name:string;unit:string;target_value:number|null;display_order:number};
type Measurement={indicator_id:string;reference_date:string;value:number};
type Report={id:string;platform_id:string;reference_date:string;title:string;status:string};
type ImageRow={id:string;image_url:string;original_name:string|null};
type Block={id:string;report_id:string;block_type:string;title:string|null;content:any;x:number;y:number;width:number;height:number;z_index:number;style:any};
type Gesture={id:string;mode:'drag'|'resize';startX:number;startY:number;x:number;y:number;width:number;height:number}|null;

const today=()=>new Date().toLocaleDateString('sv-SE',{timeZone:'America/Sao_Paulo'});
const clamp=(v:number,min:number,max:number)=>Math.max(min,Math.min(max,v));
const accents=['emerald','cyan','violet','amber','rose','blue'];

function formatValue(value:number|undefined,unit:string){
  if(value===undefined)return '—';
  if(unit==='%')return `${Number(value).toLocaleString('pt-BR')}%`;
  if(unit==='R$')return Number(value).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
  if(unit==='nota')return Number(value).toLocaleString('pt-BR',{maximumFractionDigits:2});
  return Number(value).toLocaleString('pt-BR');
}

function accentClasses(accent:string){
  const map:Record<string,string>={
    emerald:'from-emerald-400/20 via-emerald-400/[.07] to-transparent border-emerald-300/20',
    cyan:'from-cyan-400/20 via-cyan-400/[.07] to-transparent border-cyan-300/20',
    violet:'from-violet-400/20 via-violet-400/[.07] to-transparent border-violet-300/20',
    amber:'from-amber-400/20 via-amber-400/[.07] to-transparent border-amber-300/20',
    rose:'from-rose-400/20 via-rose-400/[.07] to-transparent border-rose-300/20',
    blue:'from-blue-400/20 via-blue-400/[.07] to-transparent border-blue-300/20',
  };
  return map[accent]||map.emerald;
}

export function IndicatorStudio3D(){
  const navigate=useNavigate();
  const [params,setParams]=useSearchParams();
  const [platforms,setPlatforms]=useState<Platform[]>([]);
  const [metrics,setMetrics]=useState<Metric[]>([]);
  const [measurements,setMeasurements]=useState<Measurement[]>([]);
  const [reports,setReports]=useState<Report[]>([]);
  const [blocks,setBlocks]=useState<Block[]>([]);
  const [images,setImages]=useState<ImageRow[]>([]);
  const [selectedId,setSelectedId]=useState('');
  const [page,setPage]=useState(1);
  const [saving,setSaving]=useState(false);
  const [gesture,setGesture]=useState<Gesture>(null);
  const canvasRef=useRef<HTMLDivElement|null>(null);
  const date=params.get('date')||today();
  const platformId=params.get('platform')||'';
  const platform=platforms.find(p=>p.id===platformId);
  const report=reports.find(r=>r.platform_id===platformId);
  const platformMetrics=useMemo(()=>metrics.filter(m=>m.platform_id===platformId).sort((a,b)=>a.display_order-b.display_order),[metrics,platformId]);
  const selected=blocks.find(b=>b.id===selectedId)||null;
  const pages=Math.max(1,...blocks.map(b=>Number(b.style?.page||1)));
  const visible=blocks.filter(b=>Number(b.style?.page||1)===page).sort((a,b)=>a.z_index-b.z_index);

  useEffect(()=>{void loadAll()},[date]);
  useEffect(()=>{if(platformId)void loadPlatformAssets(platformId)},[platformId,date]);
  useEffect(()=>{if(page>pages)setPage(pages)},[pages,page]);

  async function loadAll(){
    const [{data:p},{data:m},{data:v},{data:r}]=await Promise.all([
      supabase.from('platforms').select('id,name,responsible_name,display_order').eq('active',true).order('display_order'),
      supabase.from('indicator_definitions').select('id,platform_id,name,unit,target_value,display_order').eq('active',true).order('display_order'),
      supabase.from('indicator_measurements').select('indicator_id,reference_date,value').lte('reference_date',date).order('reference_date'),
      supabase.from('indicator_reports').select('id,platform_id,reference_date,title,status').eq('report_type','daily').eq('reference_date',date),
    ]);
    const ps=(p||[]) as Platform[];setPlatforms(ps);setMetrics((m||[]) as Metric[]);setMeasurements((v||[]) as Measurement[]);setReports((r||[]) as Report[]);
    const next=params.get('platform')||((r||[])[0]?.platform_id)||ps[0]?.id||'';
    if(next&&!params.get('platform'))setParams({platform:next,date},{replace:true});
  }

  async function loadPlatformAssets(pid:string){
    const r=reports.find(x=>x.platform_id===pid);
    if(!r){setBlocks([]);setImages([]);return;}
    const [{data:b},{data:s}]=await Promise.all([
      supabase.from('indicator_report_blocks').select('*').eq('report_id',r.id).order('z_index'),
      supabase.from('indicator_submissions').select('id').eq('platform_id',pid).eq('reference_date',date).maybeSingle(),
    ]);
    setBlocks((b||[]) as Block[]);setSelectedId('');setPage(1);
    if(s){const {data:i}=await supabase.from('indicator_submission_images').select('id,image_url,original_name').eq('submission_id',s.id).order('display_order');setImages((i||[]) as ImageRow[])}else setImages([]);
  }

  const current=(id:string)=>measurements.find(m=>m.indicator_id===id&&m.reference_date===date);
  const previous=(id:string)=>[...measurements.filter(m=>m.indicator_id===id&&m.reference_date<date)].sort((a,b)=>b.reference_date.localeCompare(a.reference_date))[0];
  const series=(id:string,days=30)=>measurements.filter(m=>m.indicator_id===id&&m.reference_date<=date).sort((a,b)=>a.reference_date.localeCompare(b.reference_date)).slice(-days).map(m=>({date:m.reference_date.slice(5),value:Number(m.value)}));
  const weekCurrent=(id:string)=>measurements.filter(m=>m.indicator_id===id&&m.reference_date<=date).sort((a,b)=>b.reference_date.localeCompare(a.reference_date)).slice(0,7);
  const weekPrevious=(id:string)=>measurements.filter(m=>m.indicator_id===id&&m.reference_date<=date).sort((a,b)=>b.reference_date.localeCompare(a.reference_date)).slice(7,14);
  const avg=(rows:Measurement[])=>rows.length?rows.reduce((sum,m)=>sum+Number(m.value),0)/rows.length:undefined;

  async function regenerate(){
    if(!report||!confirm('Regenerar o layout automático? Os blocos atuais serão substituídos, mas os dados extraídos permanecem salvos.'))return;
    setSaving(true);
    await supabase.from('indicator_report_blocks').delete().eq('report_id',report.id);
    const smart=buildSmartPresentationBlocks(report.id,platformMetrics,images);
    const {error}=await supabase.from('indicator_report_blocks').insert(smart);
    setSaving(false);if(error){alert(error.message);return;}await loadPlatformAssets(platformId);
  }

  async function addBlock(type:'kpi'|'chart'|'image'|'text'|'insight'){
    if(!report)return;
    const metric=platformMetrics[0];
    if((type==='kpi'||type==='chart')&&!metric){alert('Nenhum indicador disponível.');return;}
    const image=images[0];if(type==='image'&&!image){alert('Nenhum print disponível.');return;}
    const content=type==='kpi'?{indicator_id:metric.id,comparison_mode:'previous'}:type==='chart'?{indicator_id:metric.id,chart_type:'area',period_days:30}:type==='image'?{image_id:image.id,image_url:image.image_url}:{text:type==='insight'?'Descreva o que afetou os indicadores, causas, impactos e próximos passos.':'Novo bloco de texto'};
    const row={report_id:report.id,block_type:type,title:type==='kpi'||type==='chart'?metric.name:type==='image'?'Evidência':type==='insight'?'Análise e próximos passos':'Texto',content,x:6,y:8,width:type==='kpi'?28:42,height:type==='kpi'?22:type==='text'||type==='insight'?25:35,z_index:blocks.length+1,style:{page,accent:accents[blocks.length%accents.length],depth:2,radius:22}};
    const {error}=await supabase.from('indicator_report_blocks').insert(row);if(error)alert(error.message);else await loadPlatformAssets(platformId);
  }

  async function duplicateBlock(){
    if(!selected||!report)return;
    const {id,...copy}=selected;const {error}=await supabase.from('indicator_report_blocks').insert({...copy,x:clamp(Number(copy.x)+3,0,94),y:clamp(Number(copy.y)+3,0,94),z_index:blocks.length+1});if(error)alert(error.message);else await loadPlatformAssets(platformId);
  }
  async function deleteBlock(){if(!selected)return;await supabase.from('indicator_report_blocks').delete().eq('id',selected.id);setSelectedId('');await loadPlatformAssets(platformId)}

  function startGesture(e:PointerEvent,id:string,mode:'drag'|'resize'){
    e.stopPropagation();const b=blocks.find(x=>x.id===id);if(!b)return;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);setSelectedId(id);setGesture({id,mode,startX:e.clientX,startY:e.clientY,x:Number(b.x),y:Number(b.y),width:Number(b.width),height:Number(b.height)});
  }
  function moveGesture(e:PointerEvent){
    if(!gesture||!canvasRef.current)return;const rect=canvasRef.current.getBoundingClientRect();const dx=(e.clientX-gesture.startX)/rect.width*100;const dy=(e.clientY-gesture.startY)/rect.height*100;
    setBlocks(prev=>prev.map(b=>b.id!==gesture.id?b:gesture.mode==='drag'?{...b,x:clamp(gesture.x+dx,0,96-Math.min(96,b.width)),y:clamp(gesture.y+dy,0,96-Math.min(96,b.height))}:{...b,width:clamp(gesture.width+dx,12,96-b.x),height:clamp(gesture.height+dy,10,96-b.y)}));
  }
  async function endGesture(){if(!gesture)return;const b=blocks.find(x=>x.id===gesture.id);setGesture(null);if(b)await supabase.from('indicator_report_blocks').update({x:b.x,y:b.y,width:b.width,height:b.height}).eq('id',b.id)}

  async function patchSelected(patch:Partial<Block>){
    if(!selected)return;setBlocks(prev=>prev.map(b=>b.id===selected.id?{...b,...patch}:b));setSaving(true);const {error}=await supabase.from('indicator_report_blocks').update(patch).eq('id',selected.id);setSaving(false);if(error)alert(error.message);
  }
  async function patchContent(key:string,value:any){if(!selected)return;await patchSelected({content:{...(selected.content||{}),[key]:value}})}
  async function patchStyle(key:string,value:any){if(!selected)return;await patchSelected({style:{...(selected.style||{}),[key]:value}})}

  function renderBlock(block:Block){
    if(block.block_type==='image')return <div className="h-full overflow-hidden rounded-[18px] bg-black/40"><img src={block.content?.image_url} className="h-full w-full object-contain"/></div>;
    if(block.block_type==='text'||block.block_type==='insight')return <div className="flex h-full flex-col justify-center p-5"><p className="text-[10px] font-black uppercase tracking-[.2em] text-white/35">{block.block_type==='insight'?'Análise':'Apresentação'}</p><h3 className="mt-2 text-xl font-black">{block.title}</h3><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-white/60">{block.content?.text}</p></div>;
    const metric=platformMetrics.find(m=>m.id===block.content?.indicator_id);if(!metric)return <div className="p-4 text-white/40">Indicador não encontrado</div>;
    const c=current(metric.id);const p=previous(metric.id);const delta=c&&p?Number(c.value)-Number(p.value):undefined;
    if(block.block_type==='kpi'){
      const currentWeek=avg(weekCurrent(metric.id)),prevWeek=avg(weekPrevious(metric.id));
      return <div className="flex h-full flex-col justify-between p-5"><div><p className="text-[10px] font-black uppercase tracking-[.18em] text-white/45">{block.title||metric.name}</p><div className="mt-2 flex items-end gap-3"><p className="text-4xl font-black tracking-tight">{formatValue(c?.value,metric.unit)}</p>{delta!==undefined&&<span className={`mb-1 rounded-full px-2 py-1 text-[10px] font-black ${delta>=0?'bg-emerald-400/10 text-emerald-300':'bg-rose-400/10 text-rose-300'}`}>{delta>=0?'▲':'▼'} {Math.abs(delta).toLocaleString('pt-BR')}</span>}</div></div><div className="grid grid-cols-2 gap-2 text-[10px]"><div className="rounded-xl bg-black/20 p-2"><span className="text-white/35">Anterior</span><p className="mt-1 font-bold">{formatValue(p?.value,metric.unit)}</p></div><div className="rounded-xl bg-black/20 p-2"><span className="text-white/35">Semana</span><p className="mt-1 font-bold">{currentWeek===undefined?'—':formatValue(currentWeek,metric.unit)}{prevWeek!==undefined&&currentWeek!==undefined?<span className="ml-1 text-white/35">vs {formatValue(prevWeek,metric.unit)}</span>:null}</p></div></div></div>;
    }
    const chartType=block.content?.chart_type||'area';const data=series(metric.id,Number(block.content?.period_days||30));
    if(chartType==='comparison'){
      const d=[{label:'Anterior',value:p?Number(p.value):0},{label:'Atual',value:c?Number(c.value):0}];
      return <ChartShell title={block.title||metric.name}><ResponsiveContainer width="100%" height="100%"><BarChart data={d}><CartesianGrid strokeDasharray="3 3" opacity={.08}/><XAxis dataKey="label" tick={{fill:'#93a4b8',fontSize:10}} axisLine={false}/><YAxis tick={{fill:'#93a4b8',fontSize:10}} axisLine={false}/><Tooltip contentStyle={{background:'#06111b',border:'1px solid rgba(255,255,255,.12)',borderRadius:12}}/><Bar dataKey="value" fill="#5eead4" radius={[9,9,3,3]}/></BarChart></ResponsiveContainer></ChartShell>;
    }
    if(chartType==='bar')return <ChartShell title={block.title||metric.name}><ResponsiveContainer width="100%" height="100%"><BarChart data={data}><CartesianGrid strokeDasharray="3 3" opacity={.08}/><XAxis dataKey="date" tick={{fill:'#93a4b8',fontSize:9}} axisLine={false}/><YAxis tick={{fill:'#93a4b8',fontSize:9}} axisLine={false}/><Tooltip contentStyle={{background:'#06111b',border:'1px solid rgba(255,255,255,.12)',borderRadius:12}}/><Bar dataKey="value" fill="#a78bfa" radius={[6,6,2,2]}/></BarChart></ResponsiveContainer></ChartShell>;
    return <ChartShell title={block.title||metric.name}><ResponsiveContainer width="100%" height="100%"><AreaChart data={data}><defs><linearGradient id={`g-${block.id}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#5eead4" stopOpacity={.55}/><stop offset="100%" stopColor="#5eead4" stopOpacity={.02}/></linearGradient></defs><CartesianGrid strokeDasharray="3 3" opacity={.08}/><XAxis dataKey="date" tick={{fill:'#93a4b8',fontSize:9}} axisLine={false}/><YAxis tick={{fill:'#93a4b8',fontSize:9}} axisLine={false}/><Tooltip contentStyle={{background:'#06111b',border:'1px solid rgba(255,255,255,.12)',borderRadius:12}}/><Area type="monotone" dataKey="value" stroke="#5eead4" strokeWidth={3} fill={`url(#g-${block.id})`}/></AreaChart></ResponsiveContainer></ChartShell>;
  }

  return <div className="min-h-[calc(100vh-80px)] text-white">
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-[24px] border border-white/10 bg-[#050b13]/90 px-4 py-3 shadow-[0_20px_80px_rgba(0,0,0,.38)] backdrop-blur-2xl">
      <div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-2xl border border-emerald-300/20 bg-emerald-400/10 shadow-[0_0_35px_rgba(16,185,129,.16)]"><Sparkles className="h-5 w-5 text-emerald-300"/></div><div><p className="text-[10px] font-black uppercase tracking-[.24em] text-emerald-300/70">FLOW Presentation Studio</p><h1 className="text-lg font-black">Editor 3D • {platform?.name||'Selecione uma plataforma'}</h1></div></div>
      <div className="flex flex-wrap items-center gap-2"><select value={platformId} onChange={e=>setParams({platform:e.target.value,date})} className="h-10 rounded-xl border border-white/10 bg-[#07131f] px-3 text-sm">{platforms.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select><Button variant="outline" onClick={regenerate} disabled={!report||saving} className="border-white/10 bg-white/5 text-white"><RefreshCcw className="mr-2 h-4 w-4"/>Layout inteligente</Button><Button onClick={()=>navigate(`/indicadores/apresentacao?date=${date}&platform=${platformId}`)} className="bg-emerald-400 text-black hover:bg-emerald-300"><MonitorPlay className="mr-2 h-4 w-4"/>Apresentar</Button></div>
    </div>

    <div className="grid gap-4 xl:grid-cols-[230px_minmax(0,1fr)_270px]">
      <aside className="rounded-[24px] border border-white/10 bg-[#050b13]/75 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,.06),0_20px_70px_rgba(0,0,0,.3)] backdrop-blur-xl">
        <p className="text-[10px] font-black uppercase tracking-[.2em] text-white/35">Componentes</p><div className="mt-3 grid gap-2">{[
          ['Indicador',LayoutDashboard,()=>addBlock('kpi')],['Gráfico',BarChart3,()=>addBlock('chart')],['Print',FileImage,()=>addBlock('image')],['Texto',Type,()=>addBlock('text')],['Análise',Sparkles,()=>addBlock('insight')],
        ].map(([label,Icon,onClick]:any)=><button key={label} onClick={onClick} className="group flex items-center gap-3 rounded-2xl border border-white/8 bg-white/[.035] p-3 text-left transition hover:-translate-y-0.5 hover:border-emerald-300/25 hover:bg-emerald-300/[.06] hover:shadow-[0_14px_30px_rgba(0,0,0,.25)]"><span className="grid h-9 w-9 place-items-center rounded-xl bg-black/30 shadow-inner"><Icon className="h-4 w-4 text-emerald-300"/></span><span className="text-sm font-bold">{label}</span><Plus className="ml-auto h-3.5 w-3.5 text-white/25 group-hover:text-emerald-300"/></button>)}</div>
        <div className="mt-5 border-t border-white/8 pt-4"><p className="text-[10px] font-black uppercase tracking-[.2em] text-white/35">Páginas</p><div className="mt-2 grid gap-2">{Array.from({length:pages},(_,i)=>i+1).map(n=><button key={n} onClick={()=>setPage(n)} className={`flex items-center justify-between rounded-xl px-3 py-2 text-xs font-bold transition ${page===n?'bg-emerald-400 text-black shadow-[0_8px_30px_rgba(16,185,129,.18)]':'bg-white/[.035] text-white/60 hover:bg-white/[.07]'}`}><span>Página {n}</span><span>{blocks.filter(b=>Number(b.style?.page||1)===n).length}</span></button>)}</div></div>
      </aside>

      <main className="min-w-0">
        <div className="mb-3 flex items-center justify-between"><div className="flex items-center gap-2 text-xs text-white/40"><Grip className="h-4 w-4"/><span>Arraste os blocos. Use o canto inferior direito para redimensionar.</span></div><div className="flex items-center gap-2"><Button variant="outline" size="sm" disabled={page<=1} onClick={()=>setPage(p=>p-1)} className="border-white/10 bg-white/5 text-white"><ChevronLeft className="h-4 w-4"/></Button><span className="text-xs font-bold text-white/50">{page}/{pages}</span><Button variant="outline" size="sm" disabled={page>=pages} onClick={()=>setPage(p=>p+1)} className="border-white/10 bg-white/5 text-white"><ChevronRight className="h-4 w-4"/></Button></div></div>
        <div className="[perspective:1600px]"><div ref={canvasRef} onPointerMove={moveGesture} onPointerUp={endGesture} onPointerCancel={endGesture} onPointerDown={()=>setSelectedId('')} className="relative aspect-video w-full overflow-hidden rounded-[30px] border border-cyan-300/10 bg-[radial-gradient(circle_at_18%_16%,rgba(34,211,238,.10),transparent_24%),radial-gradient(circle_at_82%_20%,rgba(139,92,246,.10),transparent_24%),linear-gradient(145deg,#07131f,#02070d)] shadow-[0_40px_120px_rgba(0,0,0,.55),inset_0_1px_0_rgba(255,255,255,.06)] [transform:rotateX(.45deg)] [transform-style:preserve-3d]">
          <div className="pointer-events-none absolute inset-0 opacity-[.11]" style={{backgroundImage:'linear-gradient(rgba(255,255,255,.14) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.14) 1px,transparent 1px)',backgroundSize:'34px 34px'}}/>
          <div className="pointer-events-none absolute left-6 top-5 z-[200] text-[10px] font-black uppercase tracking-[.22em] text-white/20">{platform?.name} • {date}</div>
          {!visible.length&&<div className="absolute inset-0 grid place-items-center"><div className="text-center text-white/30"><ImagePlus className="mx-auto mb-3 h-8 w-8"/><p>Esta página está vazia.</p><button onClick={e=>{e.stopPropagation();void regenerate()}} className="mt-2 text-emerald-300">Gerar layout inteligente</button></div></div>}
          {visible.map(block=>{const isSelected=selectedId===block.id;const accent=String(block.style?.accent||'emerald');return <div key={block.id} onPointerDown={e=>startGesture(e,block.id,'drag')} style={{left:`${block.x}%`,top:`${block.y}%`,width:`${block.width}%`,height:`${block.height}%`,zIndex:block.z_index,transform:`translateZ(${Number(block.style?.depth||2)*6}px)`}} className={`absolute cursor-grab select-none rounded-[22px] border bg-gradient-to-br ${accentClasses(accent)} bg-[#07121c]/82 shadow-[0_20px_55px_rgba(0,0,0,.36),inset_0_1px_0_rgba(255,255,255,.055)] backdrop-blur-2xl transition-[box-shadow,border-color] ${isSelected?'ring-2 ring-emerald-300/65 shadow-[0_25px_70px_rgba(16,185,129,.18)]':'hover:border-white/20'}`}>
            <div className="h-full overflow-hidden rounded-[20px]">{renderBlock(block)}</div>{isSelected&&<><div className="pointer-events-none absolute -inset-px rounded-[22px] border border-emerald-300/40"/><button onPointerDown={e=>startGesture(e,block.id,'resize')} className="absolute -bottom-2 -right-2 z-20 grid h-5 w-5 cursor-nwse-resize place-items-center rounded-md border border-emerald-200/40 bg-emerald-400 text-black shadow-lg"><Maximize2 className="h-3 w-3"/></button></>}</div>})}
        </div></div>
      </main>

      <aside className="rounded-[24px] border border-white/10 bg-[#050b13]/75 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,.06),0_20px_70px_rgba(0,0,0,.3)] backdrop-blur-xl">
        <div className="flex items-center gap-2"><Settings2 className="h-4 w-4 text-cyan-300"/><p className="text-[10px] font-black uppercase tracking-[.2em] text-white/35">Propriedades</p>{saving&&<Save className="ml-auto h-3.5 w-3.5 animate-pulse text-emerald-300"/>}</div>
        {!selected?<div className="mt-8 text-center text-sm text-white/30">Selecione um bloco no canvas para personalizar.</div>:<div className="mt-4 space-y-4"><div><label className="text-[10px] font-bold uppercase tracking-[.15em] text-white/35">Título</label><Input value={selected.title||''} onChange={e=>patchSelected({title:e.target.value})} className="mt-1 border-white/10 bg-black/25"/></div>
          {(selected.block_type==='kpi'||selected.block_type==='chart')&&<div><label className="text-[10px] font-bold uppercase tracking-[.15em] text-white/35">Indicador</label><select value={selected.content?.indicator_id||''} onChange={e=>patchContent('indicator_id',e.target.value)} className="mt-1 h-10 w-full rounded-xl border border-white/10 bg-[#07131f] px-3 text-sm">{platformMetrics.map(m=><option key={m.id} value={m.id}>{m.name}</option>)}</select></div>}
          {selected.block_type==='chart'&&<><div><label className="text-[10px] font-bold uppercase tracking-[.15em] text-white/35">Tipo de gráfico</label><select value={selected.content?.chart_type||'area'} onChange={e=>patchContent('chart_type',e.target.value)} className="mt-1 h-10 w-full rounded-xl border border-white/10 bg-[#07131f] px-3 text-sm"><option value="area">Linha / área</option><option value="bar">Barras por período</option><option value="comparison">Anterior x atual</option></select></div><div><label className="text-[10px] font-bold uppercase tracking-[.15em] text-white/35">Período do gráfico</label><select value={Number(selected.content?.period_days||30)} onChange={e=>patchContent('period_days',Number(e.target.value))} className="mt-1 h-10 w-full rounded-xl border border-white/10 bg-[#07131f] px-3 text-sm"><option value={7}>7 dias</option><option value={14}>14 dias</option><option value={30}>30 dias</option><option value={60}>60 dias</option><option value={90}>90 dias</option></select></div></>}
          {(selected.block_type==='text'||selected.block_type==='insight')&&<div><label className="text-[10px] font-bold uppercase tracking-[.15em] text-white/35">Conteúdo</label><Textarea value={selected.content?.text||''} onChange={e=>patchContent('text',e.target.value)} rows={7} className="mt-1 border-white/10 bg-black/25"/></div>}
          {selected.block_type==='image'&&<div><label className="text-[10px] font-bold uppercase tracking-[.15em] text-white/35">Print</label><select value={selected.content?.image_id||''} onChange={e=>{const img=images.find(i=>i.id===e.target.value);if(img)void patchSelected({content:{...selected.content,image_id:img.id,image_url:img.image_url}})}} className="mt-1 h-10 w-full rounded-xl border border-white/10 bg-[#07131f] px-3 text-sm">{images.map((i,index)=><option key={i.id} value={i.id}>{i.original_name||`Print ${index+1}`}</option>)}</select></div>}
          <div><label className="text-[10px] font-bold uppercase tracking-[.15em] text-white/35">Acento 3D</label><div className="mt-2 flex flex-wrap gap-2">{accents.map(a=><button key={a} onClick={()=>patchStyle('accent',a)} className={`h-7 w-7 rounded-full border-2 ${selected.style?.accent===a?'border-white':'border-white/10'} ${a==='emerald'?'bg-emerald-400':a==='cyan'?'bg-cyan-400':a==='violet'?'bg-violet-400':a==='amber'?'bg-amber-400':a==='rose'?'bg-rose-400':'bg-blue-400'}`}/>)}</div></div>
          <div><label className="text-[10px] font-bold uppercase tracking-[.15em] text-white/35">Página</label><Input type="number" min={1} max={20} value={Number(selected.style?.page||1)} onChange={e=>patchStyle('page',Math.max(1,Number(e.target.value)||1))} className="mt-1 border-white/10 bg-black/25"/></div>
          <div className="grid grid-cols-2 gap-2"><Button variant="outline" onClick={duplicateBlock} className="border-white/10 bg-white/5 text-white"><Copy className="mr-2 h-4 w-4"/>Duplicar</Button><Button variant="outline" onClick={deleteBlock} className="border-rose-300/15 bg-rose-400/5 text-rose-200"><Trash2 className="mr-2 h-4 w-4"/>Excluir</Button></div>
        </div>}
      </aside>
    </div>
  </div>;
}

function ChartShell({title,children}:{title:string;children:any}){
  return <div className="flex h-full flex-col p-4"><div className="mb-2 flex items-center justify-between"><p className="truncate text-sm font-black">{title}</p><span className="rounded-full bg-white/5 px-2 py-1 text-[9px] font-black uppercase tracking-[.16em] text-white/35">Comparativo</span></div><div className="min-h-0 flex-1">{children}</div></div>;
}
