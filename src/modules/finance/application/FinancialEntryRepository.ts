import type {
  CreateSingleFinancialEntry,
  CreatedSingleFinancialEntry,
  FinancialEntryListItem,
  UpdateFinancialEntry,
} from '../domain/entries';
import type { CompanyScope } from '../domain/registries';

export type InstallmentMaintenanceScope = 'single' | 'following';
export interface UpdateInstallmentScopeInput extends CompanyScope {
  installmentId: string;
  scope: InstallmentMaintenanceScope;
  description: string;
  counterpartyName: string | null;
  categoryId: string;
  costCenterId: string | null;
  dueDate: string;
  amount: number;
  notes: string | null;
}

export interface FinancialEntryRepository {
  createSingle(input: CreateSingleFinancialEntry): Promise<CreatedSingleFinancialEntry>;
  update(input: UpdateFinancialEntry): Promise<void>;
  updateInstallmentScope(input: UpdateInstallmentScopeInput): Promise<void>;
  deleteUnsettled(scope: CompanyScope, entryId: string): Promise<void>;
  deleteInstallmentScope(scope: CompanyScope, installmentId: string, maintenanceScope: InstallmentMaintenanceScope): Promise<void>;
  setPlannedAccount(scope: CompanyScope, entryId: string, accountId: string | null, accountCompanyId?: string): Promise<void>;
  list(scope: CompanyScope): Promise<readonly FinancialEntryListItem[]>;
}
