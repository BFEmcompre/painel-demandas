import { useEffect, useMemo, useRef, useState } from 'react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ChevronLeft, ChevronRight, Maximize2, Minimize2, Pencil, Presentation } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { supabase } from '../../lib/supabase';

type Platform={id:string;name:string;responsible_name:string;display_order:number};
type Metric={id:string;platform_id:string;name:string;unit:string;target_value:number|null};
type Measurement={indicator_id:string;reference_date:string;value:number};
type Report={id:string;platform_id:string;reference_date:string;title:string;status:string};
type Block={id:string;report_id:string;block_type:string;title:string|null;content:any;x:number;y:number;width:number;height:number;z_index:number;style:any};

const today=()=>new Date().toLocaleDateString('sv-SE',{timeZone:'America/Sao_Paulo'});
const accentShadow:Record<string,string>={emerald:'rgba(16,185,129,.16)',cyan:'rgba(34,211,238,.16)',violet:'rgba(139,92,246,.16)',amber:'rgba(245,158,11,.16)',rose:'rgba(244,63,94,.16)',blue:'rgba(59,130,246,.16)'};

function format(v:number|undefined,unit:string){
  if(v===undefined)return '—';
  if(unit==='%')return `${Number(v).toLocaleString('pt-BR')}%`;
  if(unit==='R$')return Number(v).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
  if(unit==='nota')return Number(v).toLocaleString('pt-BR',{maximumFractionDigits:2});
  return Number(v).toLocaleString('pt-BR');
}

