import { useEffect, useState } from 'react';
import { loadCommercialCatalog, type Plan, type Module, type Assignment } from '../infrastructure/CommercialCatalogRepository';
import './PlanCatalogPage.css';
import { Button } from '../../../shared/ui/Button';

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
      const { plans:planRows, modules:moduleRows, assignments:assignmentRows }=await loadCommercialCatalog();
      setPlans(planRows);setModules(moduleRows);setAssignments(assignmentRows);
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
      <div className="plan-catalog__choices">{plans.map(item=><Button key={item.id} size="sm" variant={selected===item.id?'primary':'secondary'} onClick={()=>setSelected(item.id)}>{item.nome}</Button>)}</div>
      {plan&&<><div className="plan-catalog__summary">
        <div className="plan-catalog__card"><small>Mensal</small><h3>{money(plan.preco_mensal)}</h3></div>
        <div className="plan-catalog__card"><small>Anual</small><h3>{money(plan.preco_anual)}</h3></div>
        <div className="plan-catalog__card"><small>Módulos incluídos</small><h3>{enabled.size}</h3></div>
      </div>
      {plan.descricao&&<p>{plan.descricao}</p>}
      <h2>Módulos incluídos</h2><div className="plan-catalog__modules">{modules.filter(m=>enabled.has(m.modulo)).map(m=><span key={m.modulo} className="plan-catalog__module">{m.nome}</span>)}</div>
      {enabled.size===0&&<p>Nenhum módulo vinculado.</p>}</>}
    </>}
  </section>;
}
