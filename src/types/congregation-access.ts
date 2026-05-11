export type CongregationDeactivationReason =
  | 'payment_overdue'
  | 'policy_violation'
  | 'temporary_deactivation'
  | 'system_maintenance'
  | 'unknown';

export interface CongregationAccessState {
  isBlocked: boolean;
  reason: CongregationDeactivationReason;
  reasonLabel: string;
  message: string;
  congregationId: string;
  congregationName: string;
  firebaseName: string;
  blockedUntil?: string;
  source: 'congregation' | 'system' | 'none';
}

export const CONGREGATION_DEACTIVATION_REASON_LABELS: Record<
  CongregationDeactivationReason,
  string
> = {
  payment_overdue: 'Falta de pago de servicios',
  policy_violation: 'Violacion de politicas',
  temporary_deactivation: 'Desactivacion temporal',
  system_maintenance: 'Mantenimiento de sistema',
  unknown: 'Congregacion desactivada',
};
