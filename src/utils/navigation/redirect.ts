import { type UnknownOutputParams } from 'expo-router';

const AUTH_PATHS = new Set(['/login', '/(auth)/login']);
const DEFAULT_PROTECTED_ROUTE = '/(protected)/(tabs)/';

const NOTIFICATION_HREF_ALLOWED_PREFIXES = [
  '/(protected)/(tabs)',
  '/(protected)/meetings/',
  '/(protected)/assignments/',
  '/(protected)/events/',
  '/(protected)/billing',
  '/(protected)/cleaning',
  '/(protected)/notifications',
  '/(protected)/territories/',
];

export function buildPathWithParams(
  pathname: string,
  params: UnknownOutputParams
): string {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (key.startsWith('__')) {
      return;
    }

    if (Array.isArray(value)) {
      value.forEach((item) => {
        if (item != null) {
          searchParams.append(key, String(item));
        }
      });
      return;
    }

    if (value != null) {
      searchParams.set(key, String(value));
    }
  });

  const query = searchParams.toString();
  return query ? `${pathname}?${query}` : pathname;
}

export function getSafeRedirectPath(redirectTo: unknown): string {
  const value = Array.isArray(redirectTo) ? redirectTo[0] : redirectTo;

  if (typeof value !== 'string') {
    return DEFAULT_PROTECTED_ROUTE;
  }

  const trimmed = value.trim();

  if (!trimmed.startsWith('/') || AUTH_PATHS.has(trimmed.split('?')[0])) {
    return DEFAULT_PROTECTED_ROUTE;
  }

  return trimmed;
}

export function getSafeNotificationHref(url: unknown): string {
  if (typeof url !== 'string') {
    return DEFAULT_PROTECTED_ROUTE;
  }

  const trimmed = url.trim();

  if (!trimmed.startsWith('/')) {
    return DEFAULT_PROTECTED_ROUTE;
  }

  const pathOnly = trimmed.split('?')[0].split('#')[0];

  if (AUTH_PATHS.has(pathOnly)) {
    return DEFAULT_PROTECTED_ROUTE;
  }

  const isAllowed = NOTIFICATION_HREF_ALLOWED_PREFIXES.some((prefix) =>
    pathOnly.startsWith(prefix)
  );

  if (!isAllowed) {
    return DEFAULT_PROTECTED_ROUTE;
  }

  return trimmed;
}
