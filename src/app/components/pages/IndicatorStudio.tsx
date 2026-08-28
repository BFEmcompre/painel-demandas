import { ChangeEvent, PointerEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { BarChart3, Check, FileImage, Grip, ImagePlus, Loader2, Plus, Presentation, Sparkles, Trash2, Type, UploadCloud } from 'lucide-react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { supabase } from '../../lib/supabase';

type Platform={id:string;name:string;responsible_id:string;responsible_name:string;display_order:number;upload_deadline:string};
type Metric={id:string;platform_id:string;name:string;unit:string;direction:'higher'|'lower'|'target';target_value:number|null;display_order:number};
type Measurement={indicator_id:string;reference_date:string;value:number};
type Submission={id:string;platform_id:string;reference_date:string;status:string;is_late:boolean;upload_completed_at:string|null};
type SubmissionImage={id:string;submission_id:string;image_url:string;storage_path:string|null;original_name:string|null;display_order:number};
type Extracted={indicator_id:string;found:boolean;value:number|null;confidence:number;raw_text:string};
type Report={id:string;platform_id:string;reference_date:string;title:string};
type Block={id:string;report_id:string;block_type:'kpi'|'chart'|'image'|'text'|'insight'|'impact'|'action'|'table'|'divider';title:string|null;content:any;x:number;y:number;width:number;height:number;z_index:number;style:any};

type DragState={id:string;startX:number;startY:number;originX:number;originY:number}|null;

const today=()=>new Date().toLocaleDateString('sv-SE',{timeZone:'America/Sao_Paulo'});
const pct=(v:number)=>Math.max(0,Math.min(96,v));

function formatValue(value:number|null|undefined,unit:string){if(value===null||value===undefined)return '—';if(unit==='%')return `${Number(value).toLocaleString('pt-BR')}%`;if(unit==='R$')return Number(value).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});if(unit==='nota')return Number(value).toLocaleString('pt-BR',{maximumFractionDigits:2});return `${Number(value).toLocaleString('pt-BR')}${unit==='p.p.'?' p.p.':''}`}

