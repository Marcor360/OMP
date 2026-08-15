import { firestoreBillingRepository } from '@/src/services/repositories/firestore/firestore-billing-repository';
import type { BillingRepository } from '@/src/services/repositories/ports/billing-repository.port';
import type {
  BillingExemption,
  BillingPlanKey,
  CongregationBillingState,
  CongregationPrivateBillingState,
} from '@/src/types/billing';

export type CongregationBillingSummary = {
  congregationId: string;
  billing: CongregationBillingState;
  billingExemption?: BillingExemption;
  // undefined: no se intento leer (sin permiso) o la lectura fallo (ej.
  // permission-denied por drift entre el permiso efectivo del cliente y las
  // Rules). La UI debe degradar, no reventar.
  privateBilling?: CongregationPrivateBillingState;
};

export type GetCongregationBillingSummaryOptions = {
  // No dispares la lectura de congregations/{id}/private/billing si sabes
  // que el usuario no puede verla (canViewBilling() del cliente, espejo de
  // canViewBillingData() en Rules): evita una peticion que sabes que va a
  // fallar con permission-denied.
  canViewPrivateBilling?: boolean;
};

type CheckoutPayload = {
  congregationId: string;
  planKey: BillingPlanKey;
};

type PortalPayload = {
  congregationId: string;
};

let billingRepository: BillingRepository = firestoreBillingRepository;

export const __setBillingRepositoryForTests = (repo: BillingRepository): void => {
  billingRepository = repo;
};

export const __resetBillingRepositoryForTests = (): void => {
  billingRepository = firestoreBillingRepository;
};

const normalizeBilling = (value: unknown): CongregationBillingState => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return {
      enabled: false,
      status: 'disabled',
    };
  }

  const data = value as Record<string, unknown>;
  return {
    enabled: data.enabled === true,
    provider: typeof data.provider === 'string' ? data.provider : undefined,
    status: typeof data.status === 'string' ? data.status : 'disabled',
    billingDay: typeof data.billingDay === 'number' ? data.billingDay : undefined,
    billingCycle: typeof data.billingCycle === 'string' ? data.billingCycle : undefined,
    planKey:
      data.planKey === 'omp_80' || data.planKey === 'omp_150' || data.planKey === 'omp_250'
        ? data.planKey
        : undefined,
    activeUsersLimit: typeof data.activeUsersLimit === 'number' ? data.activeUsersLimit : undefined,
    userLimit: typeof data.userLimit === 'number' ? data.userLimit : undefined,
    currentPeriodStart: data.currentPeriodStart,
    currentPeriodEnd: data.currentPeriodEnd,
    nextPaymentDate: data.nextPaymentDate,
    graceDays: typeof data.graceDays === 'number' ? data.graceDays : undefined,
    graceStartedAt: data.graceStartedAt,
    graceUntil: data.graceUntil,
    adminRestricted: data.adminRestricted === true,
    cancelAtPeriodEnd: data.cancelAtPeriodEnd === true,
    updatedAt: data.updatedAt,
  };
};

const normalizePrivateBilling = (value: unknown): CongregationPrivateBillingState | undefined => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined;

  const data = value as Record<string, unknown>;
  return {
    stripePriceId: typeof data.stripePriceId === 'string' ? data.stripePriceId : undefined,
    stripeCustomerId: typeof data.stripeCustomerId === 'string' ? data.stripeCustomerId : undefined,
    stripeSubscriptionId:
      typeof data.stripeSubscriptionId === 'string' ? data.stripeSubscriptionId : undefined,
    lastPaymentStatus:
      typeof data.lastPaymentStatus === 'string' ? data.lastPaymentStatus : undefined,
    lastInvoiceId: typeof data.lastInvoiceId === 'string' ? data.lastInvoiceId : undefined,
    lastInvoiceUrl: typeof data.lastInvoiceUrl === 'string' ? data.lastInvoiceUrl : undefined,
    lastStripeEventId:
      typeof data.lastStripeEventId === 'string' ? data.lastStripeEventId : undefined,
    updatedAt: data.updatedAt,
  };
};

const normalizeExemption = (value: unknown): BillingExemption | undefined => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined;
  const data = value as Record<string, unknown>;
  return {
    exempt: data.exempt === true,
    reason: typeof data.reason === 'string' ? data.reason : undefined,
    grantedBy: typeof data.grantedBy === 'string' ? data.grantedBy : undefined,
    grantedAt: data.grantedAt,
    expiresAt: data.expiresAt,
  };
};

export const getCongregationBillingSummary = async (
  congregationId: string,
  options?: GetCongregationBillingSummaryOptions
): Promise<CongregationBillingSummary | null> => {
  if (!congregationId.trim()) return null;

  const data = await billingRepository.getCongregationDoc(congregationId);
  if (!data) return null;

  const billingExemption = normalizeExemption(data.billingExemption);
  const billing = normalizeBilling(data.billing);

  if (billingExemption?.exempt === true) {
    billing.enabled = true;
    billing.provider = 'exempt';
    billing.status = 'exempt';
    billing.adminRestricted = false;
  }

  let privateBilling: CongregationPrivateBillingState | undefined;
  if (options?.canViewPrivateBilling) {
    try {
      const privateData = await billingRepository.getPrivateBillingDoc(congregationId);
      privateBilling = normalizePrivateBilling(privateData);
    } catch {
      // Degrada con elegancia: el resumen publico sigue siendo valido aunque
      // el permiso efectivo del cliente y las Rules hayan divergido.
      privateBilling = undefined;
    }
  }

  return {
    congregationId,
    billing,
    billingExemption,
    privateBilling,
  };
};

export const createStripeCheckoutSession = async (payload: CheckoutPayload): Promise<string> => {
  return billingRepository.createCheckoutSession(payload);
};

export const createStripePortalSession = async (payload: PortalPayload): Promise<string> => {
  return billingRepository.createPortalSession(payload);
};

export const getStripeBillingUsage = async (payload: PortalPayload): Promise<number | null> => {
  return billingRepository.getBillingUsage(payload);
};

export const setBillingExemption = async (exempt: boolean): Promise<void> => {
  await billingRepository.setBillingExemption({ exempt });
};
