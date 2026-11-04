import { currency, originLabel } from './guidedMeasurementHelpers';

export function MeasurementOriginSummary({origin,stages,os,cmg}:{origin:Parameters<typeof originLabel>[0];stages:{length:number};os:{contracted:number;measured:number;balance:number;measuredPct:number;balancePct:number};cmg:number}){return <section className="ams-summary approved-measurement-origin-modal__summary"><div className="ams-origin"><span className="ams-building">▦</span><div><h3>{originLabel(origin)}</h3><p>{stages.length} serviço(s) nesta origem</p></div></div><div className="ams-summary-card"><span>Valor contratado</span><strong>{currency.format(os.contracted)}</strong></div><div className="ams-summary-card"><span>Valor medido</span><strong>{currency.format(os.measured)}</strong><b>{os.measuredPct.toLocaleString('pt-BR',{maximumFractionDigits:1})}%</b></div><div className="ams-summary-card"><span>Saldo a medir</span><strong>{currency.format(os.balance)}</strong><b>{os.balancePct.toLocaleString('pt-BR',{maximumFractionDigits:1})}%</b></div><div className="ams-summary-card mct"><span>Nesta medição</span><strong>{currency.format(cmg)}</strong><b>total atual</b></div></section>;}

export function MeasurementUnitSummary({stage,previousStageValue,previousQty,currentStageValue,balanceStageValue,balance}:{stage:{code?:string|null;unitPrice:number;contractedQuantity:number};previousStageValue:number;previousQty:number;currentStageValue:number;balanceStageValue:number;balance:number}) {
  const contracted=stage.contractedQuantity*stage.unitPrice;
  const percent=(value:number)=>contracted>0?`${(100*value/contracted).toLocaleString('pt-BR',{maximumFractionDigits:2})}%`:'—';
  const remaining=Math.max(0,balanceStageValue-currentStageValue);
  const quantity=(value:number)=>`${value.toLocaleString('pt-BR',{maximumFractionDigits:3})} un`;
  return <section className="aup-summary aup-summary--approved" aria-label="Resumo financeiro do serviço">
    <div className="aup-fin-card aup-fin-card--contract"><span>▱ Contrato</span><strong>{currency.format(contracted)}</strong><small>{quantity(stage.contractedQuantity)} · {currency.format(stage.unitPrice)} / un</small><b>Valor contratado</b></div>
    <div className="aup-fin-card aup-fin-card--measured"><span>✓ Já medido</span><strong>{currency.format(previousStageValue)}</strong><small>{quantity(previousQty)}</small><b>Executado: {percent(previousStageValue)}</b></div>
    <div className="aup-fin-card aup-fin-card--current"><span>▥ Nesta medição</span><strong>{currency.format(currentStageValue)}</strong><small>Valor lançado neste serviço</small><b>Do contrato: {percent(currentStageValue)}</b></div>
    <div className="aup-fin-card aup-fin-card--balance"><span>◷ Saldo antes desta medição</span><strong>{currency.format(balanceStageValue)}</strong><small>{quantity(balance)}</small><b>Disponível: {percent(balanceStageValue)}</b></div>
    <div className="aup-fin-card aup-fin-card--final"><span>⚑ Saldo final do item</span><strong>{currency.format(remaining)}</strong><small>Após esta medição</small><b>Restante: {percent(remaining)}</b></div>
  </section>;
}
