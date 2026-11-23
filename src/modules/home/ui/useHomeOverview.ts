import { useEffect, useMemo, useState } from 'react';
import type { CompanySummary } from '../../platform/domain/AccessContext';
import type { BankInstitution } from '../../finance/domain/accounts';
import { getFinanceRepositories } from '../../finance/infrastructure/createFinanceRepositories';
import { getHrBudgetRepository, getHrOperationsRepository } from '../../hr/infrastructure/createHrRepositories';
import { currentHrCompetence } from '../../hr/ui/useHrBudgetOverview';
import { getSupabaseClient } from '../../../shared/infrastructure/supabase/client';

export interface HomeEntry { tenantId:string; companyId:string; installmentId:string; sourceKind:'financial_installment'|'card_statement'|'financial_recurrence_forecast'; entryType:'income'|'expense'; description:string; counterpartyName:string|null; responsibleName?:string|null; accountName?:string|null; installmentNumber:number; installmentCount:number; dueDate:string; amount:number; paymentStatus:string; companyName:string; categoryName?:string|null; }
export interface HomeBalanceMovement { movementOn:string; signedAmount:number; }
export interface HomeBudgetLimit { id:string; categoryName:string|null; limitAmount:number; warningPercent:number; consumedAmount:number; remainingAmount:number; consumedPercent:number; }
export interface HomeBudgetItem { companyId:string; companyName:string; costCenterId:string|null; costCenterName:string|null; plannedTotal:number; realizedTotal:number; limitTotal:number; plannedIncome:number; realizedIncome:number; limits:readonly HomeBudgetLimit[]; }
export interface HomeBankAccount { tenantId:string; companyId:string; companyName:string; accountId:string; name:string; bankInstitution:BankInstitution|null; currentBalance:number; sortOrder:number; }
export interface HomeCard { tenantId:string; companyId:string; companyName:string; cardId:string; name:string; creditLimit:number; committedAmount:number; availableLimit:number; sortOrder:number; }
export interface HomeOverviewData { month:string; bankBalance:number; incomePlanned:number; incomeRealized:number; expensePlanned:number; expenseRealized:number; entries:readonly HomeEntry[]; categoryExpenses:readonly {name:string;amount:number}[]; balanceMovements:readonly HomeBalanceMovement[]; budgets:readonly HomeBudgetItem[]; bankAccounts:readonly HomeBankAccount[]; cards:readonly HomeCard[]; }
type HomeOverviewState = {status:'idle'|'loading';data:HomeOverviewData|null;errorMessage:null}|{status:'ready';data:HomeOverviewData;errorMessage:null}|{status:'error';data:HomeOverviewData|null;errorMessage:string};
declare const __GESTAO_APP_VARIANT__: 'primary' | 'secondary';
const PERSONAL_APP = __GESTAO_APP_VARIANT__ === 'secondary';
export const HOME_CACHE_KEY='gestao-home-overview-v17';
function readHomeCache(companyKey:string):HomeOverviewData|null{try{const raw=localStorage.getItem(HOME_CACHE_KEY);if(!raw)return null;const parsed=JSON.parse(raw) as {companyKey:string;savedAt?:number;data:HomeOverviewData};return parsed.companyKey===companyKey&&typeof parsed.savedAt==='number'&&Date.now()-parsed.savedAt>=0&&Date.now()-parsed.savedAt<5*60*1000?parsed.data:null;}catch{return null;}}
function writeHomeCache(companyKey:string,data:HomeOverviewData){try{localStorage.setItem(HOME_CACHE_KEY,JSON.stringify({companyKey,data,savedAt:Date.now()}));}catch{/* cache é apenas aceleração visual */}}
type BudgetLimitConsumptionRow = { limit_id:string; consumed_amount:number|string; remaining_amount:number|string; consumed_percent:number|string; };
type BudgetIncomeRow = { cost_center_id:string|null; category_id:string|null; planned_income:number|string; actual_income:number|string; };
type BudgetPlanRow = { cost_center_id:string|null; category_id:string|null; planned_amount:number|string; };
type BudgetEntryRow = { cost_center_id:string|null; category_id:string|null; entry_type:'income'|'expense'; include_in_budget:boolean|null; };
type BudgetInstallmentRow = { financial_entries:BudgetEntryRow|BudgetEntryRow[]|null; };
type BudgetSettlementRow = { amount:number|string; settled_on:string; financial_installments:BudgetInstallmentRow|BudgetInstallmentRow[]|null; };
type BudgetPricingSettingsRow = { cost_center_id:string|null; target_net_margin_percent:number|string; };
type RecurrenceForecastRow = { id:string; description:string; counterparty_name:string|null; amount:number|string; entry_type:'income'|'expense'; next_occurrence_date:string; cost_center_id:string|null; notes:string|null; end_date:string|null; day_of_month:number|null; };
type PlanningSourceEntry = { id:string; cost_center_id:string|null; planned_account_id:string|null; financial_installments:{id:string}[]|null }; 
type PlanningSourceRecurrence = {id:string;cost_center_id:string|null;notes:string|null;start_date:string;frequency:string;interval_count:number};
type PlanningCostCenter = {id:string;name:string};
type PlanningSourceCard = {id:string;card_id:string;cost_center_id:string|null;card_installments:{id:string}[]|null};
type PlannedAccountRow = {id:string;planned_account_id:string|null; financial_installments:{id:string}[]|null};
type PlanningRow = { item_key:string; source_kind:'financial_installment'|'card_statement'|'financial_recurrence_forecast'; entry_type:'income'|'expense'; description:string; counterparty_name:string|null; installment_number:number; installment_count:number; due_date:string; amount:number|string; payment_status:string; };
function currentMonthStart(){const now=new Date();return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`;}
function nextMonthStart(monthStart:string){const year=Number(monthStart.slice(0,4));const month=Number(monthStart.slice(5,7));const next=new Date(Date.UTC(year,month,1));return `${next.getUTCFullYear()}-${String(next.getUTCMonth()+1).padStart(2,'0')}-01`;}
function isoDate(value:Date){return `${value.getFullYear()}-${String(value.getMonth()+1).padStart(2,'0')}-${String(value.getDate()).padStart(2,'0')}`;}
function companyName(company:CompanySummary){return company.tradeName??company.legalName;}
function cardDisplayName(name:string){return name.replace(/^\s*HISTÓRICO\s*[·•-]\s*/i,'').trim();}
function normalizeLabel(value:string){return value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toUpperCase();}
function isPersonalCompany(label:string){return normalizeLabel(label)==='PESSOAL';}
function isPersonalBalanceAccount(name:string){const normalized=normalizeLabel(name);return normalized==='NUBANK PESSOAL'||normalized==='DINHEIRO';}

export function useHomeOverview(companies:readonly CompanySummary[],refreshToken=0):HomeOverviewState{
 const finance=useMemo(()=>getFinanceRepositories(),[]); const hr=useMemo(()=>getHrBudgetRepository(),[]); const hrOperations=useMemo(()=>getHrOperationsRepository(),[]); const supabase=useMemo(()=>getSupabaseClient(),[]); const companyKey=companies.map(c=>c.id).sort().join(','); const companySnapshot=JSON.stringify(companies); const stableCompanies=useMemo<readonly CompanySummary[]>(()=>JSON.parse(companySnapshot) as CompanySummary[],[companySnapshot]);
 const [state,setState]=useState<HomeOverviewState>(()=>{const cached=readHomeCache(companyKey);return cached?{status:'ready',data:cached,errorMessage:null}:{status:'idle',data:null,errorMessage:null};});
 useEffect(()=>{
  if(stableCompanies.length===0){setState({status:'idle',data:null,errorMessage:null});return;}
  let cancelled=false; const month=currentMonthStart(); const hrMonth=currentHrCompetence().month; const monthEnd=nextMonthStart(month); const budgetYear=Number(hrMonth.slice(0,4)); const movementTo=new Date(); const movementFrom=new Date(); movementFrom.setDate(movementTo.getDate()-364);
  setState(previous=>({status:'loading',data:previous.data,errorMessage:null}));
  // Saldos, movimentos do gráfico e KPIs devem atualizar juntos, sem depender
  // das consultas pesadas de RH, cartões ou planejamento.
  void Promise.all(stableCompanies.map(async company => {
    const scope={tenantId:company.tenantId,companyId:company.id};
    const [balances,movements,summary]=await Promise.all([
      finance.accounts.listBalances(scope),
      finance.accounts.listMovements(scope,isoDate(movementFrom),isoDate(movementTo)),
      finance.monthly.summarize({...scope,competenceFrom:month,competenceTo:month})
    ]);
    return {company,balances,movements,summary};
  })).then(results => {
    if(cancelled)return;
    setState(previous => {
      const bankAccounts:HomeBankAccount[]=[];
      const balanceMovements:HomeBalanceMovement[]=[];
      let bankBalance=0,incomePlanned=0,incomeRealized=0,expensePlanned=0,expenseRealized=0;
      results.forEach(({company,balances,movements,summary})=>{
        const label=companyName(company);
        const included=balances.filter(i=>i.status==='active'&&i.includeInDashboard&&(PERSONAL_APP||!isPersonalCompany(label)||isPersonalBalanceAccount(i.name)));
        const ids=new Set(included.map(i=>i.accountId));
        included.forEach(i=>{
          bankBalance+=i.currentBalance;
          bankAccounts.push({tenantId:company.tenantId,companyId:company.id,companyName:label,accountId:i.accountId,name:i.name,bankInstitution:i.bankInstitution,currentBalance:i.currentBalance,sortOrder:i.sortOrder});
        });
        movements.filter(i=>ids.has(i.accountId)).forEach(i=>balanceMovements.push({movementOn:i.movementOn,signedAmount:i.direction==='inflow'?i.amount:-i.amount}));
        summary.forEach(i=>{if(i.entryType==='income'){incomePlanned+=i.plannedAmount;incomeRealized+=i.realizedAmount;}else{expensePlanned+=i.plannedAmount;expenseRealized+=i.realizedAmount;}});
      });
      bankAccounts.sort((a,b)=>a.tenantId.localeCompare(b.tenantId)||a.sortOrder-b.sortOrder||a.name.localeCompare(b.name));
      if(!previous.data)return previous;
      const data={...previous.data,bankBalance,bankAccounts,balanceMovements,incomePlanned,incomeRealized,expensePlanned,expenseRealized};
      writeHomeCache(companyKey,data);
      return {...previous,data};
    });
  }).catch(()=>{ /* A consulta completa permanece como alternativa. */ });
  void Promise.all(stableCompanies.map(async company=>{const scope={tenantId:company.tenantId,companyId:company.id}; const [summary,balances,movements,budget,operational,cardLimits,limitConsumptionResult,plannedIncomeResult,actualIncomeResult,budgetPricingResult,planningResult,plannedAccountsResult,categoryRowsResult,categoryNamesResult,cardCategoryRowsResult,recurrenceCategoriesResult,planningEntriesResult,planningRecurrencesResult,planningCostCentersResult,planningCardsResult]=await Promise.all([
   finance.monthly.summarize({...scope,competenceFrom:month,competenceTo:month}),finance.accounts.listBalances(scope),finance.accounts.listMovements(scope,isoDate(movementFrom),isoDate(movementTo)),hr.getOverview({...scope,competenceMonth:hrMonth,year:budgetYear}),hrOperations.getSnapshot(scope,hrMonth),finance.cards.listLimits(scope),supabase.from('budget_limit_control_v2').select('limit_id,consumed_amount,remaining_amount,consumed_percent').eq('tenant_id',scope.tenantId).eq('company_id',scope.companyId).eq('competence_month',hrMonth).returns<BudgetLimitConsumptionRow[]>(),supabase.from('budget_plans').select('cost_center_id,category_id,planned_amount').eq('tenant_id',scope.tenantId).eq('company_id',scope.companyId).eq('competence_month',hrMonth).eq('flow_type','income').returns<BudgetPlanRow[]>(),supabase.from('financial_settlements').select('amount,settled_on,financial_installments!inner(financial_entries!inner(cost_center_id,category_id,entry_type,include_in_budget))').eq('tenant_id',scope.tenantId).eq('company_id',scope.companyId).gte('settled_on',hrMonth).lt('settled_on',monthEnd).returns<BudgetSettlementRow[]>(),supabase.from('budget_planning_settings').select('cost_center_id,target_net_margin_percent').eq('tenant_id',scope.tenantId).eq('company_id',scope.companyId).eq('budget_year',budgetYear).returns<BudgetPricingSettingsRow[]>(),supabase.from('finance_planning_items').select('item_key,source_kind,entry_type,description,counterparty_name,installment_number,installment_count,due_date,amount,payment_status').eq('tenant_id',scope.tenantId).eq('company_id',scope.companyId).order('due_date').returns<PlanningRow[]>(),PERSONAL_APP?supabase.from('financial_entries').select('id,planned_account_id,financial_installments(id)').eq('tenant_id',scope.tenantId).eq('company_id',scope.companyId).not('planned_account_id','is',null).returns<PlannedAccountRow[]>():Promise.resolve({data:[],error:null}),PERSONAL_APP?supabase.from('financial_installments').select('amount,financial_entries!inner(entry_type,category_id)').eq('tenant_id',scope.tenantId).eq('company_id',scope.companyId).gte('due_date',month).lt('due_date',monthEnd).returns<{amount:number|string;financial_entries:{entry_type:string;category_id:string|null}|null}[]>():Promise.resolve({data:[],error:null}),PERSONAL_APP?supabase.from('financial_categories').select('id,name').eq('tenant_id',scope.tenantId).eq('company_id',scope.companyId).returns<{id:string;name:string}[]>():Promise.resolve({data:[],error:null}),PERSONAL_APP?supabase.from('card_installments').select('amount,card_transactions!inner(category_id)').eq('tenant_id',scope.tenantId).eq('company_id',scope.companyId).gte('statement_month',month).lt('statement_month',monthEnd).returns<{amount:number|string;card_transactions:{category_id:string|null}|null}[]>():Promise.resolve({data:[],error:null}),PERSONAL_APP?supabase.from('financial_recurrence_rules').select('id,category_id').eq('tenant_id',scope.tenantId).eq('company_id',scope.companyId).eq('status','active').returns<{id:string;category_id:string|null}[]>():Promise.resolve({data:[],error:null}),PERSONAL_APP?supabase.from('financial_entries').select('id,cost_center_id,planned_account_id,financial_installments(id)').eq('tenant_id',scope.tenantId).eq('company_id',scope.companyId).returns<PlanningSourceEntry[]>():Promise.resolve({data:[],error:null}),PERSONAL_APP?supabase.from('financial_recurrence_rules').select('id,cost_center_id,notes,start_date,frequency,interval_count').eq('tenant_id',scope.tenantId).eq('company_id',scope.companyId).returns<PlanningSourceRecurrence[]>():Promise.resolve({data:[],error:null}),PERSONAL_APP?supabase.from('cost_centers').select('id,name').eq('tenant_id',scope.tenantId).eq('company_id',scope.companyId).returns<PlanningCostCenter[]>():Promise.resolve({data:[],error:null}),PERSONAL_APP?supabase.from('card_transactions').select('id,card_id,cost_center_id,card_installments(id)').eq('tenant_id',scope.tenantId).eq('company_id',scope.companyId).returns<PlanningSourceCard[]>():Promise.resolve({data:[],error:null})]);
   if(limitConsumptionResult.error)throw limitConsumptionResult.error; if(plannedIncomeResult.error)throw plannedIncomeResult.error; if(actualIncomeResult.error)throw actualIncomeResult.error; if(budgetPricingResult.error)throw budgetPricingResult.error; if(planningResult.error)throw planningResult.error; if(plannedAccountsResult.error)throw plannedAccountsResult.error; if(categoryRowsResult.error)throw categoryRowsResult.error; if(categoryNamesResult.error)throw categoryNamesResult.error; if(cardCategoryRowsResult.error)throw cardCategoryRowsResult.error; if(recurrenceCategoriesResult.error)throw recurrenceCategoriesResult.error; if(planningEntriesResult.error)throw planningEntriesResult.error; if(planningRecurrencesResult.error)throw planningRecurrencesResult.error; if(planningCostCentersResult.error)throw planningCostCentersResult.error; if(planningCardsResult.error)throw planningCardsResult.error;
   const budgetIncome:BudgetIncomeRow[]=[]; const incomeMap=new Map<string,BudgetIncomeRow>(); const key=(cc:string|null,cat:string|null)=>`${cc??''}|${cat??''}`;
   for(const row of plannedIncomeResult.data??[]){const k=key(row.cost_center_id,row.category_id);const current=incomeMap.get(k)??{cost_center_id:row.cost_center_id,category_id:row.category_id,planned_income:0,actual_income:0};current.planned_income=Number(current.planned_income)+Number(row.planned_amount??0);incomeMap.set(k,current);}
   for(const row of actualIncomeResult.data??[]){const nested=Array.isArray(row.financial_installments)?row.financial_installments[0]:row.financial_installments;const entry=nested?.financial_entries??null;const e=Array.isArray(entry)?entry[0]:entry;if(!e||e.entry_type!=='income'||e.include_in_budget===false)continue;const k=key(e.cost_center_id,e.category_id);const current=incomeMap.get(k)??{cost_center_id:e.cost_center_id,category_id:e.category_id,planned_income:0,actual_income:0};current.actual_income=Number(current.actual_income)+Number(row.amount??0);incomeMap.set(k,current);}
   budgetIncome.push(...incomeMap.values()); return {company,summary,balances,movements,budget,operational,cardLimits,limitConsumption:limitConsumptionResult.data??[],budgetControl:budgetIncome,budgetPricing:budgetPricingResult.data??[],planning:planningResult.data??[],plannedAccounts:plannedAccountsResult.data??[],categoryRows:categoryRowsResult.data??[],categoryNames:categoryNamesResult.data??[],cardCategoryRows:cardCategoryRowsResult.data??[],recurrenceCategories:recurrenceCategoriesResult.data??[],planningEntries:planningEntriesResult.data??[],planningRecurrences:planningRecurrencesResult.data??[],planningCostCenters:planningCostCentersResult.data??[],planningCards:planningCardsResult.data??[]};}))
  .then(results=>{if(cancelled)return; let bankBalance=0,incomePlanned=0,incomeRealized=0,expensePlanned=0,expenseRealized=0; const categoryExpenseMap=new Map<string,number>(); const entries:HomeEntry[]=[],balanceMovements:HomeBalanceMovement[]=[],budgets:HomeBudgetItem[]=[],bankAccounts:HomeBankAccount[]=[],cards:HomeCard[]=[];
   results.forEach(({company,summary,balances,movements,budget,operational,cardLimits,limitConsumption,budgetControl,budgetPricing,planning,plannedAccounts,categoryRows,categoryNames,cardCategoryRows,recurrenceCategories,planningEntries,planningRecurrences,planningCostCenters,planningCards})=>{const label=companyName(company); const dashboardAccounts=balances.filter(i=>i.status==='active'&&i.includeInDashboard&&(PERSONAL_APP||!isPersonalCompany(label)||isPersonalBalanceAccount(i.name))); const ids=new Set(dashboardAccounts.map(i=>i.accountId)); const consumptionByLimit=new Map(limitConsumption.map(row=>[row.limit_id,row]));
    bankBalance+=dashboardAccounts.reduce((t,i)=>t+i.currentBalance,0); dashboardAccounts.forEach(i=>bankAccounts.push({tenantId:company.tenantId,companyId:company.id,companyName:label,accountId:i.accountId,name:i.name,bankInstitution:i.bankInstitution,currentBalance:i.currentBalance,sortOrder:i.sortOrder}));
    cardLimits.forEach(i=>cards.push({tenantId:company.tenantId,companyId:company.id,companyName:label,cardId:i.cardId,name:cardDisplayName(i.name),creditLimit:i.creditLimit,committedAmount:i.committedAmount,availableLimit:i.availableLimit,sortOrder:i.sortOrder}));
    movements.filter(i=>ids.has(i.accountId)).forEach(i=>balanceMovements.push({movementOn:i.movementOn,signedAmount:i.direction==='inflow'?i.amount:-i.amount}));
    summary.forEach(i=>{if(i.entryType==='income'){incomePlanned+=i.plannedAmount;incomeRealized+=i.realizedAmount;}else{expensePlanned+=i.plannedAmount;expenseRealized+=i.realizedAmount;}});
    const plannedAccountNames=new Map<string,string>();for(const row of plannedAccounts){const account=balances.find(a=>a.accountId===row.planned_account_id);if(account)for(const installment of row.financial_installments??[])plannedAccountNames.set(`financial:${installment.id}`,account.name);}
   
    // The personal app labels its cost center selector as the payer (Paulo/Camila).
    // Never infer the payer from the bank account name.
    const payerByCostCenter=new Map((planningCostCenters).map(c=>[c.id,c.name]));
    const payerByItem=new Map<string,string>();
    for(const e of planningEntries)for(const installment of e.financial_installments??[]){
      const payer=e.cost_center_id?payerByCostCenter.get(e.cost_center_id):null;
      if(payer)payerByItem.set(`financial:${installment.id}`,payer);
    }
    // Recurring personal entries store the selected payment account in their notes.
    // Resolve that existing reference instead of requiring users to choose it again.
    for(const rule of planningRecurrences){
      const accountId=rule.notes?.match(/personal-planned-account:[^:]*::([0-9a-f-]{36})/i)?.[1];
      const account=accountId?balances.find(a=>a.accountId===accountId):undefined;
      if(account)for(const item of planning.filter(i=>i.source_kind==='financial_recurrence_forecast'&&i.item_key.startsWith(`recurring:${rule.id}:`)))plannedAccountNames.set(item.item_key,account.name);
    }
    for(const rule of planningRecurrences){
      const payer=rule.cost_center_id?payerByCostCenter.get(rule.cost_center_id):null;
      if(payer)for(const item of planning.filter(i=>i.source_kind==='financial_recurrence_forecast'&&i.item_key.startsWith(`recurring:${rule.id}:`)))payerByItem.set(item.item_key,payer);
    }
    for(const transaction of planningCards){
      const payer=transaction.cost_center_id?payerByCostCenter.get(transaction.cost_center_id):null;
      if(payer)for(const installment of transaction.card_installments??[])payerByItem.set(`card:${installment.id}`,payer);
    }
    // A card statement uses card:<card_id>:<statement_month>, not an installment ID.
    // Only show a single responsible when every transaction for that card agrees.
    const cardPayers=new Map<string,Set<string>>();
    for(const transaction of planningCards){
      const names=cardPayers.get(transaction.card_id)??new Set<string>();
      names.add(transaction.cost_center_id?payerByCostCenter.get(transaction.cost_center_id)??'__unknown__':'__unknown__');
      cardPayers.set(transaction.card_id,names);
    }
    for(const item of planning.filter(i=>i.source_kind==='card_statement')){
      const cardId=item.item_key.split(':')[1];
      if(!cardId) continue;
      const names=cardPayers.get(cardId);
      if(names?.size===1&&!names.has('__unknown__')){const payer=[...names][0];if(payer)payerByItem.set(item.item_key,payer);}
    }
    const categoryNameById=new Map(categoryNames.map(category=>[category.id,category.name]));categoryRows.forEach(row=>{const e=row.financial_entries;if(e?.entry_type!=='expense')return;const name=(e.category_id?categoryNameById.get(e.category_id):null)?.trim()||'Sem categoria';categoryExpenseMap.set(name,(categoryExpenseMap.get(name)??0)+Number(row.amount));}); cardCategoryRows.forEach(row=>{const name=(row.card_transactions?.category_id?categoryNameById.get(row.card_transactions.category_id):null)?.trim()||'Sem categoria';categoryExpenseMap.set(name,(categoryExpenseMap.get(name)??0)+Number(row.amount));});
    const recurringCategoryById=new Map(recurrenceCategories.map(rule=>[rule.id,rule.category_id])); planning.filter(i=>i.source_kind==='financial_recurrence_forecast'&&i.entry_type==='expense'&&i.due_date.slice(0,7)===month.slice(0,7)).forEach(i=>{const ruleId=i.item_key.split(':')[1]??'';const categoryId=recurringCategoryById.get(ruleId);const name=(categoryId ? categoryNameById.get(categoryId) : undefined)?.trim()||'Sem categoria';categoryExpenseMap.set(name,(categoryExpenseMap.get(name)??0)+Number(i.amount));});
    const recurringRulesById=new Map(planningRecurrences.map(rule=>[rule.id,rule]));
    planning.forEach(i=>{
      let installmentNumber=i.installment_number;
      let installmentCount=i.installment_count;
      if(PERSONAL_APP&&i.source_kind==='financial_recurrence_forecast'){
        const rule=recurringRulesById.get(i.item_key.split(':')[1]??'');
        const match=rule?.notes?.match(/\[personal-installments:(\d+)\/(\d+)\]/);
        if(rule&&match){
          const initial=Number(match[1]);
          const total=Number(match[2]);
          const start=rule.start_date.slice(0,7);
          const current=i.due_date.slice(0,7);
          const monthDelta=(Number(current.slice(0,4))-Number(start.slice(0,4)))*12+Number(current.slice(5,7))-Number(start.slice(5,7));
          if(rule.frequency==='monthly'&&monthDelta>=0&&monthDelta%Math.max(1,rule.interval_count)===0){
            installmentNumber=initial+monthDelta/Math.max(1,rule.interval_count);
            installmentCount=total;
          }else if(monthDelta===0){installmentNumber=initial;installmentCount=total;}
        }
      }
      entries.push({tenantId:company.tenantId,companyId:company.id,installmentId:i.item_key,sourceKind:i.source_kind,entryType:i.entry_type,description:i.description,counterpartyName:i.counterparty_name,accountName:plannedAccountNames.get(i.item_key)??null,responsibleName:payerByItem.get(i.item_key)??null,installmentNumber,installmentCount,dueDate:i.due_date,amount:Number(i.amount),paymentStatus:i.payment_status,companyName:label});
    });
    budget.monthlyBudget.filter(i=>i.costCenterId!==null&&i.plannedManual!==0).forEach(i=>{const limits=operational.budgetLimits.filter(l=>l.status==='active'&&l.costCenterId===i.costCenterId).map(l=>{const consumption=consumptionByLimit.get(l.id);return{id:l.id,categoryName:l.categoryName,limitAmount:l.limitAmount,warningPercent:l.warningPercent,consumedAmount:Number(consumption?.consumed_amount??0),remainingAmount:Number(consumption?.remaining_amount??l.limitAmount),consumedPercent:Number(consumption?.consumed_percent??0)};}); const limitTotal=limits.reduce((t,l)=>t+l.limitAmount,0); const limitConsumed=limits.reduce((t,l)=>t+l.consumedAmount,0); const scopedControl=budgetControl.filter(row=>row.cost_center_id===i.costCenterId); const controlPlannedIncome=scopedControl.reduce((t,row)=>t+Number(row.planned_income??0),0); const pricing=budgetPricing.find(row=>row.cost_center_id===i.costCenterId)??budgetPricing.find(row=>row.cost_center_id===null); const targetNetMargin=Math.max(0,Math.min(99.99,Number(pricing?.target_net_margin_percent??0)||0)); const plannedIncome=limitTotal>0?limitTotal/(1-targetNetMargin/100):controlPlannedIncome; const realizedIncome=scopedControl.reduce((t,row)=>t+Number(row.actual_income??0),0); budgets.push({companyId:company.id,companyName:label,costCenterId:i.costCenterId,costCenterName:i.costCenterName,plannedTotal:i.plannedTotal,realizedTotal:limitTotal>0?limitConsumed:i.realizedTotal,limitTotal,plannedIncome,realizedIncome,limits});});
   });
   entries.sort((a,b)=>a.dueDate.localeCompare(b.dueDate)||a.description.localeCompare(b.description)); bankAccounts.sort((a,b)=>a.tenantId.localeCompare(b.tenantId)||a.sortOrder-b.sortOrder||a.name.localeCompare(b.name)); cards.sort((a,b)=>a.tenantId.localeCompare(b.tenantId)||a.sortOrder-b.sortOrder||a.name.localeCompare(b.name));
   const categoryExpenses=[...categoryExpenseMap].map(([name,amount])=>({name,amount})).sort((a,b)=>b.amount-a.amount); const nextData={month,categoryExpenses,bankBalance,incomePlanned,incomeRealized,expensePlanned,expenseRealized,entries,balanceMovements,budgets,bankAccounts,cards}; writeHomeCache(companyKey,nextData); setState({status:'ready',data:nextData,errorMessage:null});
  }).catch(()=>{if(cancelled)return;setState(previous=>({status:'error',data:previous.data??readHomeCache(companyKey),errorMessage:'Não foi possível atualizar os dados. Verifique a conexão e tente novamente.'}));});
  return()=>{cancelled=true;};
 },[finance,hr,hrOperations,supabase,companyKey,refreshToken,stableCompanies]); return state;
}
