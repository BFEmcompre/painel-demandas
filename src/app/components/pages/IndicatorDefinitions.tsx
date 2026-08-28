import { FormEvent, useEffect, useState } from 'react';
import { Plus, Settings2, Trash2 } from 'lucide-react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { supabase } from '../../lib/supabase';

type Platform={id:string;name:string};
type Definition={id:string;platform_id:string;name:string;unit:string;direction:string;target_value:number|null;weekly_aggregation:string;display_order:number};

export function IndicatorDefinitions(){
  const [platforms,setPlatforms]=useState<Platform[]>([]);
  const [definitions,setDefinitions]=useState<Definition[]>([]);
  const [platformId,setPlatformId]=useState('');
  const [name,setName]=useState('');
  const [unit,setUnit]=useState('%');
  const [direction,setDirection]=useState('higher');
  const [target,setTarget]=useState('');
  const [aggregation,setAggregation]=useState('last');
  const [order,setOrder]=useState('0');

  useEffect(()=>{void load()},[]);
  async function load(){
    const [{data:p},{data:d}]=await Promise.all([
      supabase.from('platforms').select('id,name').eq('active',true).order('display_order'),
      supabase.from('indicator_definitions').select('id,platform_id,name,unit,direction,target_value,weekly_aggregation,display_order').order('platform_id').order('display_order')
    ]);
    const ps=(p||[]) as Platform[];setPlatforms(ps);setDefinitions((d||[]) as Definition[]);if(!platformId&&ps[0])setPlatformId(ps[0].id);
  }

  async function create(e:FormEvent){
    e.preventDefault(); if(!platformId||!name.trim())return;
    const {data:auth}=await supabase.auth.getUser();
    await supabase.from('indicator_definitions').insert({platform_id:platformId,name:name.trim(),unit,direction,target_value:target.trim()===''?null:Number(target.replace(',','.')),weekly_aggregation:aggregation,display_order:Number(order||0),created_by:auth.user?.id||null,active:true});
    setName('');setTarget('');setOrder('0');await load();
  }

  async function remove(id:string){if(!confirm('Arquivar este KPI? O histórico será preservado.'))return;await supabase.from('indicator_definitions').update({active:false}).eq('id',id);await load();}
  const visible=definitions.filter((d)=>d.platform_id===platformId);

  return <div className="space-y-6">
    <section className="rounded-[28px] border border-white/10 bg-black/35 p-6 text-white backdrop-blur-xl lg:p-8"><div className="flex items-center gap-3"><div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-3"><Settings2 className="h-5 w-5 text-emerald-300"/></div><div><p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-300/75">Configuração</p><h1 className="text-3xl font-black">KPIs e regras de comparação</h1></div></div><p className="mt-3 max-w-3xl text-sm text-white/55">Defina o que será medido, a unidade, a direção desejada, a meta e como o FLOW deve consolidar o valor no Weekly Review.</p></section>
    <Card className="border-white/10 bg-black/30 p-5 text-white backdrop-blur-xl"><form onSubmit={create} className="grid gap-4 md:grid-cols-2 xl:grid-cols-7"><div className="xl:col-span-2"><Label>Plataforma</Label><select value={platformId} onChange={(e)=>setPlatformId(e.target.value)} className="mt-2 h-10 w-full rounded-md border border-white/10 bg-black/30 px-3 text-sm">{platforms.map((p)=><option key={p.id} value={p.id}>{p.name}</option>)}</select></div><div className="xl:col-span-2"><Label>Nome do KPI</Label><Input value={name} onChange={(e)=>setName(e.target.value)} placeholder="Ex.: Taxa de reclamações" className="mt-2 border-white/10 bg-black/30"/></div><div><Label>Unidade</Label><select value={unit} onChange={(e)=>setUnit(e.target.value)} className="mt-2 h-10 w-full rounded-md border border-white/10 bg-black/30 px-3 text-sm"><option>%</option><option>R$</option><option value="number">Número</option><option>p.p.</option><option>h</option><option>nota</option></select></div><div><Label>Ordem</Label><Input type="number" value={order} onChange={(e)=>setOrder(e.target.value)} className="mt-2 border-white/10 bg-black/30"/></div><div className="flex items-end"><Button className="w-full bg-emerald-400 text-black hover:bg-emerald-300"><Plus className="mr-2 h-4 w-4"/>Criar KPI</Button></div><div className="xl:col-span-2"><Label>Direção</Label><select value={direction} onChange={(e)=>setDirection(e.target.value)} className="mt-2 h-10 w-full rounded-md border border-white/10 bg-black/30 px-3 text-sm"><option value="higher">Maior é melhor</option><option value="lower">Menor é melhor</option><option value="target">Próximo da meta</option></select></div><div className="xl:col-span-2"><Label>Meta</Label><Input value={target} onChange={(e)=>setTarget(e.target.value)} placeholder="Opcional" className="mt-2 border-white/10 bg-black/30"/></div><div className="xl:col-span-3"><Label>Consolidação semanal</Label><select value={aggregation} onChange={(e)=>setAggregation(e.target.value)} className="mt-2 h-10 w-full rounded-md border border-white/10 bg-black/30 px-3 text-sm"><option value="last">Último valor da semana</option><option value="avg">Média</option><option value="sum">Soma</option><option value="min">Menor valor</option><option value="max">Maior valor</option></select></div></form></Card>
    <Card className="border-white/10 bg-black/30 text-white backdrop-blur-xl"><div className="border-b border-white/10 p-5"><h2 className="font-bold">KPIs cadastrados</h2></div><div className="divide-y divide-white/10">{visible.length===0?<p className="p-6 text-sm text-white/40">Nenhum KPI estruturado nessa plataforma.</p>:visible.map((d)=><div key={d.id} className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between"><div><div className="flex items-center gap-2"><span className="rounded-full border border-white/10 px-2 py-1 text-[10px] text-white/45">#{d.display_order}</span><p className="font-bold">{d.name}</p></div><p className="mt-1 text-xs text-white/40">{d.unit} • {d.direction==='higher'?'maior é melhor':d.direction==='lower'?'menor é melhor':'meta ideal'} • semanal: {d.weekly_aggregation}{d.target_value!==null?` • meta ${d.target_value}`:''}</p></div><Button variant="outline" onClick={()=>remove(d.id)} className="border-rose-400/20 bg-rose-400/5 text-rose-200 hover:bg-rose-400/10"><Trash2 className="mr-2 h-4 w-4"/>Arquivar</Button></div>)}</div></Card>
  </div>;
}
