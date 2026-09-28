import { useMemo, useState } from 'react';
import type { CompanySummary } from '../../platform/domain/AccessContext';
import { Button } from '../../../shared/ui/Button';
import { Card } from '../../../shared/ui/Card';
import { Dialog } from '../../../shared/ui/Dialog';
import { EmptyState, LoadingState } from '../../../shared/ui/Feedback';
import { Input } from '../../../shared/ui/Input';
import { EngineeringProductionWorkspace } from './EngineeringProductionWorkspace';
import { useEngineeringOverview } from './useEngineeringOverview';
import './engineering.css';
import './engineering-parity-overview.css';
import './engineering-parity-contracts.css';
import './engineering-parity-production.css';
interface Props{companies:readonly CompanySummary[];initialCompanyId?:string}
type Work={workName:string;companyId:string;contractNumber:string};
export function EngineeringProductionPage({companies,initialCompanyId}:Props){
 const [refresh,setRefresh]=useState(0),[search,setSearch]=useState(''),[selected,setSelected]=useState<Work|null>(null);
 const selectedCompany=initialCompanyId?companies.find(c=>c.id===initialCompanyId)??null:null;
 const scopes=useMemo(()=>{const source=selectedCompany?[selectedCompany]:companies;return source.map(c=>({tenantId:c.tenantId,companyId:c.id}));},[selectedCompany,companies]);
 const overview=useEngineeringOverview(scopes,refresh);
 if(overview.status==='idle'||overview.status==='loading')return <LoadingState label="Carregando Produção…"/>;
 if(overview.status!=='ready')return <EmptyState title="Produção indisponível" message={overview.errorMessage??'Não foi possível carregar a Produção.'}/>;
 const works=Array.from(new Map(overview.data.contracts.map(c=>[`${c.companyId}:${c.workName}`,{workName:c.workName,companyId:c.companyId,contractNumber:c.contractNumber}])).values());
 const term=search.trim().toLocaleLowerCase('pt-BR'),visible=works.filter(w=>!term||w.workName.toLocaleLowerCase('pt-BR').includes(term));
 const company=selected?companies.find(c=>c.id===selected.companyId)??null:null,scope=company?{tenantId:company.tenantId,companyId:company.id}:null;
 return <section className="engineering-overview engineering-parity-overview" aria-labelledby="production-title"><header className="engineering-parity-header"><div><h1 id="production-title">Produção</h1><p className="ui-muted">Lançamentos, valores, competências, fechamentos e relatórios de produção.</p></div></header><section className="engineering-contracts-reference"><div className="engineering-parity-tools"><Input label="Buscar obra" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Digite o nome da obra"/></div>{visible.length===0?<EmptyState title="Nenhuma obra encontrada" message="Não há obras disponíveis para produção neste filtro."/>:<div className="engineering-contract-list engineering-production-work-list">{visible.map(work=><Card key={`${work.companyId}-${work.workName}`} className="engineering-contract-card"><Button variant="tertiary" className="engineering-contract-card__open" onClick={()=>setSelected(work)}><div className="engineering-contract-card__head"><div className="engineering-contract-card__icon" aria-hidden="true">⚒</div><div className="engineering-contract-card__identity"><strong>{work.workName}</strong><span>Produção da obra</span></div><div className="engineering-contract-card__chevron" aria-hidden="true">›</div></div></Button></Card>)}</div>}</section><Dialog open={selected!==null} title={selected?.workName??'Produção'} description="Produção da obra" onClose={()=>setSelected(null)} onBack={()=>setSelected(null)}>{selected&&scope&&<EngineeringProductionWorkspace scope={scope} workName={selected.workName} contractNumber={selected.contractNumber} onChanged={()=>setRefresh(v=>v+1)}/>}</Dialog></section>;
}