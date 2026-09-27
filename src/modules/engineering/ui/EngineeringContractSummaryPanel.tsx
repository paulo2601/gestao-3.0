import { Card } from '../../../shared/ui/Card';
import type { EngineeringContractSummary } from '../domain/overview';

const currency=new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'});
interface Props{contract:EngineeringContractSummary}
export function EngineeringContractSummaryPanel({contract}:Props){
 const measured=Math.max(0,contract.updatedContractValue-contract.grossBalance);
 const percent=contract.updatedContractValue>0?Math.max(0,Math.min(100,measured*100/contract.updatedContractValue)):0;
 const remaining=Math.max(0,100-percent);
 const donutStyle={background:`conic-gradient(var(--success) 0 ${percent}%, color-mix(in srgb,var(--border) 70%,transparent) ${percent}% 100%)`};
 return <div className="engineering-contract-dashboard__approved">
  <div className="engineering-contract-workspace__kpis engineering-contract-workspace__kpis--hero">
   <Card title="Contrato atualizado"><strong>{currency.format(contract.updatedContractValue)}</strong><span>Valor vigente do contrato</span></Card>
   <Card title="Total medido"><strong className="engineering-positive">{currency.format(measured)}</strong><span>{percent.toFixed(1)}% executado</span></Card>
   <Card title="Saldo a executar"><strong className="engineering-danger">{currency.format(contract.grossBalance)}</strong><span>{remaining.toFixed(1)}% restante</span></Card>
  </div>
  <div className="engineering-contract-dashboard__main">
   <Card className="engineering-contract-dashboard__evolution" title="Evolução física do contrato">
    <p className="ui-muted">Acompanhe o percentual físico executado com base nas medições.</p>
    <progress max={100} value={percent}/><div className="engineering-contract-dashboard__progress-label"><strong>{percent.toFixed(1)}%</strong><span>{remaining.toFixed(1)}%</span></div>
    <div className="engineering-contract-dashboard__evolution-cards"><div><small>Planejado</small><strong>100,0%</strong><span>Contrato total</span></div><div><small>Executado</small><strong>{percent.toFixed(1)}%</strong><span>Medições realizadas</span></div><div><small>Restante</small><strong>{remaining.toFixed(1)}%</strong><span>A executar</span></div></div>
   </Card>
   <Card className="engineering-contract-dashboard__distribution" title="Distribuição do contrato">
    <p className="ui-muted">Visualização do valor medido e saldo contratual.</p>
    <div className="engineering-contract-dashboard__distribution-body"><div className="engineering-contract-dashboard__donut" style={donutStyle}><div><strong>{currency.format(contract.updatedContractValue)}</strong><span>Total do contrato</span><b>100%</b></div></div>
    <div className="engineering-contract-dashboard__legend"><div><small>Medido · {percent.toFixed(1)}%</small><strong>{currency.format(measured)}</strong></div><div><small>Saldo · {remaining.toFixed(1)}%</small><strong>{currency.format(contract.grossBalance)}</strong></div></div></div>
   </Card>
  </div>
 </div>;
}