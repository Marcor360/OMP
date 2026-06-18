/**
 * Pruebas unitarias — Idempotencia de webhooks de Stripe.
 *
 * Verifican el contrato del que depende la deduplicacion de eventos:
 *  - reclamo atomico (claimed) vs duplicado (duplicate) vs error duro (relanza),
 *  - marcado de procesado,
 *  - liberacion que nunca enmascara el error original del procesamiento.
 *
 * No tocan el Admin SDK: se inyecta un DocumentReference falso.
 */

import type { DocumentReference } from 'firebase-admin/firestore';

import {
  claimWebhookEvent,
  isAlreadyExistsError,
  markWebhookEventProcessed,
  releaseWebhookEvent,
} from '../billing/webhook-idempotency.js';

// Silenciamos el logger de Cloud Functions y permitimos aserciones sobre el.
jest.mock('firebase-functions/v2', () => ({
  logger: { error: jest.fn(), info: jest.fn(), warn: jest.fn() },
}));

import { logger } from 'firebase-functions/v2';

type FakeRef = {
  create: jest.Mock;
  set: jest.Mock;
  delete: jest.Mock;
};

const makeRef = (overrides: Partial<FakeRef> = {}): { ref: DocumentReference; fake: FakeRef } => {
  const fake: FakeRef = {
    create: jest.fn().mockResolvedValue(undefined),
    set: jest.fn().mockResolvedValue(undefined),
    delete: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
  return { ref: fake as unknown as DocumentReference, fake };
};

const alreadyExists = (code: number | string) => Object.assign(new Error('exists'), { code });

beforeEach(() => {
  jest.clearAllMocks();
});

describe('isAlreadyExistsError', () => {
  it('reconoce el codigo numerico 6 (gRPC ALREADY_EXISTS)', () => {
    expect(isAlreadyExistsError(alreadyExists(6))).toBe(true);
  });

  it('reconoce las variantes de codigo en texto', () => {
    expect(isAlreadyExistsError(alreadyExists('already-exists'))).toBe(true);
    expect(isAlreadyExistsError(alreadyExists('ALREADY_EXISTS'))).toBe(true);
  });

  it('rechaza otros codigos y valores no-objeto', () => {
    expect(isAlreadyExistsError(alreadyExists(13))).toBe(false);
    expect(isAlreadyExistsError(new Error('boom'))).toBe(false);
    expect(isAlreadyExistsError(null)).toBe(false);
    expect(isAlreadyExistsError('already-exists')).toBe(false);
  });
});

describe('claimWebhookEvent', () => {
  it('devuelve "claimed" y escribe el documento en la primera entrega', async () => {
    const { ref, fake } = makeRef();

    const result = await claimWebhookEvent(ref, 'invoice.payment_failed');

    expect(result).toBe('claimed');
    expect(fake.create).toHaveBeenCalledTimes(1);
    const payload = fake.create.mock.calls[0][0];
    expect(payload).toMatchObject({ type: 'invoice.payment_failed', status: 'processing' });
    expect(payload.expireAt).toBeDefined();
  });

  it('devuelve "duplicate" cuando el documento ya existe (entrega repetida)', async () => {
    const { ref, fake } = makeRef({
      create: jest.fn().mockRejectedValue(alreadyExists(6)),
    });

    const result = await claimWebhookEvent(ref, 'invoice.paid');

    expect(result).toBe('duplicate');
    expect(fake.create).toHaveBeenCalledTimes(1);
  });

  it('relanza errores que no son ALREADY_EXISTS (no se asume idempotencia)', async () => {
    const { ref } = makeRef({
      create: jest.fn().mockRejectedValue(alreadyExists(13)),
    });

    await expect(claimWebhookEvent(ref, 'invoice.paid')).rejects.toMatchObject({ code: 13 });
  });
});

describe('markWebhookEventProcessed', () => {
  it('marca el evento como procesado con merge', async () => {
    const { ref, fake } = makeRef();

    await markWebhookEventProcessed(ref);

    expect(fake.set).toHaveBeenCalledTimes(1);
    expect(fake.set.mock.calls[0][0]).toMatchObject({ status: 'processed' });
    expect(fake.set.mock.calls[0][1]).toEqual({ merge: true });
  });
});

describe('releaseWebhookEvent', () => {
  it('elimina la reclamacion para permitir el reintento de Stripe', async () => {
    const { ref, fake } = makeRef();

    await releaseWebhookEvent(ref, 'evt_123');

    expect(fake.delete).toHaveBeenCalledTimes(1);
  });

  it('nunca lanza si la limpieza falla; registra el error y resuelve', async () => {
    const { ref } = makeRef({
      delete: jest.fn().mockRejectedValue(new Error('cleanup boom')),
    });

    await expect(releaseWebhookEvent(ref, 'evt_456')).resolves.toBeUndefined();
    expect(logger.error).toHaveBeenCalledWith(
      '[billing] webhook claim cleanup failed',
      expect.objectContaining({ eventId: 'evt_456' })
    );
  });
});
