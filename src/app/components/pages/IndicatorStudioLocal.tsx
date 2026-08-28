import { ChangeEvent, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Check, ImagePlus, Loader2, Presentation, ScanText, Send, UploadCloud } from 'lucide-react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { supabase } from '../../lib/supabase';
import { extractIndicatorsLocally, normalizeMetricKey, type OcrProgress } from '../../lib/indicatorOcr';

type Platform={id:string;name:string;responsible_id:string;responsible_name:string;display_order:number;upload_deadline:string};
type Metric={id:string;platform_id:string;name:string;unit:string;source_section:string|null;display_order:number;metric_key?:string|null};
type Measurement={indicator_id:string;reference_date:string;value:number};
type Submission={id:string;platform_id:string;reference_date:string;status:string;is_late:boolean;upload_completed_at:string|null;sent_at:string|null;confirmed_at:string|null};
type SubmissionImage={id:string;submission_id:string;image_url:string;storage_path:string|null;original_name:string|null;display_order:number};
type Extracted={indicator_id:string;name:string;section:string|null;unit:string;found:boolean;value:number|null;confidence:number;raw_text:string};
type Report={id:string};

const today=()=>new Date().toLocaleDateString('sv-SE',{timeZone:'America/Sao_Paulo'});
function formatValue(value:number|null|undefined,unit:string){if(value===null||value===undefined)return '—';if(unit==='%')return `${Number(value).toLocaleString('pt-BR')}%`;if(unit==='R$')return Number(value).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});if(unit==='nota')return Number(value).toLocaleString('pt-BR',{maximumFractionDigits:2});return `${Number(value).toLocaleString('pt-BR')}${unit==='dias'?' dias':unit==='pontos'?' pontos':''}`;}

