/**
 * Pruebas unitarias — Publicación de reuniones
 *
 * Verifica los helpers puros de parsePayload y normalizeRole
 * que no dependen de Firestore.
 */

import { HttpsError } from 'firebase-functions/v2/https';

// ─── Helpers replicados ───────────────────────────────────────────────────────

type UserRole = 'admin' | 'supervisor' | 'user';
type PublicationStatus = 'draft' | 'published';

const normalizeText = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const normalizeRole = (value: unknown): UserRole | undefined => {
  if (value === 'admin' || value === 'supervisor' || value === 'user') {
    return value;
  }

  if (typeof value !== 'string') return undefined;

  const normalized = value.trim().toLowerCase();
  if (normalized === 'admin' || normalized === 'administrador') return 'admin';
  if (normalized === 'supervisor') return 'supervisor';
  if (normalized === 'user' || normalized === 'usuario') return 'user';

  return undefined;
};

type SetMeetingPublicationStatusPayload = {
  congregationId?: unknown;
  meetingId?: unknown;
  publicationStatus?: unknown;
};

function parsePayload(payload: SetMeetingPublicationStatusPayload): {
  congregationId: string;
  meetingId: string;
  publicationStatus: PublicationStatus;
} {
  const congregationId = normalizeText(payload.congregationId);
  const meetingId = normalizeText(payload.meetingId);
  const publicationStatus = payload.publicationStatus;

  if (!congregationId || !meetingId) {
    throw new HttpsError('invalid-argument', 'Se requiere congregationId y meetingId.');
  }

  if (publicationStatus !== 'draft' && publicationStatus !== 'published') {
    throw new HttpsError('invalid-argument', 'publicationStatus invalido.');
  }

  return { congregationId, meetingId, publicationStatus };
}

// ─── Tests: normalizeRole ─────────────────────────────────────────────────────

describe('normalizeRole', () => {
  it.each(['admin', 'supervisor', 'user'])('acepta rol canónico "%s"', (role) => {
    expect(normalizeRole(role)).toBe(role);
  });

  it('acepta variantes en español ("administrador", "usuario")', () => {
    expect(normalizeRole('administrador')).toBe('admin');
    expect(normalizeRole('Administrador')).toBe('admin');
    expect(normalizeRole('usuario')).toBe('user');
  });

  it('devuelve undefined para roles desconocidos', () => {
    expect(normalizeRole('moderator')).toBeUndefined();
    expect(normalizeRole('')).toBeUndefined();
    expect(normalizeRole(null)).toBeUndefined();
    expect(normalizeRole(undefined)).toBeUndefined();
    expect(normalizeRole(42)).toBeUndefined();
  });
});

// ─── Tests: parsePayload ──────────────────────────────────────────────────────

describe('parsePayload (setMeetingPublicationStatus)', () => {
  const valid: SetMeetingPublicationStatusPayload = {
    congregationId: 'cong_A',
    meetingId: 'meeting_001',
    publicationStatus: 'published',
  };

  it('parsea un payload válido con status published', () => {
    const result = parsePayload(valid);
    expect(result.congregationId).toBe('cong_A');
    expect(result.meetingId).toBe('meeting_001');
    expect(result.publicationStatus).toBe('published');
  });

  it('parsea un payload válido con status draft', () => {
    const result = parsePayload({ ...valid, publicationStatus: 'draft' });
    expect(result.publicationStatus).toBe('draft');
  });

  it('lanza error si congregationId está vacío', () => {
    expect(() => parsePayload({ ...valid, congregationId: '' })).toThrow(HttpsError);
  });

  it('lanza error si congregationId es undefined', () => {
    expect(() => parsePayload({ ...valid, congregationId: undefined })).toThrow(HttpsError);
  });

  it('lanza error si meetingId está vacío', () => {
    expect(() => parsePayload({ ...valid, meetingId: '   ' })).toThrow(HttpsError);
  });

  it('lanza error si publicationStatus es inválido', () => {
    expect(() => parsePayload({ ...valid, publicationStatus: 'archived' })).toThrow(HttpsError);
    expect(() => parsePayload({ ...valid, publicationStatus: '' })).toThrow(HttpsError);
    expect(() => parsePayload({ ...valid, publicationStatus: null })).toThrow(HttpsError);
  });

  it('trimmea espacios de congregationId y meetingId', () => {
    const result = parsePayload({
      congregationId: '  cong_B  ',
      meetingId: '  meeting_99  ',
      publicationStatus: 'draft',
    });
    expect(result.congregationId).toBe('cong_B');
    expect(result.meetingId).toBe('meeting_99');
  });
});

// ─── Tests: normalizeText ─────────────────────────────────────────────────────

describe('normalizeText (meetings-publication)', () => {
  it('devuelve string sin espacios', () => {
    expect(normalizeText('  valor  ')).toBe('valor');
  });

  it('devuelve undefined para cadena vacía', () => {
    expect(normalizeText('')).toBeUndefined();
    expect(normalizeText('   ')).toBeUndefined();
  });

  it('devuelve undefined para no-string', () => {
    expect(normalizeText(null)).toBeUndefined();
    expect(normalizeText(undefined)).toBeUndefined();
    expect(normalizeText(0)).toBeUndefined();
  });
});
