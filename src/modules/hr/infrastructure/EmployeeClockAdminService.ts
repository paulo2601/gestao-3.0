import { getSupabaseClient } from '../../../shared/infrastructure/supabase/client';

export interface ClockWorksite {
  id: string;
  tenant_id: string;
  company_id: string;
  work_id: string;
  latitude: number;
  longitude: number;
  radius_m: number;
  enabled: boolean;
}
export interface ClockAccess {
  id: string;
  tenant_id: string;
  company_id: string;
  employment_contract_id: string;
  user_id: string;
  work_id: string;
  enabled: boolean;
}
export async function listClockWorksites(companyId: string): Promise<ClockWorksite[]> {
  const response = await getSupabaseClient().rpc('employee_clock_admin_list_worksites', { p_company_id: companyId });
  if (response.error) throw new Error(response.error.message);
  return (response.data ?? []) as ClockWorksite[];
}
export async function saveClockWorksite(input: Omit<ClockWorksite, 'id'>): Promise<void> {
  if (!Number.isFinite(input.latitude) || input.latitude < -90 || input.latitude > 90) throw new Error('Latitude inválida.');
  if (!Number.isFinite(input.longitude) || input.longitude < -180 || input.longitude > 180) throw new Error('Longitude inválida.');
  if (!Number.isInteger(input.radius_m) || input.radius_m < 20 || input.radius_m > 2000) throw new Error('Raio permitido: 20 a 2.000 metros.');
  const response = await getSupabaseClient().rpc('employee_clock_admin_save_worksite', {
    p_tenant_id: input.tenant_id, p_company_id: input.company_id, p_work_id: input.work_id,
    p_latitude: input.latitude, p_longitude: input.longitude, p_radius_m: input.radius_m,
    p_enabled: input.enabled
  });
  if (response.error) throw new Error(response.error.message);
}
export async function listClockAccess(companyId: string): Promise<ClockAccess[]> {
  const response = await getSupabaseClient().rpc('employee_clock_admin_list_access', { p_company_id: companyId });
  if (response.error) throw new Error(response.error.message);
  return (response.data ?? []) as ClockAccess[];
}
export async function saveClockAccess(input: Omit<ClockAccess, 'id'>): Promise<void> {
  const response = await getSupabaseClient().rpc('employee_clock_admin_save_access', {
    p_tenant_id: input.tenant_id, p_company_id: input.company_id,
    p_employment_contract_id: input.employment_contract_id, p_user_id: input.user_id,
    p_work_id: input.work_id, p_enabled: input.enabled
  });
  if (response.error) throw new Error(response.error.message);
}

export interface ClockWorkOption { id: string; name: string; }
export async function listClockWorks(companyId: string): Promise<ClockWorkOption[]> {
  const response = await getSupabaseClient().rpc('employee_clock_admin_list_works', { p_company_id: companyId });
  if (response.error) throw new Error(response.error.message);
  return (response.data ?? []) as ClockWorkOption[];
}
