import { FormEvent, useEffect, useState } from 'react';
import { Clock3, Layers3, Plus, Settings2, UserRound } from 'lucide-react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { supabase } from '../../lib/supabase';

type Responsible={id:string;name:string};
type Platform={id:string;name:string;responsible_id:string;responsible_name:string;display_order:number;upload_deadline:string;active:boolean};

const inputClass='mt-2 border-white/10 bg-black/30 text-white';
const selectClass='mt-2 h-10 w-full rounded-md border border-white/10 bg-[#07131f] px-3 text-sm text-white';

export function IndicatorPlatformAdmin(){
  const [responsibles,setResponsibles]=useState<Responsible[]>([]);
  const [platforms,setPlatforms]=useState<Platform[]>([]);
  const [name,setName]=useState('');
  const [responsibleId,setResponsibleId]=useState('');
  const [order,setOrder]=useState('0');
  const [deadline,setDeadline]=useState('09:00');

  useEffect(()=>{void load()},[]);

  async function load(){
    const [{data:r},{data:p}]=await Promise.all([
      supabase.from('profiles').select('id,name').in('role',['responsible','manager','gestor','admin']).order('name'),
      supabase.from('platforms').select('id,name,responsible_id,responsible_name,display_order,upload_deadline,active').order('display_order'),
    ]);
    setResponsibles((r||[]) as Responsible[]);
    setPlatforms((p||[]) as Platform[]);
  }

  async function createPlatform(e:FormEvent){
    e.preventDefault();
    const responsible=responsibles.find(r=>r.id===responsibleId);
    if(!name.trim()||!responsible)return;
    const {error}=await supabase.from('platforms').insert({
      name:name.trim(),responsible_id:responsible.id,responsible_name:responsible.name,
      display_order:Number(order||0),upload_deadline:deadline,active:true,
    });
    if(error){alert(error.message);return;}
    setName('');setResponsibleId('');setOrder('0');setDeadline('09:00');await load();
  }

  async function editPlatform(platform:Platform){
    const newName=prompt('Nome da plataforma',platform.name);if(!newName)return;
    const newOrder=prompt('Ordem na apresentação',String(platform.display_order));if(newOrder===null)return;
    const newDeadline=prompt('Horário limite de envio (HH:MM)',String(platform.upload_deadline).slice(0,5));if(!newDeadline)return;
    const responsibleName=prompt('Nome exato do responsável',platform.responsible_name);if(!responsibleName)return;
    const responsible=responsibles.find(r=>r.name.toLowerCase()===responsibleName.trim().toLowerCase());
    if(!responsible){alert('Responsável não encontrado.');return;}
    const {error}=await supabase.from('platforms').update({
      name:newName.trim(),display_order:Number(newOrder||0),upload_deadline:newDeadline,
      responsible_id:responsible.id,responsible_name:responsible.name,
    }).eq('id',platform.id);
    if(error)alert(error.message);else await load();
  }

  async function togglePlatform(platform:Platform){
    const {error}=await supabase.from('platforms').update({active:!platform.active}).eq('id',platform.id);
    if(error)alert(error.message);else await load();
  }

  return <div className="space-y-6 text-white">
    <section className="rounded-[28px] border border-white/10 bg-black/35 p-6 backdrop-blur-xl lg:p-8">
      <div className="flex items-center gap-3">
        <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-3"><Settings2 className="h-5 w-5 text-emerald-300"/></div>
        <div><p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-300/75">Administração</p><h1 className="text-3xl font-black">Plataformas de indicadores</h1></div>
      </div>
      <p className="mt-3 max-w-4xl text-sm text-white/55">O ADM só organiza a apresentação: plataforma, responsável, ordem e prazo. As métricas são descobertas automaticamente nos prints enviados pelos responsáveis.</p>
    </section>

    <Card className="border-white/10 bg-black/30 p-5 text-white backdrop-blur-xl">
      <div className="mb-4 flex items-center gap-2"><Layers3 className="h-5 w-5 text-emerald-300"/><h2 className="font-black">Cadastrar plataforma</h2></div>
      <form onSubmit={createPlatform} className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <div><Label>Plataforma</Label><Input className={inputClass} value={name} onChange={e=>setName(e.target.value)} placeholder="Ex.: Mercado Livre"/></div>
        <div><Label>Responsável</Label><select className={selectClass} value={responsibleId} onChange={e=>setResponsibleId(e.target.value)}><option value="">Selecionar</option>{responsibles.map(r=><option key={r.id} value={r.id}>{r.name}</option>)}</select></div>
        <div><Label>Ordem da apresentação</Label><Input className={inputClass} type="number" value={order} onChange={e=>setOrder(e.target.value)}/></div>
        <div><Label>Enviar até</Label><Input className={inputClass} type="time" value={deadline} onChange={e=>setDeadline(e.target.value)}/></div>
        <div className="flex items-end"><Button className="w-full bg-emerald-400 text-black hover:bg-emerald-300"><Plus className="mr-2 h-4 w-4"/>Criar plataforma</Button></div>
      </form>
    </Card>

    <section className="grid gap-4 xl:grid-cols-2">
      {platforms.map(platform=><Card key={platform.id} className={`border-white/10 bg-black/30 p-5 text-white ${!platform.active?'opacity-45':''}`}>
        <div className="flex items-start justify-between gap-4">
          <div><div className="flex items-center gap-2"><span className="rounded-full bg-emerald-400/10 px-2 py-1 text-[10px] font-black text-emerald-300">#{platform.display_order}</span><h2 className="text-xl font-black">{platform.name}</h2></div><div className="mt-3 flex flex-wrap gap-4 text-xs text-white/50"><span><UserRound className="mr-1 inline h-3 w-3"/>{platform.responsible_name}</span><span><Clock3 className="mr-1 inline h-3 w-3"/>Enviar até {String(platform.upload_deadline).slice(0,5)}</span></div><p className="mt-3 text-xs text-white/35">As métricas desta plataforma serão identificadas automaticamente a partir dos prints enviados no Studio.</p></div>
          <span className={`rounded-full px-2 py-1 text-[10px] font-bold ${platform.active?'bg-emerald-400/15 text-emerald-300':'bg-white/10 text-white/40'}`}>{platform.active?'ATIVA':'ARQUIVADA'}</span>
        </div>
        <div className="mt-4 flex gap-2"><Button size="sm" variant="outline" onClick={()=>void editPlatform(platform)} className="border-white/10 bg-white/5 text-white">Editar</Button><Button size="sm" variant="outline" onClick={()=>void togglePlatform(platform)} className="border-white/10 bg-white/5 text-white">{platform.active?'Arquivar':'Reativar'}</Button></div>
      </Card>)}
    </section>
  </div>;
}