export function IndicatorStudio(){
  const [params,setParams]=useSearchParams();
  const [platforms,setPlatforms]=useState<Platform[]>([]);
  const [metrics,setMetrics]=useState<Metric[]>([]);
  const [measurements,setMeasurements]=useState<Measurement[]>([]);
  const [submission,setSubmission]=useState<Submission|null>(null);
  const [images,setImages]=useState<SubmissionImage[]>([]);
  const [extracted,setExtracted]=useState<Extracted[]>([]);
  const [reviewValues,setReviewValues]=useState<Record<string,string>>({});
  const [warnings,setWarnings]=useState<string[]>([]);
  const [uploading,setUploading]=useState(false);
  const [extracting,setExtracting]=useState(false);
  const [confirming,setConfirming]=useState(false);
  const [report,setReport]=useState<Report|null>(null);
  const [blocks,setBlocks]=useState<Block[]>([]);
  const [selectedMetric,setSelectedMetric]=useState('');
  const [drag,setDrag]=useState<DragState>(null);
  const canvasRef=useRef<HTMLDivElement|null>(null);
  const date=today();

  const platformId=params.get('platform')||'';
  const platform=platforms.find(p=>p.id===platformId);
  const platformMetrics=useMemo(()=>metrics.filter(m=>m.platform_id===platformId).sort((a,b)=>a.display_order-b.display_order),[metrics,platformId]);

  useEffect(()=>{void bootstrap()},[]);
  useEffect(()=>{if(platformId)void loadPlatformDay(platformId)},[platformId]);

  async function bootstrap(){
    const {data:auth}=await supabase.auth.getUser(); if(!auth.user)return;
    const {data:profile}=await supabase.from('profiles').select('role').eq('id',auth.user.id).single();
    const isAdmin=['manager','admin','gestor'].includes(String(profile?.role||'').toLowerCase());
    let query=supabase.from('platforms').select('id,name,responsible_id,responsible_name,display_order,upload_deadline').eq('active',true).order('display_order');
    if(!isAdmin)query=query.eq('responsible_id',auth.user.id);
    const [{data:p},{data:m},{data:history}]=await Promise.all([
      query,
      supabase.from('indicator_definitions').select('id,platform_id,name,unit,direction,target_value,display_order').eq('active',true).order('display_order'),
      supabase.from('indicator_measurements').select('indicator_id,reference_date,value').order('reference_date',{ascending:true}).limit(4000),
    ]);
    const ps=(p||[]) as Platform[];setPlatforms(ps);setMetrics((m||[]) as Metric[]);setMeasurements((history||[]) as Measurement[]);
    if(!params.get('platform')&&ps[0])setParams({platform:ps[0].id},{replace:true});
  }

  async function loadPlatformDay(pid:string){
    setExtracted([]);setReviewValues({});setWarnings([]);
    const {data:s}=await supabase.from('indicator_submissions').select('id,platform_id,reference_date,status,is_late,upload_completed_at').eq('platform_id',pid).eq('reference_date',date).maybeSingle();
    setSubmission((s||null) as Submission|null);
    if(s){const [{data:i},{data:r}]=await Promise.all([
      supabase.from('indicator_submission_images').select('*').eq('submission_id',s.id).order('display_order'),
      supabase.from('indicator_reports').select('id,platform_id,reference_date,title').eq('platform_id',pid).eq('report_type','daily').eq('reference_date',date).maybeSingle(),
    ]);setImages((i||[]) as SubmissionImage[]);setReport((r||null) as Report|null);if(r)await loadBlocks(r.id);}else{setImages([]);setReport(null);setBlocks([]);}
  }

  async function ensureSubmission(){
    if(!platform)return null;if(submission)return submission;
    const {data,error}=await supabase.from('indicator_submissions').upsert({platform_id:platform.id,responsible_id:platform.responsible_id,reference_date:date,status:'draft'},{onConflict:'platform_id,reference_date'}).select('id,platform_id,reference_date,status,is_late,upload_completed_at').single();
    if(error){alert(error.message);return null;}setSubmission(data as Submission);return data as Submission;
  }

  async function uploadPrints(e:ChangeEvent<HTMLInputElement>){
    const files=Array.from(e.target.files||[]);if(!files.length||!platform)return;setUploading(true);
    const s=await ensureSubmission();if(!s){setUploading(false);return;}
    const {data:auth}=await supabase.auth.getUser();const uid=auth.user?.id||'unknown';
    const rows:any[]=[];
    for(let index=0;index<files.length;index++){
      const file=files[index];const safe=file.name.replace(/[^a-zA-Z0-9._-]/g,'_');const path=`${uid}/${platform.id}/${date}/${Date.now()}-${index}-${safe}`;
      const {error}=await supabase.storage.from('platform-indicators').upload(path,file);if(error){alert(error.message);continue;}
      const {data:url}=supabase.storage.from('platform-indicators').getPublicUrl(path);
      rows.push({submission_id:s.id,image_url:url.publicUrl,storage_path:path,original_name:file.name,display_order:images.length+index});
    }
    if(rows.length){await supabase.from('indicator_submission_images').insert(rows);await supabase.from('indicator_submissions').update({status:'uploaded',upload_completed_at:new Date().toISOString()}).eq('id',s.id);}
    setUploading(false);e.target.value='';await loadPlatformDay(platform.id);
  }

  async function removeImage(image:SubmissionImage){
    if(image.storage_path)await supabase.storage.from('platform-indicators').remove([image.storage_path]);
    await supabase.from('indicator_submission_images').delete().eq('id',image.id);if(platform)await loadPlatformDay(platform.id);
  }

  async function extractData(){
    if(!submission||!platformMetrics.length)return;setExtracting(true);setWarnings([]);
    const {data,error}=await supabase.functions.invoke('extract-indicators',{body:{submission_id:submission.id}});
    if(error||data?.error){alert(data?.error||error?.message||'Falha ao extrair dados');setExtracting(false);return;}
    const result=(data.metrics||[]) as Extracted[];setExtracted(result);setWarnings(data.warnings||[]);
    const next:Record<string,string>={};for(const m of platformMetrics){const item=result.find(r=>r.indicator_id===m.id);next[m.id]=item?.found&&item.value!==null?String(item.value):'';}setReviewValues(next);setExtracting(false);
  }

  async function confirmExtraction(){
    if(!submission||!platform)return;setConfirming(true);const {data:auth}=await supabase.auth.getUser();
    const rows=platformMetrics.flatMap(metric=>{const raw=reviewValues[metric.id]?.trim();if(!raw)return[];const value=Number(raw.replace(',','.'));if(Number.isNaN(value))return[];const found=extracted.find(e=>e.indicator_id===metric.id);return[{indicator_id:metric.id,reference_date:date,value,source_type:'image',submission_id:submission.id,confidence:found?.confidence??null,raw_text:found?.raw_text||null,source_metadata:{images:images.map(i=>i.id)},created_by:auth.user?.id||null}]});
    if(rows.length){const {error}=await supabase.from('indicator_measurements').upsert(rows,{onConflict:'indicator_id,reference_date'});if(error){alert(error.message);setConfirming(false);return;}}
    await supabase.from('indicator_submissions').update({status:'confirmed',confirmed_at:new Date().toISOString()}).eq('id',submission.id);
    const {data:r,error:rErr}=await supabase.from('indicator_reports').upsert({platform_id:platform.id,responsible_id:platform.responsible_id,report_type:'daily',reference_date:date,title:`${platform.name} • ${date}`,status:'ready'},{onConflict:'platform_id,report_type,reference_date'}).select('id,platform_id,reference_date,title').single();
    if(rErr)alert(rErr.message);else{setReport(r as Report);await loadBlocks(r.id);}
    const {data:h}=await supabase.from('indicator_measurements').select('indicator_id,reference_date,value').order('reference_date',{ascending:true}).limit(4000);setMeasurements((h||[]) as Measurement[]);setConfirming(false);await loadPlatformDay(platform.id);
  }

  async function loadBlocks(reportId:string){const {data}=await supabase.from('indicator_report_blocks').select('*').eq('report_id',reportId).order('z_index');setBlocks((data||[]) as Block[]);}

  async function addBlock(type:'kpi'|'chart'|'image'|'text'){
    if(!report)return;
    let content:any={};let title:string|null=null;
    if(type==='kpi'||type==='chart'){const metricId=selectedMetric||platformMetrics[0]?.id;if(!metricId)return;const metric=platformMetrics.find(m=>m.id===metricId);content={indicator_id:metricId,chart_type:type==='chart'?'area':undefined};title=metric?.name||null;}
    if(type==='image'){if(!images[0])return;content={image_id:images[0].id,image_url:images[0].image_url};title='Evidência';}
    if(type==='text'){content={text:'Clique e edite este texto na configuração do bloco.'};title='Observação';}
    const offset=(blocks.length%5)*4;const {error}=await supabase.from('indicator_report_blocks').insert({report_id:report.id,block_type:type,title,content,x:4+offset,y:4+offset,width:type==='kpi'?28:44,height:type==='text'?20:32,z_index:blocks.length+1,style:{}});if(error)alert(error.message);else await loadBlocks(report.id);
  }

  async function deleteBlock(id:string){await supabase.from('indicator_report_blocks').delete().eq('id',id);if(report)await loadBlocks(report.id);}

  function beginDrag(e:PointerEvent,id:string){const block=blocks.find(b=>b.id===id);if(!block)return;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);setDrag({id,startX:e.clientX,startY:e.clientY,originX:Number(block.x),originY:Number(block.y)});}
  function moveDrag(e:PointerEvent){if(!drag||!canvasRef.current)return;const rect=canvasRef.current.getBoundingClientRect();const dx=(e.clientX-drag.startX)/rect.width*100;const dy=(e.clientY-drag.startY)/rect.height*100;setBlocks(prev=>prev.map(b=>b.id===drag.id?{...b,x:pct(drag.originX+dx),y:Math.max(0,Math.min(92,drag.originY+dy))}:b));}
  async function endDrag(){if(!drag)return;const block=blocks.find(b=>b.id===drag.id);setDrag(null);if(block)await supabase.from('indicator_report_blocks').update({x:block.x,y:block.y}).eq('id',block.id);}

  const previousFor=(id:string)=>[...measurements.filter(m=>m.indicator_id===id&&m.reference_date<date)].sort((a,b)=>b.reference_date.localeCompare(a.reference_date))[0];
  const currentFor=(id:string)=>measurements.find(m=>m.indicator_id===id&&m.reference_date===date);
  const historyFor=(id:string)=>measurements.filter(m=>m.indicator_id===id).sort((a,b)=>a.reference_date.localeCompare(b.reference_date)).slice(-12).map(m=>({date:m.reference_date.slice(5),value:Number(m.value)}));

  function renderBlock(block:Block){
    if(block.block_type==='image')return <img src={block.content?.image_url} className="h-full w-full rounded-xl object-contain"/>;
    if(block.block_type==='text')return <div className="h-full rounded-xl bg-white/[0.04] p-4"><h3 className="font-black">{block.title||'Texto'}</h3><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-white/65">{block.content?.text||'Observação da apresentação'}</p></div>;
    const metric=platformMetrics.find(m=>m.id===block.content?.indicator_id);if(!metric)return <div className="p-4 text-sm text-white/40">Métrica não encontrada.</div>;
    const current=currentFor(metric.id);const previous=previousFor(metric.id);const delta=current&&previous?Number(current.value)-Number(previous.value):null;
    if(block.block_type==='kpi')return <div className="flex h-full flex-col justify-between rounded-xl bg-gradient-to-br from-emerald-400/12 to-cyan-400/5 p-4"><div><p className="text-xs uppercase tracking-[0.16em] text-white/45">{metric.name}</p><p className="mt-2 text-4xl font-black">{formatValue(current?.value,metric.unit)}</p></div><div className="flex items-end justify-between gap-3"><p className={`text-sm font-bold ${delta===null?'text-white/35':delta>=0?'text-emerald-300':'text-rose-300'}`}>{delta===null?'Sem comparação':`${delta>=0?'+':''}${delta.toLocaleString('pt-BR')} vs. anterior`}</p>{metric.target_value!==null&&<p className="text-xs text-white/40">Meta {formatValue(metric.target_value,metric.unit)}</p>}</div></div>;
    const data=historyFor(metric.id);const chartType=block.content?.chart_type||'area';return <div className="h-full rounded-xl bg-white/[0.025] p-3"><div className="mb-2 flex items-center justify-between"><p className="text-sm font-black">{metric.name}</p><span className="text-[10px] uppercase tracking-[0.14em] text-emerald-300/65">Evolução</span></div><div className="h-[calc(100%-30px)]"><ResponsiveContainer width="100%" height="100%">{chartType==='bar'?<BarChart data={data}><CartesianGrid strokeDasharray="3 3" opacity={0.08}/><XAxis dataKey="date" tick={{fill:'#8ba0b5',fontSize:9}} axisLine={false}/><YAxis tick={{fill:'#8ba0b5',fontSize:9}} axisLine={false}/><Tooltip contentStyle={{background:'#06111b',border:'1px solid rgba(255,255,255,.12)',borderRadius:12}}/><Bar dataKey="value" fill="url(#barGradient)" radius={[7,7,2,2]}/><defs><linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#5eead4"/><stop offset="100%" stopColor="#059669"/></linearGradient></defs></BarChart>:<AreaChart data={data}><defs><linearGradient id={`area-${metric.id}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#5eead4" stopOpacity={.45}/><stop offset="100%" stopColor="#059669" stopOpacity={.03}/></linearGradient></defs><CartesianGrid strokeDasharray="3 3" opacity={0.08}/><XAxis dataKey="date" tick={{fill:'#8ba0b5',fontSize:9}} axisLine={false}/><YAxis tick={{fill:'#8ba0b5',fontSize:9}} axisLine={false}/><Tooltip contentStyle={{background:'#06111b',border:'1px solid rgba(255,255,255,.12)',borderRadius:12}}/><Area type="monotone" dataKey="value" stroke="#5eead4" strokeWidth={3} fill={`url(#area-${metric.id})`}/></AreaChart>}</ResponsiveContainer></div></div>;
  }

  return <div className="space-y-6 text-white">
    <section className="rounded-[28px] border border-white/10 bg-black/35 p-6 backdrop-blur-xl lg:p-8"><div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between"><div><p className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-300/75">Presentation Studio</p><h1 className="mt-2 text-3xl font-black sm:text-4xl">Do print à apresentação.</h1><p className="mt-2 max-w-3xl text-sm text-white/55">Envie os prints que vocês já usam, deixe o FLOW extrair as métricas, confira os números e monte a apresentação livremente.</p></div><select value={platformId} onChange={e=>setParams({platform:e.target.value})} className="rounded-xl border border-white/15 bg-[#07131f] px-4 py-2 text-sm text-white">{platforms.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></div></section>

    {!platform?<Card className="border-white/10 bg-black/30 p-8 text-white/50">Nenhuma plataforma disponível para você.</Card>:<>
      <section className="grid gap-4 xl:grid-cols-[1.1fr_.9fr]">
        <Card className="border-white/10 bg-black/30 p-5 text-white backdrop-blur-xl"><div className="flex items-start justify-between"><div><p className="text-xs uppercase tracking-[0.18em] text-white/40">1. Evidências do dia</p><h2 className="mt-1 text-xl font-black">Prints de {platform.name}</h2><p className="mt-1 text-xs text-white/40">Prazo: {String(platform.upload_deadline).slice(0,5)} {submission?.is_late&&<span className="ml-2 rounded-full bg-rose-400/15 px-2 py-1 font-bold text-rose-300">ENVIADO COM ATRASO</span>}</p></div><label className="cursor-pointer"><input type="file" multiple accept="image/png,image/jpeg,image/webp" className="hidden" onChange={uploadPrints}/><span className="inline-flex items-center rounded-xl bg-emerald-400 px-4 py-2 text-sm font-bold text-black hover:bg-emerald-300">{uploading?<Loader2 className="mr-2 h-4 w-4 animate-spin"/>:<UploadCloud className="mr-2 h-4 w-4"/>}Anexar prints</span></label></div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{images.length===0?<div className="col-span-full flex min-h-40 items-center justify-center rounded-2xl border border-dashed border-white/15 text-sm text-white/35">Nenhum print anexado hoje.</div>:images.map(i=><div key={i.id} className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]"><img src={i.image_url} className="h-44 w-full object-contain"/><button onClick={()=>void removeImage(i)} className="absolute right-2 top-2 rounded-lg bg-black/75 p-2 opacity-0 transition group-hover:opacity-100"><Trash2 className="h-4 w-4 text-rose-300"/></button><p className="truncate border-t border-white/10 px-3 py-2 text-[11px] text-white/40">{i.original_name}</p></div>)}</div>
          <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl border border-cyan-300/15 bg-cyan-300/[0.045] p-4"><div><p className="font-bold">Extrair somente as métricas configuradas</p><p className="mt-1 text-xs text-white/45">O FLOW lê os prints, mas você confere tudo antes de gravar no histórico.</p></div><Button disabled={!images.length||!platformMetrics.length||extracting} onClick={extractData} className="bg-cyan-300 text-slate-950 hover:bg-cyan-200">{extracting?<Loader2 className="mr-2 h-4 w-4 animate-spin"/>:<Sparkles className="mr-2 h-4 w-4"/>}Extrair dados</Button></div>
        </Card>

        <Card className="border-white/10 bg-black/30 p-5 text-white backdrop-blur-xl"><p className="text-xs uppercase tracking-[0.18em] text-white/40">2. Revisão</p><h2 className="mt-1 text-xl font-black">Métricas encontradas</h2><div className="mt-4 max-h-[470px] space-y-3 overflow-y-auto pr-1">{platformMetrics.length===0?<p className="rounded-2xl border border-amber-300/20 bg-amber-300/5 p-4 text-sm text-amber-100">O ADM ainda não cadastrou as métricas desta plataforma.</p>:platformMetrics.map(metric=>{const item=extracted.find(e=>e.indicator_id===metric.id);return <div key={metric.id} className="rounded-2xl border border-white/10 bg-white/[0.025] p-3"><div className="flex items-center justify-between gap-3"><div><p className="font-bold">{metric.name}</p><p className="mt-1 text-[11px] text-white/35">{item?.raw_text||'Aguardando extração'}</p></div>{item&&<span className={`rounded-full px-2 py-1 text-[10px] font-black ${item.found?'bg-emerald-400/15 text-emerald-300':'bg-white/8 text-white/35'}`}>{item.found?`${Math.round(item.confidence*100)}% confiança`:'não encontrado'}</span>}</div><div className="mt-3 flex items-center gap-2"><Input value={reviewValues[metric.id]??''} onChange={e=>setReviewValues(v=>({...v,[metric.id]:e.target.value}))} placeholder="Valor" className="border-white/10 bg-black/30 text-lg font-black"/><span className="min-w-14 text-xs text-white/45">{metric.unit}</span></div></div>})}</div>{warnings.length>0&&<div className="mt-3 rounded-xl border border-amber-300/15 bg-amber-300/5 p-3 text-xs text-amber-100">{warnings.join(' • ')}</div>}<Button onClick={confirmExtraction} disabled={!Object.values(reviewValues).some(Boolean)||confirming} className="mt-4 w-full bg-emerald-400 text-black hover:bg-emerald-300">{confirming?<Loader2 className="mr-2 h-4 w-4 animate-spin"/>:<Check className="mr-2 h-4 w-4"/>}Confirmar e salvar histórico</Button></Card>
      </section>

      <Card className="border-white/10 bg-black/30 p-5 text-white backdrop-blur-xl"><div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"><div><p className="text-xs uppercase tracking-[0.18em] text-white/40">3. Documento / apresentação</p><h2 className="mt-1 text-xl font-black">Canvas de {platform.name}</h2><p className="mt-1 text-xs text-white/40">Arraste os blocos para montar a página. O layout fica salvo no relatório do dia.</p></div><div className="flex flex-wrap items-center gap-2"><select value={selectedMetric} onChange={e=>setSelectedMetric(e.target.value)} className="h-9 rounded-lg border border-white/10 bg-[#07131f] px-3 text-xs text-white"><option value="">Escolher métrica</option>{platformMetrics.map(m=><option key={m.id} value={m.id}>{m.name}</option>)}</select><Button size="sm" variant="outline" onClick={()=>void addBlock('kpi')} className="border-white/10 bg-white/5 text-white"><Plus className="mr-1 h-3 w-3"/>Métrica</Button><Button size="sm" variant="outline" onClick={()=>void addBlock('chart')} className="border-white/10 bg-white/5 text-white"><BarChart3 className="mr-1 h-3 w-3"/>Gráfico</Button><Button size="sm" variant="outline" onClick={()=>void addBlock('image')} className="border-white/10 bg-white/5 text-white"><FileImage className="mr-1 h-3 w-3"/>Print</Button><Button size="sm" variant="outline" onClick={()=>void addBlock('text')} className="border-white/10 bg-white/5 text-white"><Type className="mr-1 h-3 w-3"/>Texto</Button></div></div>
        {!report?<div className="mt-5 flex min-h-52 items-center justify-center rounded-2xl border border-dashed border-white/15 text-center text-sm text-white/35"><div><Presentation className="mx-auto mb-3 h-7 w-7"/><p>Confirme os dados extraídos para liberar o canvas da apresentação.</p></div></div>:<div ref={canvasRef} onPointerMove={moveDrag} onPointerUp={()=>void endDrag()} onPointerCancel={()=>void endDrag()} className="relative mt-5 aspect-video w-full overflow-hidden rounded-[24px] border border-white/10 bg-[radial-gradient(circle_at_20%_20%,rgba(16,185,129,.12),transparent_26%),linear-gradient(145deg,#06111b,#02070d)] shadow-2xl"><div className="pointer-events-none absolute inset-0 opacity-20" style={{backgroundImage:'linear-gradient(rgba(255,255,255,.08) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.08) 1px,transparent 1px)',backgroundSize:'32px 32px'}}/>{blocks.length===0&&<div className="absolute inset-0 flex items-center justify-center text-sm text-white/25">Adicione blocos acima para começar a montar sua apresentação.</div>}{blocks.map(block=><div key={block.id} style={{left:`${block.x}%`,top:`${block.y}%`,width:`${block.width}%`,height:`${block.height}%`,zIndex:block.z_index}} className="absolute rounded-2xl border border-white/10 bg-black/35 p-1 shadow-[0_18px_50px_rgba(0,0,0,.35)] backdrop-blur-xl"><div onPointerDown={e=>beginDrag(e,block.id)} className="flex h-7 cursor-grab items-center justify-between px-2 text-[10px] uppercase tracking-[0.14em] text-white/35 active:cursor-grabbing"><span className="flex items-center gap-1"><Grip className="h-3 w-3"/>arrastar</span><button onPointerDown={e=>e.stopPropagation()} onClick={()=>void deleteBlock(block.id)}><Trash2 className="h-3 w-3 text-rose-300/70"/></button></div><div className="h-[calc(100%-28px)] overflow-hidden">{renderBlock(block)}</div></div>)}</div>}
      </Card>
    </>}
  </div>;
}
