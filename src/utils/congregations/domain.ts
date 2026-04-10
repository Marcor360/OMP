const toTrimmedText = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

export const normalizeDomainCandidate = (value: unknown): string | undefined => {
  const raw = toTrimmedText(value);
  if (!raw) return undefined;

  let normalized = raw
    .toLowerCase()
    .replace(/^mailto:/, '')
    .replace(/^https?:\/\//, '')
    .replace(/\/$/, '');

  if (normalized.includes('@')) {
    normalized = normalized.split('@').pop() ?? normalized;
  }

  normalized = normalized.split('/')[0].trim();

  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(normalized)) {
    return undefined;
  }

  return normalized;
};

export const slugifyDomainLabel = (value: unknown): string => {
  const raw = toTrimmedText(value) ?? 'congregacion';

  const normalized = raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');

  return normalized.length > 0 ? normalized : 'congregacion';
};

export const resolveCongregationEmailDomain = (
  congregationId: string,
  congregationData?: Record<string, unknown>
): string => {
  const explicit =
    normalizeDomainCandidate(congregationData?.emailDomain) ??
    normalizeDomainCandidate(congregationData?.domain);

  if (explicit) return explicit;

  const fromId = normalizeDomainCandidate(congregationId);
  if (fromId) return fromId;

  const labelSource =
    toTrimmedText(congregationData?.slug) ??
    toTrimmedText(congregationData?.name) ??
    toTrimmedText(congregationData?.displayName) ??
    congregationId;

  return `${slugifyDomainLabel(labelSource)}.com`;
};

export const getEmailDomain = (email: string): string | undefined => {
  const trimmed = email.trim().toLowerCase();
  if (!trimmed.includes('@')) return undefined;

  const domain = trimmed.split('@').pop();
  return domain && domain.length > 0 ? domain : undefined;
};

export const matchesCongregationDomain = (email: string, requiredDomain: string): boolean => {
  const emailDomain = getEmailDomain(email);
  return Boolean(emailDomain && emailDomain === requiredDomain.toLowerCase());
};
