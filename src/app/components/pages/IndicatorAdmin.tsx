import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Clock3, Layers3, Plus, Settings2, Trash2, UserRound } from 'lucide-react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { supabase } from '../../lib/supabase';

type Responsible = { id:string; name:string };
type Platform = { id:string; name:string; responsible_id:string; responsible_name:string; display_order:number; upload_deadline:string; active:boolean };
type Metric = { id:string; platform_id:string; name:string; unit:string; direction:string; target_value:number|null; weekly_aggregation:string; display_order:number; aliases:string[]; extraction_hint:string|null; active:boolean };

const inputClass='mt-2 border-white/10 bg-black/30 text-white';
const selectClass='mt-2 h-10 w-full rounded-md border border-white/10 bg-[#07131f] px-3 text-sm text-white';

export function IndicatorAdmin(){
  const [responsibles,setResponsibles]=useState<Responsible[]>([]);
  const [platforms,setPlatforms]=useState<Platform[]>([]);
  const [metrics,setMetrics]=useState<Metric[]>([]);
  const [selectedPlatform,setSelectedPlatform]=useState('');

  const [platformName,setPlatformName]=useState('');
  const [responsibleId,setResponsibleId]=useState('');
  const [platformOrder,setPlatformOrder]=useState('0');
  const [deadline,setDeadline]=useState('09:00');

  const [metricName,setMetricName]=useState('');
  const [unit,setUnit]=useState('%');
  const [direction,setDirection]=useState('higher');
  const [target,setTarget]=useState('');
  const [aggregation,setAggregation]=useState('last');
  const [metricOrder,setMetricOrder]=useState('0');
  const [aliases,setAliases]=useState('');
  const [hint,setHint]=useState('');

  useEffect(()=>{void load()},[]);

  async function load(){
    const [{data:r},{data:p},{data:m}]=await Promise.all([
      supabase.from('profiles').select('id,name').in('role',['responsible','manager','gestor','admin']).order('name'),
      supabase.from('platforms').select('id,name,responsible_id,responsible_name,display_order,upload_deadline,active').order('display_order'),
      supabase.from('indicator_definitions').select('id,platform_id,name,unit,direction,target_value,weekly_aggregation,display_order,aliases,extraction_hint,active').order('display_order'),
    ]);
    const ps=(p||[]) as Platform[];
    setResponsibles((r||[]) as Responsible[]); setPlatforms(ps); setMetrics((m||[]) as Metric[]);
    if(!selectedPlatform&&ps[0]) setSelectedPlatform(ps[0].id);
  }

  async function createPlatform(e:FormEvent){
    e.preventDefault();
    const responsible=responsibles.find(r=>r.id===responsibleId);
    if(!platformName.trim()||!responsible) return;
    const {data,error}=await supabase.from('platforms').insert({
      name:platformName.trim(), responsible_id:responsible.id, responsible_name:responsible.name,
      display_order:Number(platformOrder||0), upload_deadline:deadline, active:true,
    }).select('id').single();
    if(error){alert(error.message);return;}
    setPlatformName('');setResponsibleId('');setPlatformOrder('0');
    if(data?.id)setSelectedPlatform(data.id); await load();
  }

  async function updatePlatform(platform:Platform){
    const name=prompt('Nome da plataforma',platform.name); if(!name)return;
    const order=prompt('Ordem na apresentação',String(platform.display_order)); if(order===null)return;
    const deadlineValue=prompt('Horário limite (HH:MM)',String(platform.upload_deadline).slice(0,5)); if(!deadlineValue)return;
    const responsibleName=prompt('Nome exato do responsável',platform.responsible_name); if(!responsibleName)return;
    const responsible=responsibles.find(r=>r.name.toLowerCase()===responsibleName.trim().toLowerCase());
    if(!responsible){alert('Responsável não encontrado.');return;}
    const {error}=await supabase.from('platforms').update({name:name.trim(),display_order:Number(order||0),upload_deadline:deadlineValue,responsible_id:responsible.id,responsible_name:responsible.name}).eq('id',platform.id);
    if(error)alert(error.message); else await load();
  }

  async function togglePlatform(platform:Platform){
    await supabase.from('platforms').update({active:!platform.active}).eq('id',platform.id); await load();
  }

  async function createMetric(e:FormEvent){
    e.preventDefault(); if(!selectedPlatform||!metricName.trim())return;
    const {data:auth}=await supabase.auth.getUser();
    const parsedTarget=target.trim()===''?null:Number(target.replace(',','.'));
    const {error}=await supabase.from('indicator_definitions').insert({
      platform_id:selectedPlatform,name:metricName.trim(),unit,direction,
      target_value:Number.isNaN(parsedTarget as number)?null:parsedTarget,
      weekly_aggregation:aggregation,display_order:Number(metricOrder||0),
      aliases:aliases.split(',').map(v=>v.trim()).filter(Boolean),extraction_hint:hint.trim()||null,
      created_by:auth.user?.id||null,active:true,
    });
    if(error){alert(error.message);return;}
    setMetricName('');setTarget('');setMetricOrder('0');setAliases('');setHint('');await load();
  }

  async function editMetric(metric:Metric){
    const name=prompt('Nome da métrica',metric.name); if(!name)return;
    const targetValue=prompt('Meta (vazio = sem meta)',metric.target_value===null?'':String(metric.target_value)); if(targetValue===null)return;
    const aliasesValue=prompt('Outros nomes que podem aparecer no print, separados por vírgula',(metric.aliases||[]).join(', ')); if(aliasesValue===null)return;
    const {error}=await supabase.from('indicator_definitions').update({name:name.trim(),target_value:targetValue.trim()===''?null:Number(targetValue.replace(',','.')),aliases:aliasesValue.split(',').map(v=>v.trim()).filter(Boolean)}).eq('id',metric.id);
    if(error)alert(error.message); else await load();
  }

  async function archiveMetric(metric:Metric){
    if(!confirm(`Arquivar a métrica “${metric.name}”? O histórico será mantido.`))return;
    await supabase.from('indicator_definitions').update({active:false}).eq('id',metric.id);await load();
  }

  const current=platforms.find(p=>p.id===selectedPlatform);
  const visibleMetrics=useMemo(()=>metrics.filter(m=>m.platform_id===selectedPlatform&&m.active),[metrics,selectedPlatform]);

  return <div className="space-y-6 text-white">
    <section className="rounded-[28px] border border-white/10 bg-black/35 p-6 backdrop-blur-xl lg:p-8">
      <div className="flex items-center gap-3"><div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-3"><Settings2 className="h-5 w-5 text-emerald-300"/></div><div><p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-300/75">Administração</p><h1 className="text-3xl font-black">Plataformas e métricas</h1></div></div>
      <p className="mt-3 max-w-4xl text-sm text-white/55">Aqui o ADM define quem apresenta cada plataforma, a ordem da reunião, o horário limite de envio e quais métricas o FLOW deve procurar nos prints.</p>
    </section>

    <Card className="border-white/10 bg-black/30 p-5 text-white backdrop-blur-xl">
      <div className="mb-4 flex items-center gap-2"><Layers3 className="h-5 w-5 text-emerald-300"/><h2 className="font-black">1. Plataformas</h2></div>
      <form onSubmit={createPlatform} className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <div><Label>Plataforma</Label><Input className={inputClass} value={platformName} onChange={e=>setPlatformName(e.target.value)} placeholder="Ex.: Mercado Livre"/></div>
        <div><Label>Responsável</Label><select className={selectClass} value={responsibleId} onChange={e=>setResponsibleId(e.target.value)}><option value="">Selecionar</option>{responsibles.map(r=><option key={r.id} value={r.id}>{r.name}</option>)}</select></div>
        <div><Label>Ordem da apresentação</Label><Input className={inputClass} type="number" value={platformOrder} onChange={e=>setPlatformOrder(e.target.value)}/></div>
        <div><Label>Enviar até</Label><Input className={inputClass} type="time" value={deadline} onChange={e=>setDeadline(e.target.value)}/></div>
        <div className="flex items-end"><Button className="w-full bg-emerald-400 text-black hover:bg-emerald-300"><Plus className="mr-2 h-4 w-4"/>Criar plataforma</Button></div>
      </form>
      <div className="mt-5 grid gap-3 xl:grid-cols-2">{platforms.map(p=><button key={p.id} type="button" onClick={()=>setSelectedPlatform(p.id)} className={`rounded-2xl border p-4 text-left transition ${selectedPlatform===p.id?'border-emerald-400/50 bg-emerald-400/10':'border-white/10 bg-white/[0.025] hover:bg-white/[0.05]'} ${!p.active?'opacity-45':''}`}><div className="flex items-start justify-between gap-4"><div><p className="text-xs uppercase tracking-[0.18em] text-white/40">#{p.display_order}</p><h3 className="mt-1 text-lg font-black">{p.name}</h3><div className="mt-2 flex flex-wrap gap-3 text-xs text-white/50"><span><UserRound className="mr-1 inline h-3 w-3"/>{p.responsible_name}</span><span><Clock3 className="mr-1 inline h-3 w-3"/>{String(p.upload_deadline).slice(0,5)}</span></div></div><span className={`rounded-full px-2 py-1 text-[10px] font-bold ${p.active?'bg-emerald-400/15 text-emerald-300':'bg-white/10 text-white/40'}`}>{p.active?'ATIVA':'ARQUIVADA'}</span></div><div className="mt-3 flex gap-2"><Button type="button" size="sm" variant="outline" onClick={e=>{e.stopPropagation();void updatePlatform(p)}} className="border-white/10 bg-white/5 text-white">Editar</Button><Button type="button" size="sm" variant="outline" onClick={e=>{e.stopPropagation();void togglePlatform(p)}} className="border-white/10 bg-white/5 text-white">{p.active?'Arquivar':'Reativar'}</Button></div></button>)}</div>
    </Card>

    <Card className="border-white/10 bg-black/30 p-5 text-white backdrop-blur-xl">
      <div className="mb-1 flex items-center gap-2"><Settings2 className="h-5 w-5 text-emerald-300"/><h2 className="font-black">2. Métricas de {current?.name||'uma plataforma'}</h2></div>
      <p className="mb-5 text-sm text-white/45">Cadastre todas as métricas que aparecem nos prints. Uma plataforma pode ter quantas métricas forem necessárias.</p>
      {!selectedPlatform?<p className="text-white/50">Crie ou selecione uma plataforma primeiro.</p>:<>
        <form onSubmit={createMetric} className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div><Label>Nome da métrica</Label><Input className={inputClass} value={metricName} onChange={e=>setMetricName(e.target.value)} placeholder="Ex.: Reclamações"/></div>
          <div><Label>Unidade</Label><select className={selectClass} value={unit} onChange={e=>setUnit(e.target.value)}><option value="%">%</option><option value="number">Número</option><option value="nota">Nota</option><option value="p.p.">p.p.</option><option value="R$">R$</option><option value="dias">Dias</option><option value="pontos">Pontos</option></select></div>
          <div><Label>Meta</Label><Input className={inputClass} value={target} onChange={e=>setTarget(e.target.value)} placeholder="Opcional"/></div>
          <div><Label>Ordem</Label><Input className={inputClass} type="number" value={metricOrder} onChange={e=>setMetricOrder(e.target.value)}/></div>
          <div><Label>Quando melhora?</Label><select className={selectClass} value={direction} onChange={e=>setDirection(e.target.value)}><option value="higher">Quando aumenta</option><option value="lower">Quando diminui</option><option value="target">Quando se aproxima da meta</option></select></div>
          <div><Label>Como calcular na semana?</Label><select className={selectClass} value={aggregation} onChange={e=>setAggregation(e.target.value)}><option value="last">Usar último valor</option><option value="avg">Calcular média</option><option value="sum">Somar os dias</option><option value="min">Usar menor valor</option><option value="max">Usar maior valor</option></select></div>
          <div><Label>Outros nomes no print</Label><Input className={inputClass} value={aliases} onChange={e=>setAliases(e.target.value)} placeholder="Ex.: Reclamação, claims"/></div>
          <div><Label>Dica para extração</Label><Input className={inputClass} value={hint} onChange={e=>setHint(e.target.value)} placeholder="Ex.: usar o percentual grande do card"/></div>
          <div className="md:col-span-2 xl:col-span-4"><Button className="bg-emerald-400 text-black hover:bg-emerald-300"><Plus className="mr-2 h-4 w-4"/>Adicionar métrica</Button></div>
        </form>
        <div className="mt-6 overflow-hidden rounded-2xl border border-white/10"><div className="grid grid-cols-[50px_1fr_110px_130px_120px] gap-3 border-b border-white/10 bg-white/[0.04] px-4 py-3 text-[11px] font-bold uppercase tracking-[0.12em] text-white/40"><span>Ordem</span><span>Métrica</span><span>Unidade</span><span>Meta</span><span>Ações</span></div>{visibleMetrics.length===0?<p className="p-6 text-sm text-white/40">Nenhuma métrica cadastrada para essa plataforma.</p>:visibleMetrics.map(m=><div key={m.id} className="grid grid-cols-[50px_1fr_110px_130px_120px] items-center gap-3 border-b border-white/5 px-4 py-3 text-sm last:border-0"><span className="text-white/45">{m.display_order}</span><div><p className="font-bold">{m.name}</p>{m.aliases?.length>0&&<p className="mt-1 text-[11px] text-white/35">Também procura: {m.aliases.join(', ')}</p>}</div><span>{m.unit}</span><span>{m.target_value??'—'}</span><div className="flex gap-1"><Button size="sm" variant="outline" onClick={()=>void editMetric(m)} className="border-white/10 bg-white/5 text-white">Editar</Button><Button size="icon" variant="outline" onClick={()=>void archiveMetric(m)} className="border-rose-400/20 bg-rose-400/5 text-rose-300"><Trash2 className="h-4 w-4"/></Button></div></div>)}</div>
      </>}
    </Card>
  </div>;
}
