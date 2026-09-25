import { getSupabaseClient } from '../../../shared/infrastructure/supabase/client';

export type AttendanceStatus = 'present' | 'absence' | 'medical_certificate' | 'vacation' | 'day_off' | 'other';

export interface AttendanceRecord {
  id: string;
  tenantId: string;
  companyId: string;
  employmentContractId: string;
  attendanceDate: string;
  status: AttendanceStatus;
  checkIn: string | null;
  checkOut: string | null;
  notes: string | null;
}

type AttendanceDbRow = {
  id: string;
  tenant_id: string;
  company_id: string;
  employment_contract_id: string;
  attendance_date: string;
  status: string;
  check_in: string | null;
  check_out: string | null;
  notes: string | null;
};

type TransferResultRow = { new_contract_id: string };

function isTransferResultRow(value: unknown): value is TransferResultRow {
  if (typeof value !== 'object' || value === null || !('new_contract_id' in value)) return false;
  return typeof (value as Record<string, unknown>).new_contract_id === 'string';
}

function addDays(date: string, days: number): string {
  const value = new Date(`${date}T12:00:00`);
  value.setDate(value.getDate() + days);
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
}

export async function listAttendanceForDate(scopes: readonly { tenantId: string; companyId: string }[], attendanceDate: string): Promise<AttendanceRecord[]> {
  if (scopes.length === 0) return [];
  const client = getSupabaseClient();
  const rows = await Promise.all(scopes.map(async (scope) => {
    const result = await client
      .from('employee_attendance_daily')
      .select('id,tenant_id,company_id,employment_contract_id,attendance_date,status,check_in,check_out,notes')
      .eq('tenant_id', scope.tenantId)
      .eq('company_id', scope.companyId)
      .eq('attendance_date', attendanceDate)
      .returns<AttendanceDbRow[]>();
    if (result.error) throw result.error;
    return result.data ?? [];
  }));
  return rows.flat().map((row) => ({
    id: row.id,
    tenantId: row.tenant_id,
    companyId: row.company_id,
    employmentContractId: row.employment_contract_id,
    attendanceDate: row.attendance_date,
    status: row.status as AttendanceStatus,
    checkIn: row.check_in,
    checkOut: row.check_out,
    notes: row.notes,
  }));
}

export async function saveAttendance(input: {
  tenantId: string;
  companyId: string;
  employmentContractId: string;
  attendanceDate: string;
  status: AttendanceStatus;
  checkIn?: string | null;
  checkOut?: string | null;
  notes?: string | null;
}): Promise<void> {
  const client = getSupabaseClient();
  const row: Record<string, string | null> = {
    tenant_id: input.tenantId,
    company_id: input.companyId,
    employment_contract_id: input.employmentContractId,
    attendance_date: input.attendanceDate,
    status: input.status,
    source_system: 'gestao-3.0',
    updated_at: new Date().toISOString(),
  };

  // Undefined means "do not change". This is important for point records:
  // changing only the attendance status must never erase an existing punch.
  if (input.checkIn !== undefined) row.check_in = input.checkIn;
  if (input.checkOut !== undefined) row.check_out = input.checkOut;
  if (input.notes !== undefined) row.notes = input.notes;

  const result = await client.from('employee_attendance_daily').upsert(row, {
    onConflict: 'tenant_id,company_id,employment_contract_id,attendance_date',
  });
  if (result.error) throw result.error;
}

export async function registerAttendancePunch(input: {
  tenantId: string;
  companyId: string;
  employmentContractId: string;
  attendanceDate: string;
  punch: 'check_in' | 'check_out';
  time: string;
}): Promise<void> {
  const client = getSupabaseClient();
  const existing = await client
    .from('employee_attendance_daily')
    .select('id,check_in,check_out')
    .eq('tenant_id', input.tenantId)
    .eq('company_id', input.companyId)
    .eq('employment_contract_id', input.employmentContractId)
    .eq('attendance_date', input.attendanceDate)
    .maybeSingle();
  if (existing.error) throw existing.error;

  if (input.punch === 'check_out' && !existing.data?.check_in) {
    throw new Error('Registre a entrada antes de registrar a saída.');
  }

  const payload: Record<string, string> = {
    tenant_id: input.tenantId,
    company_id: input.companyId,
    employment_contract_id: input.employmentContractId,
    attendance_date: input.attendanceDate,
    status: 'present',
    source_system: 'gestao-3.0',
    updated_at: new Date().toISOString(),
    [input.punch]: input.time,
  };
  const result = await client.from('employee_attendance_daily').upsert(payload, {
    onConflict: 'tenant_id,company_id,employment_contract_id,attendance_date',
  });
  if (result.error) throw result.error;
}

