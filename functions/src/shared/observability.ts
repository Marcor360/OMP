import { logger } from 'firebase-functions/v2';

/**
 * Métricas operativas estructuradas para Cloud Logging.
 *
 * Solo admite contadores y duración: no recibe uid, correo, token, título ni
 * otro dato personal. Los paneles/alertas se construyen filtrando `metric`.
 */
export type OperationalMetric =
  | 'notifications.push_dispatch_worker'
  | 'notifications.push_receipts_worker';

type MetricValues = {
  durationMs: number;
  processed: number;
  recovered?: number;
};

const asNonNegativeInteger = (value: number): number =>
  Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;

export const logOperationalMetric = (metric: OperationalMetric, values: MetricValues): void => {
  logger.info('operational_metric', {
    metric,
    durationMs: asNonNegativeInteger(values.durationMs),
    processed: asNonNegativeInteger(values.processed),
    ...(values.recovered === undefined ? {} : { recovered: asNonNegativeInteger(values.recovered) }),
  });
};
