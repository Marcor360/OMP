import { type UnknownOutputParams } from 'expo-router';

const AUTH_PATHS = new Set(['/login', '/(auth)/login']);
const DEFAULT_PROTECTED_ROUTE = '/(protected)/(tabs)/';

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