export async function saveAttendanceBatch(inputs: readonly {
  tenantId: string;
  companyId: string;
  employmentContractId: string;
  attendanceDate: string;
  status: AttendanceStatus;
}[]): Promise<void> {
  if (inputs.length === 0) return;
  const client = getSupabaseClient();
  const rows = inputs.map((input) => ({
    tenant_id: input.tenantId,
    company_id: input.companyId,
    employment_contract_id: input.employmentContractId,
    attendance_date: input.attendanceDate,
    status: input.status,
    source_system: 'gestao-3.0',
    updated_at: new Date().toISOString(),
  }));
  const result = await client.from('employee_attendance_daily').upsert(rows, { onConflict: 'tenant_id,company_id,employment_contract_id,attendance_date' });
  if (result.error) throw result.error;
}

export async function saveAttendancePeriod(input: {
  tenantId: string;
  companyId: string;
  employmentContractId: string;
  startDate: string;
  endDate: string;
  status: 'medical_certificate' | 'vacation';
  notes?: string | null;
}): Promise<void> {
  if (input.endDate < input.startDate) throw new Error('A data final não pode ser anterior à data inicial.');
  const rows: Array<{
    tenant_id: string;
    company_id: string;
    employment_contract_id: string;
    attendance_date: string;
    status: 'medical_certificate' | 'vacation';
    check_in: null;
    check_out: null;
    notes: string | null;
    source_system: string;
    updated_at: string;
  }> = [];
  const updatedAt = new Date().toISOString();
  for (let date = input.startDate; date <= input.endDate; date = addDays(date, 1)) {
    rows.push({
      tenant_id: input.tenantId,
      company_id: input.companyId,
      employment_contract_id: input.employmentContractId,
      attendance_date: date,
      status: input.status,
      check_in: null,
      check_out: null,
      notes: input.notes ?? null,
      source_system: 'gestao-3.0',
      updated_at: updatedAt,
    });
  }
  if (rows.length === 0) return;
  const client = getSupabaseClient();
  const result = await client.from('employee_attendance_daily').upsert(rows, { onConflict: 'tenant_id,company_id,employment_contract_id,attendance_date' });
  if (result.error) throw result.error;
}

export async function transferEmployeeCompany(input: {
  tenantId: string;
  sourceCompanyId: string;
  targetCompanyId: string;
  employmentContractId: string;
  effectiveOn: string;
  targetCostCenterId?: string | null;
  allocationPercent?: number;
}): Promise<string> {
  const client = getSupabaseClient();
  const { data: rawData, error } = await client.rpc('transfer_hr_employee_company', {
    p_tenant_id: input.tenantId,
    p_source_company_id: input.sourceCompanyId,
    p_target_company_id: input.targetCompanyId,
    p_employment_contract_id: input.employmentContractId,
    p_effective_on: input.effectiveOn,
    p_target_cost_center_id: input.targetCostCenterId ?? null,
    p_allocation_percent: input.allocationPercent ?? 100,
  }) as { data: unknown; error: unknown };
  if (error !== null && error !== undefined) {
    throw error instanceof Error ? error : new Error(typeof error === 'string' ? error : 'Falha ao transferir colaborador entre empresas.');
  }
  const row: unknown = Array.isArray(rawData) ? rawData[0] : rawData;
  if (!isTransferResultRow(row)) throw new Error('A transferência foi concluída sem retornar o novo vínculo.');
  return row.new_contract_id;
}


type ComplianceDocumentDbRow={id:string;tenant_id:string;company_id:string;employment_contract_id:string;document_type:string;document_number:string|null;issued_on:string|null;expires_on:string|null;notes:string|null};
type ComplianceOccurrenceDbRow={id:string;tenant_id:string;company_id:string;employment_contract_id:string;occurrence_type:string;starts_on:string;ends_on:string;description:string|null};

export type HrComplianceRecord = {
  id: string;
  tenantId: string;
  companyId: string;
  employmentContractId: string;
  kind: 'aso' | 'nr' | 'vacation';
  title: string;
  startsOn: string | null;
  endsOn: string | null;
  expiresOn: string | null;
  notes: string | null;
};

