/**
 * Utilidades para la regla operativa de ventana de 2 meses
 *
 * Toda la operación visible de la app debe limitarse a una ventana máxima de 2 meses:
 * - ventana operativa = desde hoy hasta hoy + 2 meses
 * - datos vencidos = historial o archivado
 * - datos demasiado futuros = fuera de la vista operativa principal
 */

/**
 * Obtiene la ventana operativa actual
 * @returns Objeto con fecha de inicio (hoy) y fecha de fin (hoy + 2 meses)
 */
export function getOperationalWindow(): { start: Date; end: Date } {
  const now = new Date();

  // Inicio: hoy al inicio del día
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);

  // Fin: hoy + 2 meses, al final del día
  const end = new Date(now);
  end.setMonth(end.getMonth() + 2);
  end.setHours(23, 59, 59, 999);

  return { start, end };
}

/**
 * Verifica si una fecha está dentro de la ventana operativa
 * @param date - Fecha a verificar (Timestamp, Date, null o undefined)
 * @returns true si está dentro de la ventana operativa
 */
export function isWithinOperationalWindow(date: Date | null | undefined): boolean {
  if (!date) return false;

  const { start, end } = getOperationalWindow();
  const checkDate = new Date(date);

  return checkDate >= start && checkDate <= end;
}

/**
 * Verifica si una fecha ya venció (es anterior al inicio de la ventana operativa)
 * @param date - Fecha a verificar
 * @returns true si la fecha ya venció
 */
export function isExpired(date: Date | null | undefined): boolean {
  if (!date) return false;

  const { start } = getOperationalWindow();
  return new Date(date) < start;
}

/**
 * Verifica si una fecha está más allá de la ventana operativa (demasiado futuro)
 * @param date - Fecha a verificar
 * @returns true si la fecha está más allá de la ventana operativa
 */
export function isBeyondOperationalWindow(date: Date | null | undefined): boolean {
  if (!date) return false;

  const { end } = getOperationalWindow();
  return new Date(date) > end;
}

/**
 * Estado operacional de una fecha
 */
export type OperationalStatus = 'expired' | 'current' | 'upcoming' | 'beyond';

/**
 * Obtiene el estado operacional de una fecha
 * @param date - Fecha a evaluar
 * @returns Estado operacional: 'expired' (vencido), 'current' (actual), 'upcoming' (próximo), 'beyond' (fuera de ventana)
 */
export function getOperationalStatus(date: Date | null | undefined): OperationalStatus {
  if (!date) return 'beyond';

  if (isExpired(date)) return 'expired';
  if (isBeyondOperationalWindow(date)) return 'beyond';

  const now = new Date();
  const checkDate = new Date(date);
  const twoWeeksFromNow = new Date(now);
  twoWeeksFromNow.setDate(twoWeeksFromNow.getDate() + 14);

  // Si está en la ventana pero antes de 2 semanas desde hoy = current
  // Si está en la ventana pero después de 2 semanas = upcoming
  if (checkDate <= twoWeeksFromNow) {
    return 'current';
  }

  return 'upcoming';
}

/**
 * Filtra una lista de items manteniendo solo los que están dentro de la ventana operativa
 * @param items - Lista de items a filtrar
 * @param dateField - Nombre del campo que contiene la fecha en cada item
 * @returns Lista filtrada con solo items dentro de la ventana operativa
 */
export function filterOperationalItems<T extends Record<string, unknown>>(
  items: T[],
  dateField: keyof T
): T[] {
  return items.filter((item) => {
    const dateValue = item[dateField];
    const date = dateValue instanceof Date ? dateValue : null;
    return isWithinOperationalWindow(date);
  });
}

/**
 * Filtra una lista de items separando los vencidos
 * @param items - Lista de items a filtrar
 * @param dateField - Nombre del campo que contiene la fecha en cada item
 * @returns Objeto con arrays separados: operational y expired
 */
export function separateExpiredItems<T extends Record<string, unknown>>(
  items: T[],
  dateField: keyof T
): { operational: T[]; expired: T[] } {
  const operational: T[] = [];
  const expired: T[] = [];

  for (const item of items) {
    const dateValue = item[dateField] as Date | null | undefined;
    const date = dateValue instanceof Date ? dateValue : null;

    if (isExpired(date)) {
      expired.push(item);
    } else {
      operational.push(item);
    }
  }

  return { operational, expired };
}

/**
 * Obtiene los días restantes dentro de la ventana operativa
 * @param date - Fecha de referencia (por defecto: hoy)
 * @returns Número de días restantes hasta el fin de la ventana operativa
 */
export function getDaysRemainingInOperationalWindow(date?: Date): number {
  const { end } = getOperationalWindow();
  const referenceDate = date ?? new Date();

  const diffTime = end.getTime() - referenceDate.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  return Math.max(0, diffDays);
}

/**
 * Etiqueta legible para el estado operacional
 * @param status - Estado operacional
 * @returns Etiqueta en español para el estado
 */
export function getOperationalStatusLabel(status: OperationalStatus): string {
  switch (status) {
    case 'expired':
      return 'Vencido';
    case 'current':
      return 'Actual';
    case 'upcoming':
      return 'Próximo';
    case 'beyond':
      return 'Fuera de ventana';
    default:
      return status;
  }
}

/**
 * Color sugerido para el estado operacional (nombre de color del sistema de temas)
 * @param status - Estado operacional
 * @returns Nombre del color a usar para este estado
 */
export function getOperationalStatusColor(status: OperationalStatus): string {
  switch (status) {
    case 'expired':
      return 'textMuted';
    case 'current':
      return 'success';
    case 'upcoming':
      return 'warning';
    case 'beyond':
      return 'textDisabled';
    default:
      return 'textPrimary';
  }
}
