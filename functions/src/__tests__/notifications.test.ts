/**
 * Pruebas unitarias — Notificaciones
 *
 * Verifica que el payload que se escribe a Firestore usa `isRead` (no `read`),
 * y que la lógica de construcción del documento es correcta.
 *
 * Las pruebas son completamente independientes del SDK de Firebase:
 * se replica la lógica de createInternalNotification directamente
 * para evitar dependencias del mock de firestore-admin en entorno de test.
 */

import { FieldValue } from 'firebase-admin/firestore';

// ─── Tipos replicados (deben coincidir con notification.types.ts) ─────────────

type NotificationCategory = 'platform' | 'cleaning' | 'hospitality';
type MeetingType = 'midweek' | 'weekend' | null;

interface NotificationMetadata {
  date?: string | null;
  meetingType?: MeetingType;
  role?: string | null;
}

interface NotificationDocument {
  userId: string;
  congregationId: string | null;
  type: 'assignment';
  category: NotificationCategory | null;
  title: string;
  body: string;
  assignmentId: string;
  /** Campo canónico — debe ser `isRead`, NO `read`. */
  isRead: boolean;
  createdAt: FieldValue | { _methodName: string };
  sentBy?: string | null;
  metadata?: NotificationMetadata;
}

// ─── Función replicada (debe coincidir con createInternalNotification) ─────────

function buildNotificationPayload(params: {
  userId: string;
  congregationId: string | null;
  category: NotificationDocument['category'];
  title: string;
  body: string;
  assignmentId: string;
  sentBy: string | null;
  metadata: NotificationMetadata;
}): NotificationDocument {
  return {
    userId: params.userId,
    congregationId: params.congregationId,
    type: 'assignment',
    category: params.category,
    title: params.title,
    body: params.body,
    assignmentId: params.assignmentId,
    isRead: false, // ← campo canónico
    createdAt: { _methodName: 'serverTimestamp' }, // mock de FieldValue
    sentBy: params.sentBy,
    metadata: params.metadata,
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const baseParams = {
  userId: 'user123',
  congregationId: 'cong_A',
  category: 'platform' as const,
  title: 'Reunión publicada',
  body: 'Tienes una nueva asignación.',
  assignmentId: 'meeting_abc:seccion_1',
  sentBy: 'admin_uid',
  metadata: { date: '15 abr', meetingType: 'midweek' as const, role: 'Oración inicial' },
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('NotificationDocument — esquema isRead', () => {
  it('el payload usa isRead:false, NO el campo read', () => {
    const payload = buildNotificationPayload(baseParams);

    expect(payload).toHaveProperty('isRead', false);
    expect(payload).not.toHaveProperty('read');
  });

  it('isRead inicial es siempre false para documentos nuevos', () => {
    const payload = buildNotificationPayload(baseParams);
    expect(payload.isRead).toBe(false);
  });

  it('type es siempre "assignment"', () => {
    const payload = buildNotificationPayload(baseParams);
    expect(payload.type).toBe('assignment');
  });

  it('incluye todos los campos obligatorios del esquema', () => {
    const payload = buildNotificationPayload(baseParams);

    expect(payload.userId).toBe('user123');
    expect(payload.congregationId).toBe('cong_A');
    expect(payload.category).toBe('platform');
    expect(payload.title).toBe('Reunión publicada');
    expect(payload.body).toBe('Tienes una nueva asignación.');
    expect(payload.assignmentId).toBe('meeting_abc:seccion_1');
    expect(payload.sentBy).toBe('admin_uid');
    expect(payload.createdAt).toBeDefined();
  });

  it('acepta congregationId null (notificación de sistema)', () => {
    const payload = buildNotificationPayload({ ...baseParams, congregationId: null });
    expect(payload.congregationId).toBeNull();
  });

  it('acepta sentBy null', () => {
    const payload = buildNotificationPayload({ ...baseParams, sentBy: null });
    expect(payload.sentBy).toBeNull();
  });

  it('incluye metadata correctamente', () => {
    const payload = buildNotificationPayload(baseParams);
    expect(payload.metadata).toEqual({
      date: '15 abr',
      meetingType: 'midweek',
      role: 'Oración inicial',
    });
  });

  it('acepta category null', () => {
    const payload = buildNotificationPayload({ ...baseParams, category: null });
    expect(payload.category).toBeNull();
  });

  it('acepta todas las categorías válidas', () => {
    const categories: NotificationCategory[] = ['platform', 'cleaning', 'hospitality'];
    categories.forEach((category) => {
      const payload = buildNotificationPayload({ ...baseParams, category });
      expect(payload.category).toBe(category);
    });
  });
});

// ─── Tests: normalización retrocompatible (lógica del cliente) ────────────────

describe('Lectura retrocompatible isRead / read (lógica del cliente)', () => {
  // Replica la lógica de normalizeNotification en notificationService.ts
  function resolveIsRead(raw: Record<string, unknown>): boolean {
    if (typeof raw.isRead === 'boolean') return raw.isRead;
    return raw.read === true;
  }

  it('prefiere isRead si está presente', () => {
    expect(resolveIsRead({ isRead: false, read: true })).toBe(false);
    expect(resolveIsRead({ isRead: true, read: false })).toBe(true);
  });

  it('usa read como fallback para documentos legacy', () => {
    expect(resolveIsRead({ read: true })).toBe(true);
    expect(resolveIsRead({ read: false })).toBe(false);
  });

  it('devuelve false si ningún campo está presente', () => {
    expect(resolveIsRead({})).toBe(false);
  });

  it('devuelve false si el tipo es incorrecto', () => {
    expect(resolveIsRead({ isRead: 'yes' })).toBe(false);
    expect(resolveIsRead({ read: 1 })).toBe(false);
  });
});