export function IndicatorsPresentation(){
  const navigate=useNavigate();
  const [params,setParams]=useSearchParams();
  const [date,setDate]=useState(params.get('date')||today());
  const [platforms,setPlatforms]=useState<Platform[]>([]);
  const [metrics,setMetrics]=useState<Metric[]>([]);
  const [measurements,setMeasurements]=useState<Measurement[]>([]);
  const [reports,setReports]=useState<Report[]>([]);
  const [blocks,setBlocks]=useState<Block[]>([]);
  const [reportIndex,setReportIndex]=useState(0);
  const [page,setPage]=useState(1);
  const [isFullscreen,setIsFullscreen]=useState(false);
  const stageRef=useRef<HTMLDivElement|null>(null);

  useEffect(()=>{void load()},[date]);
  useEffect(()=>{
    const onFullscreen=()=>setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange',onFullscreen);
    return()=>document.removeEventListener('fullscreenchange',onFullscreen);
  },[]);
  useEffect(()=>{
    const handler=(e:KeyboardEvent)=>{
      if(e.key==='ArrowRight')next();
      if(e.key==='ArrowLeft')previous();
      if(e.key==='Escape'&&document.fullscreenElement)void document.exitFullscreen();
    };
    window.addEventListener('keydown',handler);return()=>window.removeEventListener('keydown',handler);
  });

  async function load(){
    const [{data:p},{data:m},{data:v},{data:r}]=await Promise.all([
      supabase.from('platforms').select('id,name,responsible_name,display_order').eq('active',true).order('display_order'),
      supabase.from('indicator_definitions').select('id,platform_id,name,unit,target_value').eq('active',true),
      supabase.from('indicator_measurements').select('indicator_id,reference_date,value').lte('reference_date',date).order('reference_date'),
      supabase.from('indicator_reports').select('id,platform_id,reference_date,title,status').eq('report_type','daily').eq('reference_date',date).in('status',['ready','presented']),
    ]);
    const ps=(p||[]) as Platform[];
    const rs=((r||[]) as Report[]).sort((a,b)=>(ps.find(x=>x.id===a.platform_id)?.display_order||0)-(ps.find(x=>x.id===b.platform_id)?.display_order||0));
    setPlatforms(ps);setMetrics((m||[]) as Metric[]);setMeasurements((v||[]) as Measurement[]);setReports(rs);
    const wanted=params.get('platform');const idx=wanted?Math.max(0,rs.findIndex(x=>x.platform_id===wanted)):0;setReportIndex(idx);setPage(1);
    if(rs.length){const {data:b}=await supabase.from('indicator_report_blocks').select('*').in('report_id',rs.map(x=>x.id)).order('z_index');setBlocks((b||[]) as Block[])}else setBlocks([]);
  }

  const report=reports[reportIndex];
  const platform=platforms.find(p=>p.id===report?.platform_id);
  const reportBlocks=useMemo(()=>blocks.filter(b=>b.report_id===report?.id),[blocks,report]);
  const pages=Math.max(1,...reportBlocks.map(b=>Number(b.style?.page||1)));
  const visible=reportBlocks.filter(b=>Number(b.style?.page||1)===page);

  const current=(id:string)=>measurements.find(m=>m.indicator_id===id&&m.reference_date===date);
  const previousValue=(id:string)=>[...measurements.filter(m=>m.indicator_id===id&&m.reference_date<date)].sort((a,b)=>b.reference_date.localeCompare(a.reference_date))[0];
  const series=(id:string,days=30)=>measurements.filter(m=>m.indicator_id===id&&m.reference_date<=date).sort((a,b)=>a.reference_date.localeCompare(b.reference_date)).slice(-days).map(m=>({date:m.reference_date.slice(5),value:Number(m.value)}));

  function next(){
    if(page<pages){setPage(p=>p+1);return;}
    if(reportIndex<reports.length-1){setReportIndex(i=>i+1);setPage(1);}
  }
  function previous(){
    if(page>1){setPage(p=>p-1);return;}
    if(reportIndex>0){const prev=reports[reportIndex-1];const prevPages=Math.max(1,...blocks.filter(b=>b.report_id===prev?.id).map(b=>Number(b.style?.page||1)));setReportIndex(i=>i-1);setPage(prevPages);}
  }
  async function toggleFullscreen(){
    if(!document.fullscreenElement){await stageRef.current?.requestFullscreen?.()}else await document.exitFullscreen();
  }

  function renderBlock(block:Block){
    if(block.block_type==='image')return <div className="h-full overflow-hidden rounded-[18px] bg-black/35"><img src={block.content?.image_url} className="h-full w-full object-contain"/></div>;
    if(block.block_type==='text'||block.block_type==='insight')return <div className="flex h-full flex-col justify-center p-5"><p className="text-[10px] font-black uppercase tracking-[.2em] text-white/35">{block.block_type==='insight'?'Análise':'Apresentação'}</p><h3 className="mt-2 text-xl font-black">{block.title}</h3><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-white/60">{block.content?.text}</p></div>;
    const metric=metrics.find(m=>m.id===block.content?.indicator_id);if(!metric)return null;
    const c=current(metric.id),p=previousValue(metric.id);const delta=c&&p?Number(c.value)-Number(p.value):undefined;
    if(block.block_type==='kpi')return <div className="flex h-full flex-col justify-between p-5"><div><p className="text-[10px] font-black uppercase tracking-[.18em] text-white/45">{block.title||metric.name}</p><div className="mt-2 flex items-end gap-3"><p className="text-4xl font-black tracking-tight">{format(c?.value,metric.unit)}</p>{delta!==undefined&&<span className={`mb-1 rounded-full px-2 py-1 text-[10px] font-black ${delta>=0?'bg-emerald-400/10 text-emerald-300':'bg-rose-400/10 text-rose-300'}`}>{delta>=0?'▲':'▼'} {Math.abs(delta).toLocaleString('pt-BR')}</span>}</div></div><div className="grid grid-cols-2 gap-2 text-[10px]"><div className="rounded-xl bg-black/20 p-2"><span className="text-white/35">Anterior</span><p className="mt-1 font-bold">{format(p?.value,metric.unit)}</p></div>{metric.target_value!==null&&<div className="rounded-xl bg-black/20 p-2"><span className="text-white/35">Meta</span><p className="mt-1 font-bold">{format(metric.target_value,metric.unit)}</p></div>}</div></div>;
    const chartType=block.content?.chart_type||'area';
    if(chartType==='comparison'){
      const data=[{label:'Anterior',value:p?Number(p.value):0},{label:'Atual',value:c?Number(c.value):0}];
      return <Chart title={block.title||metric.name}><ResponsiveContainer width="100%" height="100%"><BarChart data={data}><CartesianGrid strokeDasharray="3 3" opacity={.08}/><XAxis dataKey="label" tick={{fill:'#93a4b8',fontSize:10}} axisLine={false}/><YAxis tick={{fill:'#93a4b8',fontSize:10}} axisLine={false}/><Tooltip contentStyle={{background:'#06111b',border:'1px solid rgba(255,255,255,.12)',borderRadius:12}}/><Bar dataKey="value" fill="#5eead4" radius={[9,9,3,3]}/></BarChart></ResponsiveContainer></Chart>;
    }
    const data=series(metric.id,Number(block.content?.period_days||30));
    if(chartType==='bar')return <Chart title={block.title||metric.name}><ResponsiveContainer width="100%" height="100%"><BarChart data={data}><CartesianGrid strokeDasharray="3 3" opacity={.08}/><XAxis dataKey="date" tick={{fill:'#93a4b8',fontSize:9}} axisLine={false}/><YAxis tick={{fill:'#93a4b8',fontSize:9}} axisLine={false}/><Tooltip contentStyle={{background:'#06111b',border:'1px solid rgba(255,255,255,.12)',borderRadius:12}}/><Bar dataKey="value" fill="#a78bfa" radius={[6,6,2,2]}/></BarChart></ResponsiveContainer></Chart>;
    return <Chart title={block.title||metric.name}><ResponsiveContainer width="100%" height="100%"><AreaChart data={data}><defs><linearGradient id={`pres-${block.id}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#5eead4" stopOpacity={.52}/><stop offset="100%" stopColor="#5eead4" stopOpacity={.02}/></linearGradient></defs><CartesianGrid strokeDasharray="3 3" opacity={.08}/><XAxis dataKey="date" tick={{fill:'#93a4b8',fontSize:9}} axisLine={false}/><YAxis tick={{fill:'#93a4b8',fontSize:9}} axisLine={false}/><Tooltip contentStyle={{background:'#06111b',border:'1px solid rgba(255,255,255,.12)',borderRadius:12}}/><Area type="monotone" dataKey="value" stroke="#5eead4" strokeWidth={3} fill={`url(#pres-${block.id})`}/></AreaChart></ResponsiveContainer></Chart>;
  }

  return <div ref={stageRef} className={isFullscreen?'h-screen w-screen overflow-hidden bg-[#02070d] p-4 text-white':'space-y-4 text-white'}>
    <div className={`flex flex-wrap items-center justify-between gap-3 ${isFullscreen?'mb-3':''}`}><div><p className="text-[10px] font-black uppercase tracking-[.22em] text-emerald-300/65">FLOW / Apresentação executiva</p><h1 className="mt-1 text-3xl font-black">{platform?.name||'Nenhuma apresentação pronta'}</h1>{platform&&<p className="mt-1 text-xs text-white/40">{platform.responsible_name} • Plataforma {reportIndex+1}/{reports.length} • Página {page}/{pages}</p>}</div><div className="flex flex-wrap items-center gap-2"><Input type="date" value={date} onChange={e=>{setDate(e.target.value);setParams({date:e.target.value})}} className="w-auto border-white/10 bg-black/30"/><Button variant="outline" onClick={()=>navigate(`/indicadores/studio/editor?platform=${report?.platform_id||''}&date=${date}`)} className="border-white/10 bg-white/5 text-white"><Pencil className="mr-2 h-4 w-4"/>Editar</Button><Button variant="outline" disabled={reportIndex===0&&page===1} onClick={previous} className="border-white/10 bg-white/5 text-white"><ChevronLeft className="h-4 w-4"/></Button><Button variant="outline" disabled={reportIndex>=reports.length-1&&page>=pages} onClick={next} className="border-white/10 bg-white/5 text-white"><ChevronRight className="h-4 w-4"/></Button><Button onClick={toggleFullscreen} className="bg-emerald-400 text-black hover:bg-emerald-300">{isFullscreen?<Minimize2 className="mr-2 h-4 w-4"/>:<Maximize2 className="mr-2 h-4 w-4"/>}{isFullscreen?'Sair da tela cheia':'Tela cheia'}</Button></div></div>
    {!report?<div className="grid min-h-[65vh] place-items-center rounded-[28px] border border-dashed border-white/15 bg-black/25 text-center text-white/35"><div><Presentation className="mx-auto mb-3 h-8 w-8"/><p>Nenhuma plataforma finalizou a apresentação nesta data.</p></div></div>:<div className="[perspective:1600px]"><div className={`${isFullscreen?'h-[calc(100vh-92px)]':'aspect-video'} relative w-full overflow-hidden rounded-[30px] border border-cyan-300/10 bg-[radial-gradient(circle_at_18%_16%,rgba(34,211,238,.10),transparent_24%),radial-gradient(circle_at_82%_20%,rgba(139,92,246,.10),transparent_24%),linear-gradient(145deg,#07131f,#02070d)] shadow-[0_40px_120px_rgba(0,0,0,.58),inset_0_1px_0_rgba(255,255,255,.06)] [transform:rotateX(.28deg)] [transform-style:preserve-3d]`}><div className="pointer-events-none absolute inset-0 opacity-[.10]" style={{backgroundImage:'linear-gradient(rgba(255,255,255,.14) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.14) 1px,transparent 1px)',backgroundSize:'34px 34px'}}/>{visible.map(block=>{const accent=String(block.style?.accent||'emerald');return <div key={block.id} style={{left:`${block.x}%`,top:`${block.y}%`,width:`${block.width}%`,height:`${block.height}%`,zIndex:block.z_index,transform:`translateZ(${Number(block.style?.depth||2)*7}px)`,boxShadow:`0 24px 70px rgba(0,0,0,.34), 0 0 45px ${accentShadow[accent]||accentShadow.emerald}, inset 0 1px 0 rgba(255,255,255,.055)`}} className="absolute overflow-hidden rounded-[22px] border border-white/10 bg-[#07121c]/82 backdrop-blur-2xl">{renderBlock(block)}</div>})}{!visible.length&&<div className="absolute inset-0 grid place-items-center text-white/30">Página vazia. Abra o editor para montar a apresentação.</div>}</div></div>}
  </div>;
}

function Chart({title,children}:{title:string;children:any}){return <div className="flex h-full flex-col p-4"><div className="mb-2 flex items-center justify-between"><p className="truncate text-sm font-black">{title}</p><span className="rounded-full bg-white/5 px-2 py-1 text-[9px] font-black uppercase tracking-[.16em] text-white/35">Comparativo</span></div><div className="min-h-0 flex-1">{children}</div></div>}
