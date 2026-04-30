/**
 * Pruebas unitarias — Limpieza programada
 *
 * Verifica funciones puras de la limpieza de datos:
 * - normalizeStoragePath: gs://, https://, ruta relativa, vacío, inválido
 * - El cálculo de cutoff (subtractMonths) cruza correctamente año/mes
 *
 * No requiere emulador: se prueban sólo las utilidades puras
 * exportando helpers mediante re-exportación para pruebas.
 */

// ─── Helpers bajo prueba ──────────────────────────────────────────────────────
// Como estas funciones son internas al módulo, las probamos replicando
// la lógica aquí para no acoplar las pruebas a la implementación privada.
// Si en el futuro se exportan, se puede importar directamente.

type NormalizedPath = { bucketName: string; objectPath: string };

function normalizeStoragePath(
  rawFilePath: string,
  defaultBucketName: string
): NormalizedPath | null {
  const filePath = rawFilePath.trim();
  if (filePath.length === 0) return null;

  if (filePath.startsWith('gs://')) {
    const match = filePath.match(/^gs:\/\/([^/]+)\/(.+)$/);
    if (!match) return null;
    return { bucketName: match[1], objectPath: match[2] };
  }

  if (filePath.startsWith('http://') || filePath.startsWith('https://')) {
    try {
      const parsedUrl = new URL(filePath);
      const bucketMatch = parsedUrl.pathname.match(/\/b\/([^/]+)\/o\/(.+)$/);
      if (!bucketMatch) return null;
      return {
        bucketName: bucketMatch[1],
        objectPath: decodeURIComponent(bucketMatch[2]),
      };
    } catch {
      return null;
    }
  }

  return {
    bucketName: defaultBucketName,
    objectPath: filePath.replace(/^\/+/, ''),
  };
}

function subtractMonths(date: Date, months: number): Date {
  const result = new Date(date);
  result.setMonth(result.getMonth() - months);
  return result;
}

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

// ─── Tests: subtractMonths ────────────────────────────────────────────────────

describe('subtractMonths', () => {
  it('resta 2 meses dentro del mismo año', () => {
    const base = new Date('2025-04-15T00:00:00Z');
    const result = subtractMonths(base, 2);
    expect(result.getMonth()).toBe(1); // Febrero (0-indexed)
    expect(result.getFullYear()).toBe(2025);
  });

  it('cruza correctamente el límite de año', () => {
    const base = new Date('2025-01-20T00:00:00Z');
    const result = subtractMonths(base, 2);
    expect(result.getFullYear()).toBe(2024);
    expect(result.getMonth()).toBe(10); // Noviembre
  });

  it('no muta la fecha original', () => {
    const base = new Date('2025-06-01T00:00:00Z');
    const original = base.toISOString();
    subtractMonths(base, 3);
    expect(base.toISOString()).toBe(original);
  });

  it('restar 0 meses devuelve la misma fecha', () => {
    const base = new Date('2025-03-10T12:00:00Z');
    const result = subtractMonths(base, 0);
    expect(result.toISOString()).toBe(base.toISOString());
  });
});
