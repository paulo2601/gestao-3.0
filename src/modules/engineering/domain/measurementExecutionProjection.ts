import type { MeasurementParityModel, MeasurementParityLine } from '../infrastructure/LegacyMeasurementParityRepository';

/**
 * A medição financeira é a fonte única do projetado.
 * Não cria planos, não escreve em measurement_lines e não confunde
 * quantidades de outras medições com a competência em acompanhamento.
 */
export interface ExecutionProjectionItem {
  originName: string;
  originType: string;
  unitKind: 'apartamento' | 'hall' | 'unidade';
  measurementLineId: string;
  measurementId: string;
  targetKind: MeasurementParityLine['targetKind'];
  targetId: string;
  description: string;
  unit: string;
  reference: string | null;
  plannedQuantity: number;
  unitPrice: number;
  plannedValue: number;
}

export function deriveExecutionProjection(
  model: MeasurementParityModel,
  measurementId: string
): ExecutionProjectionItem[] {
  if (!measurementId || !model.measurements.some(item => item.id === measurementId)) return [];
  const services = model.origins.flatMap(origin => origin.services);
  return model.lines
    .filter(line => line.measurementId === measurementId && line.measuredQuantity > 0)
    .map(line => {
      const service = services.find(item =>
        item.targetKind === line.targetKind && item.targetId === line.targetId
      );
      const origin = model.origins.find(origin => origin.services.some(item => item.targetKind === line.targetKind && item.targetId === line.targetId));
      const description = line.manualDescription ?? service?.description ?? 'Serviço da medição';
      const unitKind = /hall|escadaria|área comum/i.test(description) ? 'hall' : /^\d{3,4}$/.test(line.reference ?? '') ? 'apartamento' : 'unidade';
      const quantity = line.measuredQuantity;
      const unitPrice = line.unitPriceSnapshot;
      return {
        originName: origin?.name ?? 'Origem não identificada',
        originType: origin?.type ?? 'other',
        unitKind,
        measurementLineId: line.id,
        measurementId: line.measurementId,
        targetKind: line.targetKind,
        targetId: line.targetId,
        description,
        unit: line.manualUnit ?? service?.unit ?? '',
        reference: line.reference,
        plannedQuantity: quantity,
        unitPrice,
        plannedValue: line.exactGrossValue ?? quantity * unitPrice
      };
    });
}

export function chooseActiveExecutionMeasurement(model: MeasurementParityModel): string | null {
  const drafts = model.measurements.filter(item => item.status === 'draft');
  const selected = [...drafts].sort((a, b) =>
    b.competence.localeCompare(a.competence) ||
    b.measurementNumber.localeCompare(a.measurementNumber)
  )[0];
  return selected?.id ?? null;
}
