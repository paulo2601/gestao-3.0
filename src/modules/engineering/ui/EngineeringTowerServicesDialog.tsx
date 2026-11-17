import { useMemo, useState, type ChangeEvent } from 'react';
import { Button } from '../../../shared/ui/Button';
import { Dialog } from '../../../shared/ui/Dialog';
import { Feedback } from '../../../shared/ui/Feedback';
import { Input } from '../../../shared/ui/Input';
import { useEngineeringOperations } from './useEngineeringOperations';

type Row={description:string;unit:string;quantity:number;unitPrice:number};
type EditDraft={id:string;description:string;unit:string;quantity:string;unitPrice:string;allocationQuantity:string;allocationNotes:string};
interface Props{open:boolean;scope:{tenantId:string;companyId:string};contractId:string;workId:string;structure:{id:string;name:string};onClose:()=>void;onChanged:()=>void;}

const money=new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'});
const qtyFmt=new Intl.NumberFormat('pt-BR',{maximumFractionDigits:3});
const n=(v:string)=>{const x=Number(v.trim().replace(/\./g,'').replace(',','.'));return Number.isFinite(x)?x:0;};
function parseCsv(text:string):Row[]{
 const lines=text.replace(/^\uFEFF/,'').split(/\r?\n/).filter(Boolean);const headerLine=lines[0];if(!headerLine||lines.length<2)return[];
 const sep=(headerLine.match(/;/g)?.length??0)>=(headerLine.match(/,/g)?.length??0)?';':',';const clean=(v:string|undefined)=>(v??'').trim().replace(/^"|"$/g,'').trim();
 const h=headerLine.split(sep).map(x=>clean(x).toLocaleLowerCase('pt-BR'));const idx=(...names:string[])=>h.findIndex(x=>names.some(name=>x.includes(name)));
 const di=idx('serviço','servico','descrição','descricao'),ui=idx('unidade','unid'),qi=idx('quantidade','quantitativo','qtd'),vi=idx('valor unit','preço unit','preco unit');
 if(di<0||qi<0||vi<0)throw new Error('A planilha precisa ter as colunas Serviço/Descrição, Quantidade e Valor unitário.');
 const rows:Row[]=[];for(const line of lines.slice(1)){const x=line.split(sep).map(clean),description=clean(x[di]);if(!description)continue;const quantity=n(clean(x[qi]));if(quantity<=0)continue;rows.push({description,unit:ui>=0?(clean(x[ui])||'UN'):'UN',quantity,unitPrice:n(clean(x[vi]))});}return rows;
}
export function EngineeringTowerServicesDialog({open,scope,contractId,workId,structure,onClose,onChanged}:Props){
 const operations=useEngineeringOperations(scope);
 const[search,setSearch]=useState(''),[filter,setFilter]=useState<'all'|'priced'|'unpriced'>('all'),[manual,setManual]=useState(false),[description,setDescription]=useState(''),[unit,setUnit]=useState('UN'),[qty,setQty]=useState(''),[price,setPrice]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState<string|null>(null),[info,setInfo]=useState<string|null>(null),[edit,setEdit]=useState<EditDraft|null>(null);
 const data=operations.state.data;
 const towerRows=useMemo(()=>{if(!data)return[];const contractIds=new Set(data.contractServices.filter(x=>x.contractId===contractId).map(x=>x.id));return data.allocations.filter(a=>a.structureId===structure.id&&a.status==='active'&&contractIds.has(a.contractServiceId)).map(a=>{const s=data.contractServices.find(x=>x.id===a.contractServiceId);return s?{service:s,allocation:a}:null;}).filter((x):x is NonNullable<typeof x>=>Boolean(x));},[data,contractId,structure.id]);
 const visibleRows=useMemo(()=>towerRows.filter(({service,allocation})=>{const term=search.trim().toLocaleLowerCase('pt-BR');const matches=!term||service.description.toLocaleLowerCase('pt-BR').includes(term)||String((service as {code?:string}).code??'').toLocaleLowerCase('pt-BR').includes(term);const value=allocation.allocatedQuantity*service.unitPrice;return matches&&(filter==='all'||(filter==='priced'?value>0:value<=0));}),[towerRows,search,filter]);
 const total=towerRows.reduce((sum,{service,allocation})=>sum+allocation.allocatedQuantity*service.unitPrice,0);
 const priced=towerRows.filter(({service,allocation})=>allocation.allocatedQuantity*service.unitPrice>0).length;
 function exportCsv(){const rows=[['Código','Descrição','Unidade','Quantidade','Valor unitário','Valor total'],...visibleRows.map(({service,allocation})=>[String((service as {code?:string}).code??''),service.description,service.unit,String(allocation.allocatedQuantity),String(service.unitPrice),String(allocation.allocatedQuantity*service.unitPrice)])];const csv='\uFEFF'+rows.map(row=>row.map(value=>'"'+String(value).replace(/"/g,'""')+'"').join(';')).join('\r\n');const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=`servicos-${structure.name.toLowerCase().replace(/[^a-z0-9]+/g,'-')}.csv`;a.click();URL.revokeObjectURL(url);}
 function openEdit(id:string){const row=towerRows.find(x=>x.service.id===id);if(!row)return;setError(null);setInfo(null);setEdit({id,description:row.service.description,unit:row.service.unit,quantity:String(row.service.quantity).replace('.',','),unitPrice:String(row.service.unitPrice).replace('.',','),allocationQuantity:String(row.allocation.allocatedQuantity).replace('.',','),allocationNotes:row.allocation.notes??''});}
 async function saveEdit(){if(!edit)return;const quantity=n(edit.quantity),allocationQuantity=n(edit.allocationQuantity);if(!edit.description.trim()||quantity<=0||allocationQuantity<=0){setError('Informe descrição e quantitativos maiores que zero.');return;}if(allocationQuantity>quantity){setError('O quantitativo desta torre não pode ser maior que a quantidade contratada.');return;}setBusy(true);setError(null);try{await operations.updateContractService({contractServiceId:edit.id,description:edit.description.trim(),unit:edit.unit||'UN',quantity,unitPrice:n(edit.unitPrice),notes:null});await operations.allocateContractService({workId,contractServiceId:edit.id,structureId:structure.id,quantity:allocationQuantity,notes:edit.allocationNotes||null});setEdit(null);setInfo('Serviço atualizado.');onChanged();}catch(e){setError(e instanceof Error?e.message:'Não foi possível atualizar o serviço.');}finally{setBusy(false);}}
 async function saveRow(row:Row){const id=await operations.addContractService({contractId,serviceId:null,description:row.description,unit:row.unit,quantity:row.quantity,unitPrice:row.unitPrice,notes:null});await operations.allocateContractService({workId,contractServiceId:id,structureId:structure.id,quantity:row.quantity,notes:null});}
 async function saveManual(){if(!description.trim()||n(qty)<=0){setError('Informe o serviço e um quantitativo maior que zero.');return;}setBusy(true);setError(null);try{await saveRow({description:description.trim(),unit:unit||'UN',quantity:n(qty),unitPrice:n(price)});setDescription('');setQty('');setPrice('');setManual(false);setInfo('Serviço adicionado e vinculado à torre.');onChanged();}catch(e){setError(e instanceof Error?e.message:'Não foi possível adicionar o serviço.');}finally{setBusy(false);}}
 async function importFile(event:ChangeEvent<HTMLInputElement>){const file=event.target.files?.[0];event.target.value='';if(!file)return;setBusy(true);setError(null);setInfo(null);try{const rows=parseCsv(await file.text());if(!rows.length)throw new Error('Nenhum serviço válido foi encontrado na planilha.');for(const row of rows)await saveRow(row);setInfo(`${rows.length} serviço(s) importado(s) e vinculados à ${structure.name}.`);onChanged();}catch(e){setError(e instanceof Error?e.message:'Não foi possível importar a planilha.');}finally{setBusy(false);}}
 return <>
 <Dialog open={open} title={structure.name} description="Serviços do contrato · toque em um item para editar" onClose={onClose} onBack={onClose} loading={busy}>
  <div className="engineering-tower-services">
   {error&&<Feedback tone="danger" title="Não foi possível concluir" message={error}/>} {info&&<Feedback tone="success" title="Concluído" message={info}/>}
   <div className="engineering-tower-services__actions tower-style-1">
    <label className="ui-button ui-button--secondary">⇧ Importar planilha CSV<input type="file" accept=".csv,text/csv" hidden disabled={busy} onChange={e=>void importFile(e)}/></label>
    <Button disabled={busy} onClick={()=>setManual(v=>!v)}>＋ Adicionar serviço</Button>
    <input aria-label="Pesquisar serviço, código ou descrição" placeholder="⌕ Pesquisar serviço, código ou descrição..." value={search} onChange={e=>setSearch(e.target.value)} className="tower-style-2"/>
    <select aria-label="Filtrar serviços" value={filter} onChange={e=>setFilter(e.target.value as typeof filter)} className="tower-style-3"><option value="all">Todos os serviços</option><option value="priced">Com valor</option><option value="unpriced">Sem valor</option></select>
    <Button variant="secondary" onClick={exportCsv}>Exportar CSV</Button>
    <Button variant="secondary" onClick={()=>window.print()}>Imprimir</Button>
   </div>
   <div className="tower-style-4">
    {([['Total de serviços',String(towerRows.length)],['Valor total',money.format(total)],['Serviços com valor',String(priced)],['Sem valor',String(towerRows.length-priced)]] as const).map(([label,value])=><div key={label} className="tower-style-5"><div className="tower-style-6">{label}</div><strong className="tower-style-7">{value}</strong></div>)}
   </div>
   {manual&&<div className="engineering-standard-form"><div className="engineering-form-grid"><Input label="Serviço / descrição" value={description} onChange={e=>setDescription(e.target.value)} required/><Input label="Unidade" value={unit} onChange={e=>setUnit(e.target.value)}/><Input label="Quantidade" inputMode="decimal" value={qty} onChange={e=>setQty(e.target.value)} required/><Input label="Valor unitário" inputMode="decimal" value={price} onChange={e=>setPrice(e.target.value)}/></div><div className="engineering-tower-services__manual-actions"><Button variant="secondary" onClick={()=>setManual(false)}>Cancelar</Button><Button loading={busy} onClick={()=>void saveManual()}>Salvar serviço</Button></div></div>}
   <div className="engineering-tower-services__list tower-style-8">
    <table className="tower-style-9">
     <thead className="tower-style-10"><tr>{['Código','Descrição do serviço','Valor total','Qtd. itens','Ações'].map(h=><th key={h} className={h==='Descrição do serviço'?'tower-style-11 tower-style-11--left':'tower-style-11'}>{h}</th>)}</tr></thead>
     <tbody>{visibleRows.map(({service,allocation})=><tr key={allocation.id} className="tower-style-12">
      <td className="tower-style-13">{String((service as {code?:string}).code??'—')}</td>
      <td className="tower-style-14">{service.description}<div className="tower-style-15">{service.unit} · {money.format(service.unitPrice)} por unidade</div></td>
      <td className="tower-style-16">{money.format(allocation.allocatedQuantity*service.unitPrice)}</td>
      <td className="tower-style-17">{qtyFmt.format(allocation.allocatedQuantity)}</td>
      <td className="tower-style-18"><Button variant="secondary" onClick={()=>openEdit(service.id)}>✎ Editar</Button></td>
     </tr>)}</tbody>
    </table>
    {visibleRows.length===0&&<p className="tower-style-19">Nenhum serviço encontrado para esta pesquisa.</p>}
   </div>
   <small className="ui-muted tower-style-20">Exibindo {visibleRows.length} de {towerRows.length} serviços</small>
  </div>
 </Dialog>
 {edit&&<Dialog open variant="contract-item-edit" title="Editar item do contrato" description={structure.name} loading={busy} onClose={()=>!busy&&setEdit(null)} onBack={()=>!busy&&setEdit(null)} onConfirm={()=>void saveEdit()} confirmLabel="Salvar alterações"><div className="engineering-standard-form engineering-contract-item-edit"><div className="engineering-form-grid"><Input label="Serviço / descrição" value={edit.description} onChange={e=>setEdit({...edit,description:e.target.value})} required/><Input label="Unidade" value={edit.unit} onChange={e=>setEdit({...edit,unit:e.target.value})}/><Input label="Quantidade contratada" inputMode="decimal" value={edit.quantity} onChange={e=>setEdit({...edit,quantity:e.target.value})} required/><Input label="Quantidade nesta torre" inputMode="decimal" value={edit.allocationQuantity} onChange={e=>setEdit({...edit,allocationQuantity:e.target.value})} required/><Input label="Valor unitário" inputMode="decimal" value={edit.unitPrice} onChange={e=>setEdit({...edit,unitPrice:e.target.value})}/><Input label="Observações da distribuição" value={edit.allocationNotes} onChange={e=>setEdit({...edit,allocationNotes:e.target.value})}/></div></div></Dialog>}
 </>;
}
