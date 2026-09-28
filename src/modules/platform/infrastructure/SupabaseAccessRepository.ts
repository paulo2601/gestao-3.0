import { getSupabaseClient } from '../../../shared/infrastructure/supabase/client';
import type { AccessRepository } from '../application/AccessRepository';
import type {
  AccessContext,
  CompanySummary,
  TenantMembership,
  TenantRole,
} from '../domain/AccessContext';

interface TenantMembershipRow {
  tenant_id: string;
  role: TenantRole;
}

interface CompanyRow {
  id: string;
  tenant_id: string;
  legal_name: string;
  trade_name: string | null;
}

function toTenantMembership(row: TenantMembershipRow): TenantMembership {
  return {
    tenantId: row.tenant_id,
    role: row.role,
  };
}

function toCompanySummary(row: CompanyRow): CompanySummary {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    legalName: row.legal_name,
    tradeName: row.trade_name,
  };
}

export class SupabaseAccessRepository implements AccessRepository {
  async listContextsForCurrentUser(): Promise<readonly AccessContext[]> {
    const client = getSupabaseClient();
    const { data: sessionData, error: sessionError } = await client.auth.getSession();

    if (sessionError) {
      throw sessionError;
    }

    const user = sessionData.session?.user;
    if (!user) {
      return [];
    }

    const { data: membershipRows, error: membershipsError } = await client
      .from('tenant_memberships')
      .select('tenant_id, role')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .returns<TenantMembershipRow[]>();

    if (membershipsError) {
      throw membershipsError;
    }

    const memberships = membershipRows.map(toTenantMembership);

    if (memberships.length === 0) {
      return [];
    }

    const tenantIds = memberships.map((membership) => membership.tenantId);
    const { data: companyRows, error: companiesError } = await client
      .from('companies')
      .select('id, tenant_id, legal_name, trade_name')
      .in('tenant_id', tenantIds)
      .eq('status', 'active')
      .returns<CompanyRow[]>();

    if (companiesError) {
      throw companiesError;
    }

    const companies = companyRows.map(toCompanySummary);

    return memberships.map((tenant) => ({
      tenant,
      companies: companies.filter((company) => company.tenantId === tenant.tenantId),
    }));
  }
}
