const timeZone = 'America/Mexico_City';
const calendarDay = new Intl.DateTimeFormat('en-CA', {
  timeZone, year: 'numeric', month: 'numeric', day: 'numeric',
});
const offsetFormatter = new Intl.DateTimeFormat('en', { timeZone, timeZoneName: 'shortOffset' });

export const retentionCutoff = (now: Date, months: number): Date => {
  const parts = new Map(calendarDay.formatToParts(now).map(({ type, value }) => [type, Number(value)]));
  const year = parts.get('year')!;
  const month = parts.get('month')! - 1 - months;
  const day = Math.min(parts.get('day')!, new Date(Date.UTC(year, month + 1, 0)).getUTCDate());
  const local = Date.UTC(year, month, day);
  const offset = offsetFormatter.formatToParts(new Date(local + 12 * 3_600_000))
    .find(({ type }) => type === 'timeZoneName')?.value ?? '';
  const match = /^GMT([+-])(\d{1,2})(?::(\d{2}))?$/.exec(offset);
  const minutes = match ? (Number(match[2]) * 60 + Number(match[3] ?? 0)) * (match[1] === '-' ? -1 : 1) : 0;
  return new Date(local - minutes * 60_000);
};

export const canSweepPath = (path: string, collection: string): boolean => {
  const parts = path.split('/');
  if (parts.length === 2) return parts[0] === collection;
  if (parts[0] !== 'congregations') return false;
  return (parts.length === 4 && parts[2] === collection) ||
    (parts.length === 6 && parts[2] === 'meetings' && parts[4] === 'assignments' && collection === 'assignments');
};

export const latestCleanupDate = (
  data: Record<string, unknown>, fields: readonly string[], toMillis: (value: unknown) => number | null,
): number | null => {
  const valid = fields.map((field) => toMillis(data[field])).filter((value): value is number => value !== null && Number.isFinite(value));
  return valid.length ? Math.max(...valid) : null;
};

export const canSweepInactiveProfile = (data: Record<string, unknown>): boolean =>
  data.isActive === false && data.active !== true && data.status !== 'active' &&
  !['protectedFromDeletion', 'isSystemUser', 'isPrimaryAdmin', 'isRootAdmin', 'systemProtected']
    .some((field) => data[field] === true);

export const normalizeStoragePath = (
  rawFilePath: string,
  defaultBucketName: string
): {bucketName: string; objectPath: string} | null => {
  const filePath = rawFilePath.trim();
  if (filePath.length === 0) return null;

  if (filePath.startsWith("gs://")) {
    const match = filePath.match(/^gs:\/\/([^/]+)\/(.+)$/);
    if (!match) return null;
    return {
      bucketName: match[1],
      objectPath: match[2],
    };
  }

  if (filePath.startsWith("http://") || filePath.startsWith("https://")) {
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
    objectPath: filePath.replace(/^\/+/, ""),
  };
};
