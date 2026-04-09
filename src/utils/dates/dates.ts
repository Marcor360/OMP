import { Timestamp } from 'firebase/firestore';

type DateInput = Timestamp | Date | null | undefined;

const toDate = (input: DateInput): Date | null => {
  if (!input) return null;
  if (input instanceof Timestamp) return input.toDate();
  return input;
};

/** Formato: 15 ene. 2025 */
export const formatDate = (input: DateInput): string => {
  const date = toDate(input);
  if (!date) return '—';
  return date.toLocaleDateString('es-MX', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

/** Formato: 15 ene. 2025, 09:30 */
export const formatDateTime = (input: DateInput): string => {
  const date = toDate(input);
  if (!date) return '—';
  return date.toLocaleString('es-MX', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

/** Formato: 09:30 */
export const formatTime = (input: DateInput): string => {
  const date = toDate(input);
  if (!date) return '—';
  return date.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
};

/** Tiempo relativo: "hace 3 días", "en 2 horas" */
export const getRelativeTime = (input: DateInput): string => {
  const date = toDate(input);
  if (!date) return '—';
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const absDiff = Math.abs(diff);
  const isPast = diff > 0;

  const minutes = Math.floor(absDiff / (1000 * 60));
  const hours = Math.floor(absDiff / (1000 * 60 * 60));
  const days = Math.floor(absDiff / (1000 * 60 * 60 * 24));

  if (days > 30) return formatDate(date);

  const prefix = isPast ? 'hace' : 'en';
  if (days > 0) return `${prefix} ${days} día${days > 1 ? 's' : ''}`;
  if (hours > 0) return `${prefix} ${hours} hora${hours > 1 ? 's' : ''}`;
  if (minutes > 0) return `${prefix} ${minutes} minuto${minutes > 1 ? 's' : ''}`;
  return 'ahora';
};

/** ¿Ya pasó la fecha límite? */
export const isOverdue = (input: DateInput): boolean => {
  const date = toDate(input);
  if (!date) return false;
  return date < new Date();
};

/** Convierte Date a Timestamp de Firestore */
export const toTimestamp = (date: Date): Timestamp =>
  Timestamp.fromDate(date);

/** Fecha de hoy al inicio del día */
export const todayStart = (): Date => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};
