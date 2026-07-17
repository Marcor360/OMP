import { logger } from 'firebase-functions';

/**
 * Contexto minimo para logs de error en Functions. congregationId es
 * obligatorio (usa null explicito cuando el error ocurre antes de resolver
 * la congregacion, p. ej. fallas de autenticacion o de firma de webhook)
 * para que las consultas de logs puedan filtrar/alertar por congregacion
 * sin depender de que cada call site recuerde incluirlo.
 */
export type ErrorLogContext = {
  congregationId: string | null;
  [key: string]: unknown;
};

export const logError = (message: string, context: ErrorLogContext, error?: unknown): void => {
  logger.error(message, {
    ...context,
    ...(error !== undefined
      ? { errorMessage: error instanceof Error ? error.message : String(error) }
      : {}),
  });
};