export async function listHrComplianceRecords(scopes: readonly { tenantId: string; companyId: string }[]): Promise<HrComplianceRecord[]> {
  if (scopes.length === 0) return [];
  const client = getSupabaseClient();
  const groups = await Promise.all(scopes.map(async (scope) => {
    const [documents, occurrences] = await Promise.all([
      client.from('employee_documents').select('id,tenant_id,company_id,employment_contract_id,document_type,document_number,issued_on,expires_on,notes').eq('tenant_id',scope.tenantId).eq('company_id',scope.companyId).in('document_type',['aso','other']).returns<ComplianceDocumentDbRow[]>(),
      client.from('employee_occurrences').select('id,tenant_id,company_id,employment_contract_id,occurrence_type,starts_on,ends_on,description').eq('tenant_id',scope.tenantId).eq('company_id',scope.companyId).eq('status','active').eq('occurrence_type','vacation').returns<ComplianceOccurrenceDbRow[]>(),
    ]);
    if (documents.error) throw documents.error;
    if (occurrences.error) throw occurrences.error;
    const documentRows=(documents.data??[]).map((row):HrComplianceRecord=>({id:row.id,tenantId:row.tenant_id,companyId:row.company_id,employmentContractId:row.employment_contract_id,kind:row.document_type==='aso'?'aso':'nr',title:row.document_type==='aso'?'ASO':(row.document_number||'NR / treinamento'),startsOn:row.issued_on,endsOn:null,expiresOn:row.expires_on,notes:row.notes}));
    const occurrenceRows=(occurrences.data??[]).map((row):HrComplianceRecord=>({id:row.id,tenantId:row.tenant_id,companyId:row.company_id,employmentContractId:row.employment_contract_id,kind:'vacation',title:'Férias',startsOn:row.starts_on,endsOn:row.ends_on,expiresOn:null,notes:row.description}));
    return [...documentRows,...occurrenceRows];
  }));
  return groups.flat().sort((a,b)=>(b.startsOn??b.expiresOn??'').localeCompare(a.startsOn??a.expiresOn??''));
}

export async function saveHrComplianceRecord(input: {
  tenantId:string; companyId:string; employmentContractId:string; kind:'aso'|'nr'|'vacation';
  title?:string; startsOn:string; endsOn?:string|null; expiresOn?:string|null; notes?:string|null;
}): Promise<void> {
  const client=getSupabaseClient();
  if(input.kind==='vacation'){
    const result=await client.from('employee_occurrences').insert({tenant_id:input.tenantId,company_id:input.companyId,employment_contract_id:input.employmentContractId,occurrence_type:'vacation',starts_on:input.startsOn,ends_on:input.endsOn||input.startsOn,excused:true,payroll_effect:'none',description:input.notes??null,status:'active'});
    if(result.error)throw result.error;
    await saveAttendancePeriod({tenantId:input.tenantId,companyId:input.companyId,employmentContractId:input.employmentContractId,startDate:input.startsOn,endDate:input.endsOn||input.startsOn,status:'vacation',notes:input.notes??null});
    return;
  }
  const result=await client.from('employee_documents').insert({tenant_id:input.tenantId,company_id:input.companyId,employment_contract_id:input.employmentContractId,document_type:input.kind==='aso'?'aso':'other',document_number:input.kind==='nr'?(input.title||'NR / treinamento'):null,issued_on:input.startsOn,expires_on:input.expiresOn??null,status:'valid',notes:input.notes??null});
  if(result.error)throw result.error;
}


type EpiDeliveryDbRow={id:string;tenant_id:string;company_id:string;employment_contract_id:string;epi_name:string;quantity:number;delivered_on:string;ca_number:string|null;notes:string|null;created_at:string};

export type HrEpiDelivery={
  id:string; tenantId:string; companyId:string; employmentContractId:string;
  epiName:string; quantity:number; deliveredOn:string; caNumber:string|null; notes:string|null; createdAt:string;
};

