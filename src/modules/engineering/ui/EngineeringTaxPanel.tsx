import { Button } from '../../../shared/ui/Button';

const currency=new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'});
const labels:Record<string,string>={draft:'Rascunho',approved:'Aprovado',closed:'Fechado',cancelled:'Cancelado'};
function monthLabel(value:string){if(!value)return'—';const [y,m]=value.slice(0,7).split('-');return m&&y?`${m}/${y}`:value;}
interface Row{id:string;measurementNumber:string;competence:string;status:string}
interface Financial{gross:number;inss:number;iss:number;rt:number;net:number}
interface Props{rows:Row[];totalCount:number;financial:(id:string)=>Financial;toolbar:React.ReactNode;onReview:()=>void}
export function EngineeringTaxPanel({rows,totalCount,financial,toolbar,onReview}:Props){
 const totals=rows.reduce((acc,item)=>{const value=financial(item.id);acc.inss+=value.inss;acc.iss+=value.iss;acc.rt+=value.rt;return acc;},{inss:0,iss:0,rt:0});
 return <>{toolbar}<div className="engineering-tax-summary">
  <div className="engineering-tax-summary__card engineering-tax-summary__card--records"><span className="engineering-tax-summary__icon">▤</span><span className="engineering-tax-summary__copy"><small>Total de registros</small><strong>{totalCount}</strong><em>Medições com retenções</em></span></div>
  <div className="engineering-tax-summary__card engineering-tax-summary__card--inss"><span className="engineering-tax-summary__icon">◇</span><span className="engineering-tax-summary__copy"><small>INSS retido</small><strong>{currency.format(totals.inss)}</strong><em>Total retido nas medições</em></span></div>
  <div className="engineering-tax-summary__card engineering-tax-summary__card--iss"><span className="engineering-tax-summary__icon">▧</span><span className="engineering-tax-summary__copy"><small>ISS retido</small><strong>{currency.format(totals.iss)}</strong><em>Total retido nas medições</em></span></div>
  <div className="engineering-tax-summary__card engineering-tax-summary__card--rt"><span className="engineering-tax-summary__icon">%</span><span className="engineering-tax-summary__copy"><small>Retenção técnica</small><strong>{currency.format(totals.rt)}</strong><em>Total retido nas medições</em></span></div>
 </div><div className="engineering-sheet__table-wrap"><table className="engineering-sheet__table"><thead><tr><th>Competência</th><th>Nº medição</th><th>INSS</th><th>ISS</th><th>Retenção</th><th>Status</th><th>Ações</th></tr></thead><tbody>{rows.map(item=>{const value=financial(item.id);return <tr key={item.id}><td><strong>{monthLabel(item.competence)}</strong></td><td>{item.measurementNumber||'—'}</td><td>{currency.format(value.inss)}</td><td>{currency.format(value.iss)}</td><td>{currency.format(value.rt)}</td><td><span className={`engineering-status engineering-status--${item.status}`}>{labels[item.status]??item.status}</span></td><td><Button size="sm" variant="tertiary" onClick={onReview}>Revisar</Button></td></tr>})}</tbody></table>{rows.length===0&&<div className="engineering-sheet__empty">As retenções serão organizadas por medição.</div>}</div></>;
}