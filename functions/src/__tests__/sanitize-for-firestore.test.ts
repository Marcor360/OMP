/**
 * Pruebas unitarias — sanitizeForFirestore (meetings-management.ts)
 *
 * Reproduce el bug de los centinelas de FieldValue destruidos:
 * Object.entries() sobre un FieldValue no expone propiedades enumerables,
 * por lo que el sanitizador genérico los convertía en {}.
 */

import { FieldValue, Timestamp } from 'firebase-admin/firestore';

import { __sanitizeForFirestoreForTests as sanitizeForFirestore } from '../meetings-management.js';

describe('sanitizeForFirestore', () => {
  it('preserva FieldValue.serverTimestamp() por identidad', () => {
    const sentinel = FieldValue.serverTimestamp();
    expect(sanitizeForFirestore({ updatedAt: sentinel })).toEqual({ updatedAt: sentinel });
    expect((sanitizeForFirestore({ updatedAt: sentinel }) as Record<string, unknown>).updatedAt).toBe(sentinel);
  });

  it('preserva FieldValue.arrayUnion() por identidad', () => {
    const sentinel = FieldValue.arrayUnion('a');
    const result = sanitizeForFirestore({ tags: sentinel }) as Record<string, unknown>;
    expect(result.tags).toBe(sentinel);
  });

  it('preserva FieldValue.increment() por identidad', () => {
    const sentinel = FieldValue.increment(1);
    const result = sanitizeForFirestore({ count: sentinel }) as Record<string, unknown>;
    expect(result.count).toBe(sentinel);
  });

  it('preserva FieldValue.delete() por identidad', () => {
    const sentinel = FieldValue.delete();
    const result = sanitizeForFirestore({ obsolete: sentinel }) as Record<string, unknown>;
    expect(result.obsolete).toBe(sentinel);
  });

  it('sigue preservando Timestamp por identidad (no regresion)', () => {
    const sentinel = Timestamp.now();
    const result = sanitizeForFirestore({ date: sentinel }) as Record<string, unknown>;
    expect(result.date).toBe(sentinel);
  });

  it('preserva un centinela anidado', () => {
    const sentinel = FieldValue.serverTimestamp();
    const result = sanitizeForFirestore({ meta: { updatedAt: sentinel } }) as Record<string, unknown>;
    expect((result.meta as Record<string, unknown>).updatedAt).toBe(sentinel);
  });

  it('sigue eliminando claves con valor undefined en objetos planos', () => {
    const result = sanitizeForFirestore({ a: 1, b: undefined }) as Record<string, unknown>;
    expect(result).toEqual({ a: 1 });
    expect('b' in result).toBe(false);
  });

  it('preserva un centinela dentro de un arreglo', () => {
    const sentinel = FieldValue.arrayUnion('x');
    const result = sanitizeForFirestore([sentinel, 'plain']) as unknown[];
    expect(result[0]).toBe(sentinel);
    expect(result[1]).toBe('plain');
  });
});
