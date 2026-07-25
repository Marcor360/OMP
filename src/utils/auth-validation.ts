const LOGIN_EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Validates the email format locally before invoking Firebase Auth. */
export const isValidLoginEmail = (value: string): boolean =>
  LOGIN_EMAIL_PATTERN.test(value.trim());
