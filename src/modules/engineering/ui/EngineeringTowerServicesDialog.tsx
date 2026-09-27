import { useState, type ChangeEvent } from 'react';
import { Button } from '../../../shared/ui/Button';
import { Dialog } from '../../../shared/ui/Dialog';
import { Feedback } from '../../../shared/ui/Feedback';
import { Input } from '../../../shared/ui/Input';
import { useEngineeringOperations } from './useEngineeringOperations';

type Row={description:string;unit:string;quantity:number;unitPrice:number};
interface Props{open:boolean;scope:{tenantId:string;companyId:string};contractId:string;workId:string;structure:{id:string;name:string};onClose:()=>void;onChanged:()=>void;}

const n=(v:string)=>{const x=Number(v.trim().replace(/\./g,'').replace(',','.'));return Number.isFinite(x)?x:0;};
function parseCsv(text:string):Row[]{
 const lines=text.replace(/^\uFEFF/,'').split(/\r?\n/).filter(Boolean);
 const headerLine=lines[0];if(!headerLine||lines.length<2)return[];
 const sep=(headerLine.match(/;/g)?.length??0)>=(headerLine.match(/,/g)?.length??0)?';':',';
 const clean=(v:string|undefined)=>(v??'').trim().replace(/^"|"$/g,'').trim();
 const h=headerLine.split(sep).map(x=>clean(x).toLocaleLowerCase('pt-BR'));
 const idx=(...names:string[])=>h.findIndex(x=>names.some(name=>x.includes(name)));
 const di=idx('serviço','servico','descrição','descricao'),ui=idx('unidade','unid'),qi=idx('quantidade','quantitativo','qtd'),vi=idx('valor unit','preço unit','preco unit');
 if(di<0||qi<0||vi<0)throw new Error('A planilha precisa ter as colunas Serviço/Descrição, Quantidade e Valor unitário.');
 const rows:Row[]=[];
 for(const line of lines.slice(1)){const c=line.split(sep).map(clean);const description=clean(c[di]);if(!description)continue;const quantity=n(clean(c[qi]));if(quantity<=0)continue;rows.push({description,unit:ui>=0?(clean(c[ui])||'UN'):'UN',quantity,unitPrice:n(clean(c[vi]))});}
 return rows;
}
export function EngineeringTowerServicesDialog({open,scope,contractId,workId,structure,onClose,onChanged}:Props){
 const operations=useEngineeringOperations(scope);
 const[manual,setManual]=useState(false),[description,setDescription]=useState(''),[unit,setUnit]=useState('UN'),[qty,setQty]=useState(''),[price,setPrice]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState<string|null>(null),[info,setInfo]=useState<string|null>(null);
 async function saveRow(row:Row){const id=await operations.addContractService({contractId,serviceId:null,description:row.description,unit:row.unit,quantity:row.quantity,unitPrice:row.unitPrice,notes:null});await operations.allocateContractService({workId,contractServiceId:id,structureId:structure.id,quantity:row.quantity,notes:null});}
 async function saveManual(){if(!description.trim()||n(qty)<=0){setError('Informe o serviço e um quantitativo maior que zero.');return;}setBusy(true);setError(null);try{await saveRow({description:description.trim(),unit:unit||'UN',quantity:n(qty),unitPrice:n(price)});setDescription('');setQty('');setPrice('');setManual(false);setInfo('Serviço adicionado e vinculado à torre.');onChanged();}catch(e){setError(e instanceof Error?e.message:'Não foi possível adicionar o serviço.');}finally{setBusy(false);}}
 async function importFile(event:ChangeEvent<HTMLInputElement>){const file=event.target.files?.[0];event.target.value='';if(!file)return;setBusy(true);setError(null);setInfo(null);try{const rows=parseCsv(await file.text());if(!rows.length)throw new Error('Nenhum serviço válido foi encontrado na planilha.');for(const row of rows)await saveRow(row);setInfo(`${rows.length} serviço(s) importado(s) e vinculados à ${structure.name}.`);onChanged();}catch(e){setError(e instanceof Error?e.message:'Não foi possível importar a planilha.');}finally{setBusy(false);}}
 return <Dialog open={open} title={structure.name} description="Planilha de serviços da torre" onClose={onClose} onBack={onClose} loading={busy}>
  <div className="engineering-tower-services">
   {error&&<Feedback tone="danger" title="Não foi possível concluir" message={error}/>}
   {info&&<Feedback tone="success" title="Concluído" message={info}/>}
   <div className="engineering-tower-services__actions">
    <label className="ui-button ui-button--secondary">Importar planilha CSV<input type="file" accept=".csv,text/csv" hidden disabled={busy} onChange={e=>void importFile(e)}/></label>
    <Button disabled={busy} onClick={()=>setManual(v=>!v)}>＋ Adicionar serviço manual</Button>
   </div>
   <small className="ui-muted">Importação: Serviço/Descrição, Unidade, Quantidade e Valor unitário. O serviço é vinculado automaticamente a esta torre.</small>
   {manual&&<div className="engineering-standard-form"><div className="engineering-form-grid"><Input label="Serviço / descrição" value={description} onChange={e=>setDescription(e.target.value)} required/><Input label="Unidade" value={unit} onChange={e=>setUnit(e.target.value)}/><Input label="Quantidade" inputMode="decimal" value={qty} onChange={e=>setQty(e.target.value)} required/><Input label="Valor unitário" inputMode="decimal" value={price} onChange={e=>setPrice(e.target.value)}/></div><div className="engineering-tower-services__manual-actions"><Button variant="secondary" onClick={()=>setManual(false)}>Cancelar</Button><Button loading={busy} onClick={()=>void saveManual()}>Salvar serviço</Button></div></div>}
  </div>
 </Dialog>;
}
