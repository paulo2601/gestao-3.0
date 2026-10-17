import { useEffect, useState } from 'react';
import { getSupabaseClient } from '../../../shared/infrastructure/supabase/client';
import { Button } from '../../../shared/ui/Button';

type Plan = { id:string; nome:string; slug:string; descricao:string|null; preco_mensal:number|null; preco_anual:number|null; publico:boolean; ordem:number };
type Module = { modulo:string; nome:string; categoria:string; ativo:boolean; vendavel:boolean };
type Assignment = { plan_id:string; modulo:string; habilitado:boolean };
const money=(value:number|null)=>value===null?'Interno / não definido':new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(value);

export function PlanCatalogPage(){
  const [plans,setPlans]=useState<Plan[]>([]);
  const [modules,setModules]=useState<Module[]>([]);
  const [assignments,setAssignments]=useState<Assignment[]>([]);
  const [error,setError]=useState('');
  const [loading,setLoading]=useState(true);
  const [selected,setSelected]=useState<string>('');
  async function load(){
    setLoading(true);setError('');
    try{
      const db=getSupabaseClient();
      const [p,m,a]=await Promise.all([
        db.from('platform_plans').select('id,nome,slug,descricao,preco_mensal,preco_anual,publico,ordem').order('ordem'),
        db.from('platform_module_catalog').select('modulo,nome,categoria,ativo,vendavel').order('ordem'),
        db.from('platform_plan_modules').select('plan_id,modulo,habilitado')
      ]);
      if(p.error||m.error||a.error)throw p.error||m.error||a.error;
      const planRows=(p.data??[]) as Plan[];
      setPlans(planRows);setModules((m.data??[]) as Module[]);setAssignments((a.data??[]) as Assignment[]);
      setSelected(current=>planRows.some(plan=>plan.id===current)?current:planRows[0]?.id??'');
    }catch(e){setError(e instanceof Error?e.message:'Falha ao carregar o catálogo comercial.');}
    finally{setLoading(false);}
  }
  useEffect(()=>{void load();},[]);
  const plan=plans.find(item=>item.id===selected);
  const enabled=new Set(assignments.filter(a=>a.plan_id===selected&&a.habilitado).map(a=>a.modulo));
  return <section className="app-company-sections">
    <header className="app-page__section-header"><div><small>ADMINISTRAÇÃO COMERCIAL</small><h1>Planos e módulos</h1><p>Catálogo recuperado do Gestão 2.0. Consulta de planos públicos; edição administrativa em preparação.</p></div><Button size="sm" onClick={()=>void load()} disabled={loading}>Atualizar</Button></header>
    {loading?<p>Carregando planos…</p>:error?<p role="alert">{error}</p>:plans.length===0?<p>Nenhum plano disponível para consulta.</p>:<>
      <div style={{display:'flex',flexWrap:'wrap',gap:8,marginBottom:16}}>{plans.map(item=><Button key={item.id} size="sm" variant={selected===item.id?'primary':'secondary'} onClick={()=>setSelected(item.id)}>{item.nome}</Button>)}</div>
      {plan&&<><div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))',gap:12,marginBottom:16}}>
        <div className="ui-card" style={{padding:14,border:'1px solid var(--border-color, #ddd)',borderRadius:10}}><small>Mensal</small><h3>{money(plan.preco_mensal)}</h3></div>
        <div className="ui-card" style={{padding:14,border:'1px solid var(--border-color, #ddd)',borderRadius:10}}><small>Anual</small><h3>{money(plan.preco_anual)}</h3></div>
        <div className="ui-card" style={{padding:14,border:'1px solid var(--border-color, #ddd)',borderRadius:10}}><small>Módulos incluídos</small><h3>{enabled.size}</h3></div>
      </div>
      {plan.descricao&&<p>{plan.descricao}</p>}
      <h2>Módulos incluídos</h2><div style={{display:'flex',flexWrap:'wrap',gap:8}}>{modules.filter(m=>enabled.has(m.modulo)).map(m=><span key={m.modulo} style={{border:'1px solid var(--border-color, #ddd)',padding:'7px 10px',borderRadius:8}}>{m.nome}</span>)}</div>
      {enabled.size===0&&<p>Nenhum módulo vinculado.</p>}</>}
    </>}
  </section>;
}
