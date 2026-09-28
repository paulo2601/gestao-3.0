import { useCallback, useEffect, useMemo, useState } from 'react';
import type { AuthUser } from '../application/AuthGateway';
import type { AccessContext, CompanySummary } from '../domain/AccessContext';
import {
  ALL_COMPANIES_ID,
  flattenAuthorizedCompanies,
  isCompanyAuthorized,
  resolveActiveCompanyId,
} from '../application/companyContext';
import { SupabaseAccessRepository } from '../infrastructure/SupabaseAccessRepository';
import { SupabaseAuthGateway } from '../infrastructure/SupabaseAuthGateway';

type SessionStatus = 'loading' | 'anonymous' | 'ready' | 'error';

export interface PlatformSession {
  status: SessionStatus;
  user: AuthUser | null;
  contexts: readonly AccessContext[];
  companies: readonly CompanySummary[];
  activeCompanyId: string | null;
  errorMessage: string | null;
  noticeMessage: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  bootstrapFirstOwner: (input: { email: string; password: string; bootstrapCode: string; tenantName: string; companyName: string; }) => Promise<void>;
  signOut: () => Promise<void>;
  selectCompany: (companyId: string) => void;
}

const ACCESS_CACHE_VERSION = 'v1';
function companyStorageKey(userId: string): string { return `gestao.activeCompanyId:${userId}`; }
function accessStorageKey(userId: string): string { return `gestao.accessContexts:${ACCESS_CACHE_VERSION}:${userId}`; }
function readStoredContexts(userId: string): readonly AccessContext[] {
  try {
    const raw = window.localStorage.getItem(accessStorageKey(userId));
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null || !('contexts' in parsed)) return [];
    const candidate: unknown = (parsed as { contexts?: unknown }).contexts;
    if (!Array.isArray(candidate)) return [];
    return candidate.filter((context): context is AccessContext => {
      if (typeof context !== 'object' || context === null) return false;
      const value = context as Partial<AccessContext>;
      return typeof value.tenant === 'object' && value.tenant !== null && Array.isArray(value.companies);
    });
  } catch { return []; }
}
function storeContexts(userId: string, nextContexts: readonly AccessContext[]): void {
  try { window.localStorage.setItem(accessStorageKey(userId), JSON.stringify({ contexts: nextContexts, savedAt: Date.now() })); } catch { /* cache é apenas aceleração */ }
}
function clearStoredContexts(userId: string): void {
  try { window.localStorage.removeItem(accessStorageKey(userId)); } catch { /* armazenamento indisponível */ }
}
function readStoredCompany(userId: string): string | null {
  try { return window.localStorage.getItem(companyStorageKey(userId)); } catch { return null; }
}
function storeCompany(userId: string, companyId: string): void {
  try { window.localStorage.setItem(companyStorageKey(userId), companyId); } catch { /* armazenamento indisponível */ }
}

export function usePlatformSession(): PlatformSession {
  const authGateway = useMemo(() => new SupabaseAuthGateway(), []);
  const accessRepository = useMemo(() => new SupabaseAccessRepository(), []);
  const [status, setStatus] = useState<SessionStatus>('loading');
  const [user, setUser] = useState<AuthUser | null>(null);
  const [contexts, setContexts] = useState<readonly AccessContext[]>([]);
  const [activeCompanyId, setActiveCompanyId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [noticeMessage, setNoticeMessage] = useState<string | null>(null);

  const hydrateAccess = useCallback(async () => {
    const currentUser = await authGateway.getCurrentUser();
    if (!currentUser) { setUser(null); setContexts([]); setActiveCompanyId(null); setStatus('anonymous'); return; }
    const cachedContexts = readStoredContexts(currentUser.id);
    const cachedCompanies = flattenAuthorizedCompanies(cachedContexts);
    if (cachedCompanies.length > 0) {
      const storedCompanyId = readStoredCompany(currentUser.id);
      const cachedCompanyId = resolveActiveCompanyId(cachedCompanies, storedCompanyId);
      setUser(currentUser); setContexts(cachedContexts); setActiveCompanyId(cachedCompanyId);
      setErrorMessage(null); setNoticeMessage(null); setStatus('ready');
    }

    const nextContexts = await accessRepository.listContextsForCurrentUser();
    const nextCompanies = flattenAuthorizedCompanies(nextContexts);
    if (nextCompanies.length === 0) {
      clearStoredContexts(currentUser.id);
      await authGateway.signOut(); setUser(null); setContexts([]); setActiveCompanyId(null);
      setErrorMessage('Usuário autenticado, mas sem empresa autorizada.'); setStatus('anonymous'); return;
    }
    storeContexts(currentUser.id, nextContexts);
    const storedCompanyId = readStoredCompany(currentUser.id);
    const resolvedCompanyId = resolveActiveCompanyId(nextCompanies, storedCompanyId);
    setUser(currentUser); setContexts(nextContexts); setActiveCompanyId(resolvedCompanyId);
    if (resolvedCompanyId) storeCompany(currentUser.id, resolvedCompanyId);
    setErrorMessage(null); setNoticeMessage(null); setStatus('ready');
  }, [accessRepository, authGateway]);

  useEffect(() => { void hydrateAccess().catch(() => { setErrorMessage('Não foi possível carregar a sessão.'); setStatus('error'); }); }, [hydrateAccess]);

  const signIn = useCallback(async (email: string, password: string) => {
    setStatus('loading'); setErrorMessage(null); setNoticeMessage(null);
    try { await authGateway.signInWithPassword(email, password); await hydrateAccess(); }
    catch { setErrorMessage('E-mail ou senha inválidos, ou acesso indisponível.'); setStatus('anonymous'); }
  }, [authGateway, hydrateAccess]);

  const bootstrapFirstOwner = useCallback(async (input: { email: string; password: string; bootstrapCode: string; tenantName: string; companyName: string; }) => {
    setStatus('loading'); setErrorMessage(null); setNoticeMessage(null);
    try {
      const result = await authGateway.signUpFirstOwner(input);
      if (result.sessionCreated) { await hydrateAccess(); return; }
      setNoticeMessage('Primeiro acesso criado. Confirme o e-mail e depois entre normalmente.'); setStatus('anonymous');
    } catch { setErrorMessage('Não foi possível criar o primeiro acesso. Verifique o código inicial e os dados informados.'); setStatus('anonymous'); }
  }, [authGateway, hydrateAccess]);

  const signOut = useCallback(async () => {
    if (user) clearStoredContexts(user.id);
    await authGateway.signOut(); setUser(null); setContexts([]); setActiveCompanyId(null); setErrorMessage(null); setNoticeMessage(null); setStatus('anonymous');
  }, [authGateway, user]);

  const companies = flattenAuthorizedCompanies(contexts);
  const selectCompany = useCallback((companyId: string) => {
    if (companyId === ALL_COMPANIES_ID && companies.length > 1) {
      setActiveCompanyId(ALL_COMPANIES_ID);
      if (user) storeCompany(user.id, ALL_COMPANIES_ID);
      return;
    }
    if (isCompanyAuthorized(companies, companyId)) {
      setActiveCompanyId(companyId);
      if (user) storeCompany(user.id, companyId);
    }
  }, [companies, user]);

  return { status, user, contexts, companies, activeCompanyId, errorMessage, noticeMessage, signIn, bootstrapFirstOwner, signOut, selectCompany };
}