export async function listEpiDeliveries(scopes: readonly {tenantId:string;companyId:string}[]):Promise<HrEpiDelivery[]>{
  if(scopes.length===0)return[];
  const client=getSupabaseClient();
  const groups=await Promise.all(scopes.map(async scope=>{
    const result=await client.from('employee_epi_deliveries')
      .select('id,tenant_id,company_id,employment_contract_id,epi_name,quantity,delivered_on,ca_number,notes,created_at')
      .eq('tenant_id',scope.tenantId).eq('company_id',scope.companyId)
      .order('delivered_on',{ascending:false}).order('created_at',{ascending:false})
      .returns<EpiDeliveryDbRow[]>();
    if(result.error)throw result.error;
    return result.data??[];
  }));
  return groups.flat().map(row=>({id:row.id,tenantId:row.tenant_id,companyId:row.company_id,employmentContractId:row.employment_contract_id,epiName:row.epi_name,quantity:row.quantity,deliveredOn:row.delivered_on,caNumber:row.ca_number,notes:row.notes,createdAt:row.created_at}))
    .sort((a,b)=>b.deliveredOn.localeCompare(a.deliveredOn)||b.createdAt.localeCompare(a.createdAt));
}

export async function saveEpiDelivery(input:{tenantId:string;companyId:string;employmentContractId:string;epiName:string;quantity:number;deliveredOn:string;caNumber?:string|null;notes?:string|null}):Promise<void>{
  const epiName=input.epiName.trim();
  if(!epiName)throw new Error('Informe o EPI entregue.');
  if(!Number.isInteger(input.quantity)||input.quantity<=0)throw new Error('Informe uma quantidade válida.');
  const client=getSupabaseClient();
  const result=await client.from('employee_epi_deliveries').insert({
    tenant_id:input.tenantId,company_id:input.companyId,employment_contract_id:input.employmentContractId,
    epi_name:epiName,quantity:input.quantity,delivered_on:input.deliveredOn,ca_number:input.caNumber?.trim()||null,notes:input.notes?.trim()||null
  });
  if(result.error)throw result.error;
}


type BankHourDbRow={id:string;tenant_id:string;company_id:string;employment_contract_id:string;occurred_on:string;minutes:number;description:string|null;created_at:string};
export type HrBankHourMovement={id:string;tenantId:string;companyId:string;employmentContractId:string;occurredOn:string;minutes:number;description:string|null;createdAt:string};

export async function listBankHourMovements(scopes:readonly {tenantId:string;companyId:string}[],competenceMonth:string):Promise<HrBankHourMovement[]>{
 if(!scopes.length)return[];const client=getSupabaseClient();const start=competenceMonth.slice(0,7)+'-01';const end=new Date(Number(start.slice(0,4)),Number(start.slice(5,7)),0);const endDate=`${end.getFullYear()}-${String(end.getMonth()+1).padStart(2,'0')}-${String(end.getDate()).padStart(2,'0')}`;
 const groups=await Promise.all(scopes.map(async scope=>{const result=await client.from('employee_bank_hour_movements').select('id,tenant_id,company_id,employment_contract_id,occurred_on,minutes,description,created_at').eq('tenant_id',scope.tenantId).eq('company_id',scope.companyId).gte('occurred_on',start).lte('occurred_on',endDate).order('occurred_on',{ascending:false}).returns<BankHourDbRow[]>();if(result.error)throw result.error;return result.data??[];}));
 return groups.flat().map(r=>({id:r.id,tenantId:r.tenant_id,companyId:r.company_id,employmentContractId:r.employment_contract_id,occurredOn:r.occurred_on,minutes:r.minutes,description:r.description,createdAt:r.created_at}));
}
export async function saveBankHourMovement(input:{tenantId:string;companyId:string;employmentContractId:string;occurredOn:string;minutes:number;description?:string|null}):Promise<void>{if(!Number.isInteger(input.minutes)||input.minutes===0)throw new Error('Informe minutos positivos para crédito ou negativos para débito.');const result=await getSupabaseClient().from('employee_bank_hour_movements').insert({tenant_id:input.tenantId,company_id:input.companyId,employment_contract_id:input.employmentContractId,occurred_on:input.occurredOn,minutes:input.minutes,description:input.description?.trim()||null});if(result.error)throw result.error;}
export async function closeBankHourCompetence(input:{tenantId:string;companyId:string;employmentContractId:string;competenceMonth:string}):Promise<void>{const result=await getSupabaseClient().from('employee_bank_hour_closings').upsert({tenant_id:input.tenantId,company_id:input.companyId,employment_contract_id:input.employmentContractId,competence_month:input.competenceMonth.slice(0,7)+'-01'},{onConflict:'tenant_id,company_id,employment_contract_id,competence_month'});if(result.error)throw result.error;}
