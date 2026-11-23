import { canSweepInactiveProfile, canSweepPath, latestCleanupDate, normalizeStoragePath, retentionCutoff } from '../maintenance/retention-policy.js';

// ─── Tests: normalizeStoragePath ──────────────────────────────────────────────

describe('normalizeStoragePath', () => {
  const defaultBucket = 'my-project.appspot.com';

  it('parsea ruta gs:// correctamente', () => {
    const result = normalizeStoragePath(
      'gs://my-bucket/path/to/file.png',
      defaultBucket
    );
    expect(result).toEqual({
      bucketName: 'my-bucket',
      objectPath: 'path/to/file.png',
    });
  });

  it('parsea URL https:// de Firebase Storage', () => {
    const url =
      'https://firebasestorage.googleapis.com/v0/b/my-project.appspot.com/o/docs%2Ffile.png?alt=media';
    const result = normalizeStoragePath(url, defaultBucket);
    expect(result).toEqual({
      bucketName: 'my-project.appspot.com',
      objectPath: 'docs/file.png',
    });
  });

  it('parsea ruta relativa usando el bucket por defecto', () => {
    const result = normalizeStoragePath('uploads/archivo.png', defaultBucket);
    expect(result).toEqual({
      bucketName: defaultBucket,
      objectPath: 'uploads/archivo.png',
    });
  });

  it('elimina barras iniciales de rutas relativas', () => {
    const result = normalizeStoragePath('/uploads/archivo.png', defaultBucket);
    expect(result).toEqual({
      bucketName: defaultBucket,
      objectPath: 'uploads/archivo.png',
    });
  });

  it('devuelve null para cadena vacía', () => {
    expect(normalizeStoragePath('', defaultBucket)).toBeNull();
  });

  it('devuelve null para cadena sólo de espacios', () => {
    expect(normalizeStoragePath('   ', defaultBucket)).toBeNull();
  });

  it('devuelve null para gs:// sin ruta de objeto', () => {
    expect(normalizeStoragePath('gs://only-bucket', defaultBucket)).toBeNull();
  });

  it('devuelve null para URL https sin patrón /b/.../o/...', () => {
    const result = normalizeStoragePath('https://example.com/file.png', defaultBucket);
    expect(result).toBeNull();
  });
});

describe('retention policy', () => {
  it('uses the local calendar and clamps the last day of a shorter month', () => {
    expect(retentionCutoff(new Date('2026-11-01T07:00:00Z'), 6).toISOString())
      .toBe('2026-05-01T06:00:00.000Z');
    expect(retentionCutoff(new Date('2026-08-31T07:00:00Z'), 6).toISOString())
      .toBe('2026-02-28T06:00:00.000Z');
  });

  it('uses the newest date and preserves documents in report subtrees', () => {
    expect(latestCleanupDate({ start: 10, end: 30 }, ['start', 'end'], (value) =>
      typeof value === 'number' ? value : null)).toBe(30);
    expect(canSweepPath('congregations/c1/meetings/m1/assignments/a1', 'assignments')).toBe(true);
    expect(canSweepPath('congregations/c1/preachingReports/m1/assignments/a1', 'assignments')).toBe(false);
    expect(canSweepPath('unknown/x/notifications/n1', 'notifications')).toBe(false);
  });

  it('preserves suspended administrators protected from deletion and conflicting active state', () => {
    expect(canSweepInactiveProfile({ isActive: false, isPrimaryAdmin: true })).toBe(false);
    expect(canSweepInactiveProfile({ isActive: false, status: 'active' })).toBe(false);
    expect(canSweepInactiveProfile({ isActive: false })).toBe(true);
  });
});