export function IndicatorStudioLocal(){
  const navigate=useNavigate();
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
  const [sending,setSending]=useState(false);
  const [ocrProgress,setOcrProgress]=useState<OcrProgress|null>(null);
  const date=today();

  const platformId=params.get('platform')||'';
  const platform=platforms.find(p=>p.id===platformId);
  const platformMetrics=useMemo(()=>metrics.filter(m=>m.platform_id===platformId).sort((a,b)=>a.display_order-b.display_order),[metrics,platformId]);
  const wasSent=submission?.status==='sent'&&!!submission.sent_at;

  useEffect(()=>{void bootstrap()},[]);
  useEffect(()=>{if(platformId)void loadDay(platformId)},[platformId]);

  async function bootstrap(){
    const {data:auth}=await supabase.auth.getUser();if(!auth.user)return;
    const {data:profile}=await supabase.from('profiles').select('role').eq('id',auth.user.id).single();
    const isAdmin=['manager','admin','gestor'].includes(String(profile?.role||'').toLowerCase());
    let query=supabase.from('platforms').select('id,name,responsible_id,responsible_name,display_order,upload_deadline').eq('active',true).order('display_order');
    if(!isAdmin)query=query.eq('responsible_id',auth.user.id);
    const [{data:p},{data:m},{data:h}]=await Promise.all([
      query,
      supabase.from('indicator_definitions').select('id,platform_id,name,unit,source_section,display_order,metric_key').eq('active',true).order('display_order'),
      supabase.from('indicator_measurements').select('indicator_id,reference_date,value').order('reference_date',{ascending:true}).limit(5000),
    ]);
    const ps=(p||[]) as Platform[];setPlatforms(ps);setMetrics((m||[]) as Metric[]);setMeasurements((h||[]) as Measurement[]);
    if(!params.get('platform')&&ps[0])setParams({platform:ps[0].id},{replace:true});
  }

  async function reloadMetricsAndHistory(){
    const [{data:m},{data:h}]=await Promise.all([
      supabase.from('indicator_definitions').select('id,platform_id,name,unit,source_section,display_order,metric_key').eq('active',true).order('display_order'),
      supabase.from('indicator_measurements').select('indicator_id,reference_date,value').order('reference_date',{ascending:true}).limit(5000),
    ]);
    setMetrics((m||[]) as Metric[]);setMeasurements((h||[]) as Measurement[]);
    return (m||[]) as Metric[];
  }

  async function loadDay(pid:string){
    setExtracted([]);setReviewValues({});setWarnings([]);setOcrProgress(null);
    const {data:s}=await supabase.from('indicator_submissions').select('id,platform_id,reference_date,status,is_late,upload_completed_at,sent_at,confirmed_at').eq('platform_id',pid).eq('reference_date',date).maybeSingle();
    setSubmission((s||null) as Submission|null);
    if(s){const {data:i}=await supabase.from('indicator_submission_images').select('*').eq('submission_id',s.id).order('display_order');setImages((i||[]) as SubmissionImage[]);}else setImages([]);
  }

  async function ensureSubmission(){
    if(!platform)return null;if(submission)return submission;
    const {data,error}=await supabase.from('indicator_submissions').upsert({platform_id:platform.id,responsible_id:platform.responsible_id,reference_date:date,status:'draft'},{onConflict:'platform_id,reference_date'}).select('id,platform_id,reference_date,status,is_late,upload_completed_at,sent_at,confirmed_at').single();
    if(error){alert(error.message);return null;}setSubmission(data as Submission);return data as Submission;
  }

  async function uploadPrints(e:ChangeEvent<HTMLInputElement>){
    const files=Array.from(e.target.files||[]);if(!files.length||!platform)return;setUploading(true);
    const s=await ensureSubmission();if(!s){setUploading(false);return;}
    const {data:auth}=await supabase.auth.getUser();const uid=auth.user?.id||'unknown';const rows:any[]=[];
    for(let index=0;index<files.length;index++){
      const file=files[index];const safe=file.name.replace(/[^a-zA-Z0-9._-]/g,'_');const path=`${uid}/${platform.id}/${date}/${Date.now()}-${index}-${safe}`;
      const {error}=await supabase.storage.from('platform-indicators').upload(path,file);if(error){alert(error.message);continue;}
      const {data:url}=supabase.storage.from('platform-indicators').getPublicUrl(path);
      rows.push({submission_id:s.id,image_url:url.publicUrl,storage_path:path,original_name:file.name,display_order:images.length+index});
    }
    if(rows.length){await supabase.from('indicator_submission_images').insert(rows);await supabase.from('indicator_submissions').update({status:'uploaded',upload_completed_at:new Date().toISOString(),sent_at:null,is_late:false,confirmed_at:null}).eq('id',s.id);}
    setUploading(false);e.target.value='';await loadDay(platform.id);
  }

  async function resolveMetric(candidate:{key:string;name:string;section:string|null;unit:string}, order:number){
    if(!platform)return null;
    const current=metrics.filter(m=>m.platform_id===platform.id);
    const exact=current.find(m=>(m.metric_key||normalizeMetricKey(m.name))===candidate.key);
    if(exact)return exact;

    const {data:existing}=await supabase.from('indicator_definitions').select('id,platform_id,name,unit,source_section,display_order,metric_key').eq('platform_id',platform.id).eq('metric_key',candidate.key).maybeSingle();
    if(existing)return existing as Metric;

    const {data:auth}=await supabase.auth.getUser();
    const {data,error}=await supabase.from('indicator_definitions').insert({
      platform_id:platform.id,
      name:candidate.name,
      unit:candidate.unit,
      direction:'neutral',
      weekly_aggregation:'last',
      display_order:order,
      active:true,
      aliases:[],
      extraction_hint:null,
      metric_key:candidate.key,
      source_section:candidate.section,
      auto_discovered:true,
      created_by:auth.user?.id||null,
    }).select('id,platform_id,name,unit,source_section,display_order,metric_key').single();
    if(error)throw error;
    return data as Metric;
  }

  async function extractData(){
    if(!submission||!images.length||!platform)return;
    setExtracting(true);setWarnings([]);setExtracted([]);setReviewValues({});setOcrProgress({imageIndex:1,imageCount:images.length,progress:0,status:'Carregando OCR local'});
    try{
      await supabase.from('indicator_submissions').update({status:'extracting'}).eq('id',submission.id);
      const local=await extractIndicatorsLocally(images.map(i=>({id:i.id,image_url:i.image_url,original_name:i.original_name})),setOcrProgress);
      const result:Extracted[]=[];
      for(let index=0;index<local.metrics.length;index++){
        const candidate=local.metrics[index];
        const metric=await resolveMetric(candidate,platformMetrics.length+index);
        if(!metric)continue;
        result.push({indicator_id:metric.id,name:metric.name||candidate.name,section:metric.source_section||candidate.section,unit:metric.unit||candidate.unit,found:true,value:candidate.value,confidence:candidate.confidence,raw_text:candidate.raw_text});
      }
      for(const imageResult of local.imageResults){
        await supabase.from('indicator_submission_images').update({extraction_status:'processed',extraction_json:{engine:'tesseract-browser',text:imageResult.text.slice(0,12000),metric_count:imageResult.metrics.length}}).eq('id',imageResult.image_id);
      }
      await supabase.from('indicator_submissions').update({status:'extracted',extracted_at:new Date().toISOString(),extraction_warnings:local.warnings}).eq('id',submission.id);
      setExtracted(result);setWarnings(local.warnings);
      const next:Record<string,string>={};result.forEach(item=>{if(item.value!==null)next[item.indicator_id]=String(item.value)});setReviewValues(next);
      await reloadMetricsAndHistory();
      if(!result.length)setWarnings(prev=>[...prev,'Nenhum indicador foi identificado automaticamente. Tente prints mais nítidos ou recortados próximos dos cards.']);
    }catch(error:any){
      console.error('Falha no OCR local:',error);
      alert(`Falha ao ler os prints localmente: ${error?.message||String(error)}`);
      await supabase.from('indicator_submissions').update({status:'error'}).eq('id',submission.id);
    }finally{setExtracting(false);setOcrProgress(null);}
  }

  async function confirmExtraction(){
    if(!submission||!platform)return;setConfirming(true);const {data:auth}=await supabase.auth.getUser();
    const rows=extracted.flatMap(item=>{const raw=reviewValues[item.indicator_id]?.trim();if(!raw)return[];const value=Number(raw.replace(',','.'));if(Number.isNaN(value))return[];return[{indicator_id:item.indicator_id,reference_date:date,value,source_type:'image',submission_id:submission.id,confidence:item.confidence,raw_text:item.raw_text,source_metadata:{engine:'tesseract-browser',images:images.map(i=>i.id)},created_by:auth.user?.id||null}]});
    if(!rows.length){alert('Nenhum valor válido para confirmar.');setConfirming(false);return;}
    const {error}=await supabase.from('indicator_measurements').upsert(rows,{onConflict:'indicator_id,reference_date'});if(error){alert(error.message);setConfirming(false);return;}
    await supabase.from('indicator_submissions').update({status:'confirmed',confirmed_at:new Date().toISOString(),sent_at:null,is_late:false}).eq('id',submission.id);
    const {data:r,error:rError}=await supabase.from('indicator_reports').upsert({platform_id:platform.id,responsible_id:platform.responsible_id,report_type:'daily',reference_date:date,title:`${platform.name} • ${date}`,status:'ready'},{onConflict:'platform_id,report_type,reference_date'}).select('id').single();
    if(rError){alert(rError.message);setConfirming(false);return;}
    await createDefaultBlocks(r as Report,extracted,images);await reloadMetricsAndHistory();setConfirming(false);await loadDay(platform.id);
  }

  async function createDefaultBlocks(report:Report,items:Extracted[],pics:SubmissionImage[]){
    const {count}=await supabase.from('indicator_report_blocks').select('id',{count:'exact',head:true}).eq('report_id',report.id);if((count||0)>0)return;
    const blocks:any[]=[];let y=5;
    items.slice(0,8).forEach((item,index)=>{blocks.push({report_id:report.id,block_type:'kpi',title:item.name,content:{indicator_id:item.indicator_id},x:index%2===0?4:52,y,width:44,height:18,z_index:blocks.length+1,style:{}});if(index%2===1)y+=22});
    if(pics[0])blocks.push({report_id:report.id,block_type:'image',title:'Print original',content:{image_id:pics[0].id,image_url:pics[0].image_url},x:4,y:y+2,width:44,height:34,z_index:blocks.length+1,style:{}});
    if(items[0])blocks.push({report_id:report.id,block_type:'chart',title:`Evolução • ${items[0].name}`,content:{indicator_id:items[0].indicator_id,chart_type:'area'},x:52,y:y+2,width:44,height:34,z_index:blocks.length+1,style:{}});
    if(blocks.length)await supabase.from('indicator_report_blocks').insert(blocks);
  }

  async function sendPresentation(){
    if(!submission||!platform)return;if(!submission.confirmed_at){alert('Confirme os dados extraídos antes de enviar.');return;}if(wasSent){alert('A apresentação de hoje já foi enviada.');return;}
    setSending(true);const {error}=await supabase.from('indicator_submissions').update({status:'sent',sent_at:new Date().toISOString()}).eq('id',submission.id);if(error){alert(error.message);setSending(false);return;}
    await supabase.from('indicator_reports').update({status:'presented'}).eq('platform_id',platform.id).eq('report_type','daily').eq('reference_date',date);setSending(false);await loadDay(platform.id);
  }

  const previous=(id:string)=>[...measurements.filter(m=>m.indicator_id===id&&m.reference_date<date)].sort((a,b)=>b.reference_date.localeCompare(a.reference_date))[0];
  const current=(id:string)=>measurements.find(m=>m.indicator_id===id&&m.reference_date===date);
  const history=(id:string)=>measurements.filter(m=>m.indicator_id===id).sort((a,b)=>a.reference_date.localeCompare(b.reference_date)).slice(-10).map(m=>({date:m.reference_date.slice(5),value:Number(m.value)}));

  return <div className="space-y-6 text-white">
    <section className="rounded-[28px] border border-white/10 bg-black/35 p-6 backdrop-blur-xl lg:p-8">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between"><div><p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-300/75">Meu Studio</p><h1 className="mt-2 text-3xl font-black">Envie os prints. O FLOW lê no seu navegador.</h1><p className="mt-2 max-w-3xl text-sm text-white/55">A leitura agora é local e não usa OpenAI nem API paga. Anexar, extrair e confirmar continuam sendo preparação; só o botão Enviar apresentação registra o envio.</p></div><div className="flex flex-wrap gap-2"><select value={platformId} onChange={e=>setParams({platform:e.target.value})} className="h-10 rounded-xl border border-white/10 bg-[#07131f] px-4 text-sm">{platforms.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select><Button variant="outline" onClick={()=>navigate('/indicadores/apresentacao')} className="border-white/10 bg-white/5 text-white"><Presentation className="mr-2 h-4 w-4"/>Ver apresentação</Button></div></div>
      {platform&&<div className="mt-5 flex flex-wrap items-center gap-3 text-xs"><span className="text-white/45">Responsável: {platform.responsible_name}</span><span className="text-white/25">•</span><span className="text-white/45">Prazo: {String(platform.upload_deadline).slice(0,5)}</span><span className="text-white/25">•</span>{wasSent?<span className={`rounded-full px-3 py-1 font-black ${submission?.is_late?'bg-rose-400/10 text-rose-300':'bg-emerald-400/10 text-emerald-300'}`}>{submission?.is_late?'ENVIADO COM ATRASO':'ENVIADO NO PRAZO'}</span>:<span className="rounded-full bg-amber-300/10 px-3 py-1 font-black text-amber-200">AINDA NÃO ENVIADO</span>}</div>}
    </section>

    <Card className="border-white/10 bg-black/30 p-5 text-white"><div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"><div><h2 className="font-black">1. Prints do dia</h2><p className="mt-1 text-sm text-white/40">Anexe os prints da plataforma. Quanto mais nítidos e próximos dos indicadores, melhor a leitura.</p></div><div className="flex gap-2"><label className="cursor-pointer"><input type="file" multiple accept="image/png,image/jpeg,image/webp" className="hidden" onChange={uploadPrints}/><span className="inline-flex h-10 items-center rounded-md border border-white/10 bg-white/5 px-4 text-sm font-medium">{uploading?<Loader2 className="mr-2 h-4 w-4 animate-spin"/>:<UploadCloud className="mr-2 h-4 w-4"/>}Anexar prints</span></label><Button disabled={!submission||!images.length||extracting} onClick={extractData} className="bg-emerald-400 text-black hover:bg-emerald-300">{extracting?<Loader2 className="mr-2 h-4 w-4 animate-spin"/>:<ScanText className="mr-2 h-4 w-4"/>}{extracting?'Lendo prints...':'Extrair dados'}</Button></div></div>
      {ocrProgress&&<div className="mt-4 rounded-xl border border-cyan-300/15 bg-cyan-300/5 p-3"><div className="flex items-center justify-between text-xs text-cyan-100"><span>{ocrProgress.status} • imagem {ocrProgress.imageIndex}/{ocrProgress.imageCount}</span><span>{Math.round(ocrProgress.progress*100)}%</span></div><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full bg-cyan-300 transition-all" style={{width:`${Math.max(3,ocrProgress.progress*100)}%`}}/></div></div>}
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{images.map(image=><div key={image.id} className="overflow-hidden rounded-xl border border-white/10 bg-white/[.03]"><img src={image.image_url} className="h-32 w-full object-cover"/><div className="truncate p-2 text-xs text-white/45">{image.original_name||'Print'}</div></div>)}{images.length===0&&<div className="col-span-full rounded-xl border border-dashed border-white/10 p-8 text-center text-sm text-white/35"><ImagePlus className="mx-auto mb-2 h-6 w-6"/>Nenhum print anexado ainda.</div>}</div></Card>

    {extracted.length>0&&<Card className="border-white/10 bg-black/30 p-5 text-white"><div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"><div><h2 className="font-black">2. Conferir indicadores encontrados</h2><p className="mt-1 text-sm text-white/40">OCR não é infalível: confira os valores antes de confirmar.</p></div><Button disabled={confirming} onClick={confirmExtraction} className="bg-emerald-400 text-black hover:bg-emerald-300">{confirming?<Loader2 className="mr-2 h-4 w-4 animate-spin"/>:<Check className="mr-2 h-4 w-4"/>}Confirmar dados</Button></div>{warnings.length>0&&<div className="mt-4 rounded-xl border border-amber-300/20 bg-amber-300/5 p-3 text-xs text-amber-100">{warnings.join(' • ')}</div>}<div className="mt-4 overflow-hidden rounded-xl border border-white/10"><div className="grid grid-cols-[1fr_120px_100px_1.4fr] gap-3 bg-white/[.04] px-4 py-3 text-[10px] font-bold uppercase tracking-[.12em] text-white/35"><span>Indicador</span><span>Valor</span><span>Confiança</span><span>Trecho reconhecido</span></div>{extracted.map(item=><div key={item.indicator_id} className="grid grid-cols-[1fr_120px_100px_1.4fr] items-center gap-3 border-t border-white/5 px-4 py-3 text-sm"><div><p className="font-bold">{item.name}</p>{item.section&&<p className="text-[11px] text-white/35">{item.section}</p>}</div><Input value={reviewValues[item.indicator_id]||''} onChange={e=>setReviewValues(v=>({...v,[item.indicator_id]:e.target.value}))} className="border-white/10 bg-black/30"/><span className="text-xs text-white/45">{Math.round((item.confidence||0)*100)}%</span><span className="text-xs text-white/40">{item.raw_text||'—'}</span></div>)}</div></Card>}

    {submission?.confirmed_at&&<Card className="border-emerald-400/20 bg-emerald-400/[.05] p-5 text-white"><div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"><div><h2 className="font-black">3. Enviar apresentação</h2><p className="mt-1 text-sm text-white/50">Os dados foram conferidos. Só este botão efetiva o envio.</p></div><div className="flex gap-2"><Button variant="outline" onClick={()=>navigate('/indicadores/apresentacao')} className="border-white/10 bg-white/5 text-white"><Presentation className="mr-2 h-4 w-4"/>Pré-visualizar</Button><Button disabled={sending||wasSent} onClick={sendPresentation} className="bg-emerald-400 text-black hover:bg-emerald-300 disabled:opacity-50">{sending?<Loader2 className="mr-2 h-4 w-4 animate-spin"/>:<Send className="mr-2 h-4 w-4"/>}{wasSent?'Já enviado':'Enviar apresentação'}</Button></div></div></Card>}

    {platformMetrics.length>0&&<Card className="border-white/10 bg-black/30 p-5 text-white"><div className="mb-4"><h2 className="font-black">Histórico já reconhecido</h2><p className="mt-1 text-sm text-white/40">O FLOW reaproveita os indicadores reconhecidos e monta a evolução ao longo dos dias.</p></div><div className="grid gap-4 xl:grid-cols-2">{platformMetrics.slice(0,8).map(metric=>{const c=current(metric.id);const p=previous(metric.id);const delta=c&&p?Number(c.value)-Number(p.value):null;return <div key={metric.id} className="rounded-2xl border border-white/10 bg-white/[.025] p-4"><div className="flex items-start justify-between gap-3"><div><p className="text-xs text-white/40">{metric.source_section||'Indicador'}</p><h3 className="mt-1 font-black">{metric.name}</h3><p className="mt-2 text-2xl font-black">{formatValue(c?.value,metric.unit)}</p><p className="mt-1 text-xs text-white/40">{delta===null?'Sem comparação anterior':`${delta>=0?'+':''}${delta.toLocaleString('pt-BR')} vs. anterior`}</p></div><div className="h-28 w-40"><ResponsiveContainer width="100%" height="100%"><AreaChart data={history(metric.id)}><CartesianGrid strokeDasharray="3 3" opacity={.05}/><XAxis dataKey="date" hide/><YAxis hide/><Tooltip contentStyle={{background:'#06111b',border:'1px solid rgba(255,255,255,.12)',borderRadius:10}}/><Area type="monotone" dataKey="value" stroke="#5eead4" strokeWidth={2} fill="#10b981" fillOpacity={.1}/></AreaChart></ResponsiveContainer></div></div></div>})}</div></Card>}
  </div>;
}
