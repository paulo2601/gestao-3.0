import { useEffect, useState } from 'react';
import type { CompanySummary } from '../../platform/domain/AccessContext';
import { listClockAccess, listClockWorksites, saveClockAccess, type ClockAccess, type ClockWorksite } from '../infrastructure/EmployeeClockAdminService';
import { Button } from '../../../shared/ui/Button';
import { Card } from '../../../shared/ui/Card';

type Employee = { employmentContractId: string; fullName: string; companyId: string; contractStatus: string };
export function HrClockAccessSection({ companies, employees }: { companies: readonly CompanySummary[]; employees: Employee[] }) {
  const [companyId, setCompanyId] = useState(companies[0]?.id ?? '');
  const [access, setAccess] = useState<ClockAccess[]>([]);
  const [sites, setSites] = useState<ClockWorksite[]>([]);
  const [contractId, setContractId] = useState('');
  const [userId, setUserId] = useState('');
  const [workId, setWorkId] = useState('');
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState('');
  const company = companies.find(item => item.id === companyId);
  const eligible = employees.filter(item => item.companyId === companyId && item.contractStatus === 'active');
  useEffect(() => {
    let active = true;
    setAccess([]); setSites([]); setContractId(''); setWorkId(''); setUserId(''); setFeedback('');
    if (!companyId) return;
    void Promise.all([listClockAccess(companyId), listClockWorksites(companyId)]).then(([a, w]) => {
      if (active) { setAccess(a); setSites(w); }
    }).catch(error => { if (active) setFeedback(error instanceof Error ? error.message : 'Não foi possível consultar acessos.'); });
    return () => { active = false; };
  }, [companyId]);
  const save = async () => {
    if (!company || !eligible.some(item => item.employmentContractId === contractId) || !sites.some(site => site.work_id === workId && (site.enabled || !enabled))) {
      setFeedback('Selecione um colaborador ativo e uma obra válida. Para habilitar acesso, a obra deve estar habilitada.'); return;
    }
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)) {
      setFeedback('Informe um identificador válido da conta de login do colaborador.'); return;
    }
    setBusy(true); setFeedback('');
    try {
      await saveClockAccess({ tenant_id: company.tenantId, company_id: companyId, employment_contract_id: contractId,
        user_id: userId, work_id: workId, enabled });
      setAccess(await listClockAccess(companyId));
      setFeedback('Vínculo de ponto atualizado.');
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Não foi possível atualizar o vínculo.');
    } finally { setBusy(false); }
  };
  return <div className="hr-workspace__content">
    <Card title="Ponto GPS — acesso do colaborador" description="Libere apenas contas individuais previamente criadas e vinculadas ao contrato.">
      <div className="hr-workspace__form">
        <label>Empresa <select value={companyId} onChange={event => setCompanyId(event.target.value)}>{companies.map(item =>
          <option key={item.id} value={item.id}>{item.tradeName || item.legalName}</option>)}</select></label>
        <label>Colaborador ativo <select value={contractId} onChange={event => setContractId(event.target.value)}><option value="">Selecione</option>
          {eligible.map(item => <option key={item.employmentContractId} value={item.employmentContractId}>{item.fullName}</option>)}</select></label>
        <label>Conta de login (ID de autenticação) <input value={userId} onChange={event => setUserId(event.target.value)} placeholder="Identificador UUID da conta" /></label>
        <label>Obra autorizada <select value={workId} onChange={event => setWorkId(event.target.value)}><option value="">Selecione</option>
          {sites.filter(site => site.enabled || (!enabled && site.work_id === workId)).map(site => <option key={site.id} value={site.work_id}>{site.work_id} ({site.radius_m} m)</option>)}</select></label>
        <label><input type="checkbox" checked={enabled} onChange={event => setEnabled(event.target.checked)} /> Acesso habilitado</label>
        <Button disabled={busy || !companyId} onClick={() => void save()}>{busy ? 'Salvando…' : 'Salvar autorização'}</Button>
        {feedback && <p role="status">{feedback}</p>}
      </div>
    </Card>
    <Card title="Acessos cadastrados">
      {access.length === 0 ? <p>Nenhum colaborador autorizado.</p> : <ul>{access.map(item => <li key={item.id}>
        <strong>{employees.find(employee => employee.employmentContractId === item.employment_contract_id)?.fullName ?? item.employment_contract_id}</strong>
        {' · '}{item.enabled ? 'Habilitado' : 'Bloqueado'}
        {' '}<Button variant="secondary" onClick={() => {
          setContractId(item.employment_contract_id); setUserId(item.user_id); setWorkId(item.work_id); setEnabled(item.enabled);
        }}>Editar</Button>
      </li>)}</ul>}
    </Card>
  </div>;
}
