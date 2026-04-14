/** Valida que un string no esté vacío */
export const validateRequired = (
  value: string | null | undefined,
  fieldName = 'Este campo'
): string | undefined => {
  if (!value || value.trim().length === 0) {
    return `${fieldName} es requerido`;
  }
  return undefined;
};

/** Valida formato de email */
export const validateEmail = (email: string | null | undefined): string | undefined => {
  if (!email || email.trim().length === 0) return 'El correo es requerido';
  if (!/\S+@\S+\.\S+/.test(email)) return 'Ingresa un correo válido';
  return undefined;
};

/** Valida longitud mínima */
export const validateMinLength = (
  value: string | null | undefined,
  min: number,
  fieldName = 'Este campo'
): string | undefined => {
  if (!value || value.trim().length < min) {
    return `${fieldName} debe tener al menos ${min} caracteres`;
  }
  return undefined;
};

/** Valida longitud máxima */
export const validateMaxLength = (
  value: string | null | undefined,
  max: number,
  fieldName = 'Este campo'
): string | undefined => {
  if (value && value.length > max) {
    return `${fieldName} no puede superar ${max} caracteres`;
  }
  return undefined;
};

/** Valida que la fecha de fin sea posterior a la de inicio */
export const validateDateRange = (
  startDate: Date | null | undefined,
  endDate: Date | null | undefined
): string | undefined => {
  if (!startDate || !endDate) return undefined;
  if (endDate <= startDate) {
    return 'La fecha de fin debe ser posterior a la fecha de inicio';
  }
  return undefined;
};

/** Valida número de teléfono básico (10 dígitos MX) */
export const validatePhone = (phone: string | null | undefined): string | undefined => {
  if (!phone || phone.trim().length === 0) return undefined; // opcional
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length < 10) return 'Ingresa un número de teléfono válido (10 dígitos)';
  return undefined;
};

/** Combina errores: retorna el primero encontrado */
export const firstError = (...errors: (string | undefined)[]): string | undefined =>
  errors.find((e) => e !== undefined);

/** Verifica si hay algún error en un objeto de errores */
export const hasErrors = (errors: Record<string, string | undefined>): boolean =>
  Object.values(errors).some((e) => e !== undefined);
