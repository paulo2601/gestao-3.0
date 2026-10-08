/** Cálculos puros para o acompanhamento mensal. Não altera medições legadas. */
export interface ExecutionProgressItem {
  id: string;
  plannedQuantity: number;
  executedQuantity: number;
  unitPrice: number;
  /** Para serviços de preço global: valor planejado explicitamente informado. */
  plannedValue?: number;
  /** Para serviços de preço global: valor executado explicitamente informado. */
  executedValue?: number;
}
export interface ExecutionProgressSummary {
  plannedValue: number;
  executedValue: number;
  remainingValue: number;
  financialProgressPercent: number;
  completedItems: number;
  partialItems: number;
  pendingItems: number;
}
const finiteNonNegative=(n:number)=>Number.isFinite(n)?Math.max(0,n):0;
const money=(n:number)=>Math.round((n+Number.EPSILON)*100)/100;
export function summarizeExecution(items:readonly ExecutionProgressItem[]):ExecutionProgressSummary {
  let plannedValue=0,executedValue=0,completedItems=0,partialItems=0,pendingItems=0;
  for(const item of items){
    const planned=finiteNonNegative(item.plannedQuantity);
    const executed=finiteNonNegative(item.executedQuantity);
    const price=finiteNonNegative(item.unitPrice);
    const plannedMoney=finiteNonNegative(item.plannedValue??planned*price);
    const executedMoney=finiteNonNegative(item.executedValue??executed*price);
    if(executed>planned && item.executedValue===undefined)throw new Error('Execução excede o planejamento do serviço');
    if(executedMoney>plannedMoney+0.005)throw new Error('Valor executado excede a meta do serviço');
    plannedValue+=plannedMoney;
    executedValue+=executedMoney;
    if(planned<=0 && plannedMoney<=0)continue;
    if((planned>0&&executed>=planned)||(plannedMoney>0&&executedMoney>=plannedMoney))completedItems++;
    else if(executed>0||executedMoney>0)partialItems++;
    else pendingItems++;
  }
  plannedValue=money(plannedValue);executedValue=money(executedValue);
  return {plannedValue,executedValue,remainingValue:money(Math.max(0,plannedValue-executedValue)),
    financialProgressPercent:plannedValue>0?Math.min(100,Math.round(executedValue/plannedValue*10000)/100):0,
    completedItems,partialItems,pendingItems};
}
