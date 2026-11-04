import { useEffect, useMemo, useState } from 'react';
import { Button } from '../../../shared/ui/Button';
import { Dialog } from '../../../shared/ui/Dialog';
import { EmptyState, LoadingState } from '../../../shared/ui/Feedback';
import { loadAddendumSheetLines, type AddendumSheetLine } from '../infrastructure/EngineeringContractModalRepository';

interface Props {
  open: boolean;
  scope: { tenantId: string; companyId: string };
  addendumId: string;
  addendumNumber: string;
  statusLabel: string;
  onClose: () => void;
  onEditLine: () => void;
}

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const quantity = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 3 });

export function EngineeringAddendumSheetDialog({ open, scope, addendumId, addendumNumber, statusLabel, onClose, onEditLine }: Props) {
  const [rows, setRows] = useState<AddendumSheetLine[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let active = true;
    setLoading(true);
    setErrorMessage(null);
    void loadAddendumSheetLines(scope, addendumId)
      .then(data => { if (active) setRows(data); })
      .catch(error => {
        if (active) setErrorMessage(error instanceof Error ? error.message : 'Não foi possível carregar a planilha do aditivo.');
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [open, scope, addendumId]);

  const totalValue = useMemo(() => rows.reduce((sum, row) => sum + row.quantityDelta * row.unitPrice, 0), [rows]);
  const normalized = search.trim().toLocaleLowerCase('pt-BR');
  const filtered = useMemo(() => rows.filter(row => !normalized || `${row.description} ${row.unit} ${row.quantityDelta}`.toLocaleLowerCase('pt-BR').includes(normalized)), [rows, normalized]);

  return (
    <Dialog
      open={open}
      title={`Aditivo ${addendumNumber}`}
      description={`${statusLabel} · planilha separada da base contratual.`}
      onClose={onClose}
      onBack={onClose}
      footer={<Button onClick={onEditLine}>＋ Adicionar / editar item</Button>}
    >
      {loading ? <LoadingState label="Carregando serviços do aditivo…" /> : errorMessage ? (
        <EmptyState title="Não foi possível carregar" message={errorMessage} />
      ) : (
        <div className="engineering-sheet engineering-sheet--modal engineering-sheet--approved"><div className="engineering-sheet__approved-summary"><div><small>Serviços cadastrados</small><strong>{rows.length}</strong></div><div><small>Valor total do aditivo</small><strong>{currency.format(totalValue)}</strong></div><div><small>Itens exibidos</small><strong>{filtered.length}</strong></div></div>
          <div className="engineering-sheet__live-filter">
            <span aria-hidden="true">⌕</span>
            <input autoFocus value={search} onChange={event => setSearch(event.target.value)} placeholder="Filtrar serviços enquanto digita…" aria-label={`Filtrar serviços do aditivo ${addendumNumber}`} />
            {search && <button type="button" onClick={() => setSearch('')} aria-label="Limpar filtro">×</button>}
            <small>{filtered.length} de {rows.length}</small>
          </div>
          <div className="engineering-sheet__table-wrap engineering-sheet__table-wrap--detail">
            <table className="engineering-sheet__table engineering-sheet__table--services">
              <thead><tr><th>#</th><th>Serviço</th><th>Unidade</th><th>Valor unit.</th><th>Quantitativo</th><th>Valor total</th><th>Ações</th></tr></thead>
              <tbody>{filtered.map((row, index) => <tr key={row.id}>
                <td>{String(index + 1).padStart(3, '0')}</td>
                <td><strong>{row.description}</strong></td>
                <td>{row.unit}</td>
                <td>{currency.format(row.unitPrice)}</td>
                <td><strong>{quantity.format(row.quantityDelta)}</strong></td><td><strong>{currency.format(row.quantityDelta * row.unitPrice)}</strong></td>
                <td><Button size="sm" variant="tertiary" onClick={onEditLine}>Editar quantitativo</Button></td>
              </tr>)}</tbody>
            </table>
            {filtered.length === 0 && <EmptyState title="Nenhum serviço" message={search ? 'Nenhum serviço corresponde ao filtro digitado.' : 'Este aditivo ainda não possui itens.'} />}
          </div>
        </div>
      )}
    </Dialog>
  );
}
