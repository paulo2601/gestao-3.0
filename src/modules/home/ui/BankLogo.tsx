import { useState } from 'react';
import type { FinancialBankInstitution } from '../../finance/domain/registries';

const icons: Partial<Record<FinancialBankInstitution, string>> = {
  santander: 'santander', nubank: 'nubank', itau: 'itau', inter: 'bancointer',
  caixa: 'caixa', bradesco: 'bradesco', bb: 'bancodobrasil',
  mercadopago: 'mercadopago', sicredi: 'sicredi', c6: 'c6bank', sicoob: 'sicoob',
};
export function BankLogo({ institution, name, fallback }: { institution: FinancialBankInstitution | null; name: string; fallback: string }) {
  const [failed, setFailed] = useState(false);
  const icon = institution ? icons[institution] : undefined;
  return <span className="bank-logo" aria-label={name}>
    <span className="bank-logo__symbol">{icon && !failed
      ? <img src={`https://cdn.simpleicons.org/${icon}/white`} alt="" loading="lazy" onError={() => setFailed(true)} />
      : <span className="bank-logo__fallback">{fallback}</span>}</span>
    <span className="bank-logo__name">{name}</span>
  </span>;
}
