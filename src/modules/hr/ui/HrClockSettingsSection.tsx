import { useEffect, useState } from 'react';
import type { CompanySummary } from '../../platform/domain/AccessContext';
import { listClockWorks, listClockWorksites, saveClockWorksite, type ClockWorkOption, type ClockWorksite } from '../infrastructure/EmployeeClockAdminService';
import { Button } from '../../../shared/ui/Button';
import { Card } from '../../../shared/ui/Card';

export function HrClockSettingsSection({ companies }: { companies: readonly CompanySummary[] }) {
  const [companyId, setCompanyId] = useState(companies[0]?.id ?? '');
  const [worksites, setWorksites] = useState<ClockWorksite[]>([]);
  const [works, setWorks] = useState<ClockWorkOption[]>([]);
  const [workId, setWorkId] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [radius, setRadius] = useState('100');
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [locating, setLocating] = useState(false);
  const [feedback, setFeedback] = useState('');
  const selectedCompany = companies.find(company => company.id === companyId);
  useEffect(() => {
    let active = true;
    setWorksites([]); setWorks([]); setWorkId(''); setFeedback('');
    if (!companyId) return;
    void listClockWorks(companyId).then(items => { if (active) setWorks(items); }).catch(error => { if (active) setFeedback(error instanceof Error ? error.message : 'Erro ao carregar cadastro de obras.'); });
    void listClockWorksites(companyId).then(items => {
      if (active) setWorksites(items);
    }).catch(error => { if (active) setFeedback(error instanceof Error ? error.message : 'Erro ao carregar obras.'); });
    return () => { active = false; };
  }, [companyId]);
  const edit = (site: ClockWorksite) => {
    setWorkId(site.work_id); setLatitude(String(site.latitude)); setLongitude(String(site.longitude));
    setRadius(String(site.radius_m)); setEnabled(site.enabled); setFeedback('');
  };
  const capturePosition = () => {
    if (!navigator.geolocation) { setFeedback('Este dispositivo não disponibiliza GPS.'); return; }
    setLocating(true); setFeedback('');
    navigator.geolocation.getCurrentPosition(position => {
      setLatitude(position.coords.latitude.toFixed(7));
      setLongitude(position.coords.longitude.toFixed(7));
      setLocating(false);
      setFeedback(`Localização capturada com precisão aproximada de ${Math.round(position.coords.accuracy)} m. Confira o ponto antes de salvar.`);
    }, error => {
      setLocating(false);
      setFeedback(error.code === 1 ? 'Autorize o acesso à localização.' : 'Não foi possível obter a localização. Tente novamente.');
    }, { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 });
  };
  const save = async () => {
    if (!selectedCompany || !works.some(work => work.id === workId)) { setFeedback('Selecione uma obra cadastrada.'); return; }
    if (!latitude.trim() || !longitude.trim() || !radius.trim()) { setFeedback('Preencha latitude, longitude e raio.'); return; }
    const lat = Number(latitude.replace(',', '.'));
    const lon = Number(longitude.replace(',', '.'));
    const meters = Number(radius);
    if (!Number.isFinite(lat) || lat < -90 || lat > 90 || !Number.isFinite(lon) || lon < -180 || lon > 180 || !Number.isInteger(meters) || meters < 20 || meters > 2000) {
      setFeedback('Informe coordenadas válidas e raio inteiro entre 20 e 2.000 metros.'); return;
    }
    setBusy(true); setFeedback('');
    try {
      await saveClockWorksite({
        tenant_id: selectedCompany.tenantId, company_id: companyId, work_id: workId.trim(),
        latitude: lat, longitude: lon, radius_m: meters, enabled
      });
      setWorksites(await listClockWorksites(companyId));
      setFeedback('Perímetro salvo com sucesso.');
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Não foi possível salvar.');
    } finally { setBusy(false); }
  };
  return <div className="hr-workspace__content">
    <Card title="Ponto por GPS — obras" description="Configuração restrita ao RH autorizado. O funcionário só marca ponto em obra habilitada.">
      <div className="hr-workspace__form">
        <label>Empresa <select value={companyId} onChange={event => setCompanyId(event.target.value)}>{companies.map(company => <option key={company.id} value={company.id}>{company.tradeName || company.legalName}</option>)}</select></label>
        <label>Obra cadastrada <select value={workId} onChange={event => setWorkId(event.target.value)}><option value="">Selecione uma obra</option>{works.map(work => <option key={work.id} value={work.id}>{work.name}</option>)}</select></label>
        <label>Latitude <input inputMode="decimal" value={latitude} onChange={event => setLatitude(event.target.value)} placeholder="-22.000000" /></label>
        <label>Longitude <input inputMode="decimal" value={longitude} onChange={event => setLongitude(event.target.value)} placeholder="-47.000000" /></label>
        <Button variant="secondary" disabled={locating || busy} onClick={capturePosition}>{locating ? 'Obtendo GPS…' : 'Usar minha localização atual'}</Button>
        <p>Use este botão somente quando estiver fisicamente no ponto de referência da obra. A localização capturada precisa ser conferida pelo administrador.</p>
        <label>Raio permitido (metros) <input type="number" min="20" max="2000" value={radius} onChange={event => setRadius(event.target.value)} /></label>
        <label><input type="checkbox" checked={enabled} onChange={event => setEnabled(event.target.checked)} /> Habilitar marcação nesta obra</label>
        <Button disabled={busy || !companyId} onClick={() => void save()}>{busy ? 'Salvando…' : 'Salvar perímetro GPS'}</Button>
        {feedback && <p role="status">{feedback}</p>}
      </div>
    </Card>
    <Card title="Obras configuradas">
      {worksites.length === 0 ? <p>Nenhum perímetro cadastrado nesta empresa.</p> :
        <ul>{worksites.map(site => <li key={site.id}>
          <strong>{works.find(work => work.id === site.work_id)?.name ?? site.work_id}</strong> · {site.radius_m} m · {site.enabled ? 'Habilitada' : 'Desabilitada'}
          {' '}<Button variant="secondary" onClick={() => edit(site)}>Editar</Button>
        </li>)}</ul>}
    </Card>
  </div>;
}
