/**
 * Pruebas unitarias — helper compartido de logging de errores.
 *
 * Verifica que logError siempre incluye congregationId en el log (incluso
 * cuando es null, para que las consultas de logs puedan filtrar/alertar
 * por congregacion sin depender de que cada call site lo recuerde) y que
 * adjunta el mensaje del error cuando se provee.
 */

jest.mock('firebase-functions', () => ({
  logger: { error: jest.fn(), info: jest.fn(), warn: jest.fn() },
}));

import { logger } from 'firebase-functions';
import { logError } from '../shared/logging.js';

describe('logError', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('includes congregationId even when explicitly null', () => {
    logError('something failed', { congregationId: null, step: 'auth' });

    expect(logger.error).toHaveBeenCalledWith('something failed', {
      congregationId: null,
      step: 'auth',
    });
  });

  it('preserves a real congregationId alongside extra context', () => {
    logError('something failed', { congregationId: 'c1', eventId: 'evt_1' });

    expect(logger.error).toHaveBeenCalledWith('something failed', {
      congregationId: 'c1',
      eventId: 'evt_1',
    });
  });

  it('attaches the error message when an Error instance is provided', () => {
    logError('something failed', { congregationId: 'c1' }, new Error('boom'));

    expect(logger.error).toHaveBeenCalledWith('something failed', {
      congregationId: 'c1',
      errorMessage: 'boom',
    });
  });

  it('stringifies non-Error error values', () => {
    logError('something failed', { congregationId: 'c1' }, 'raw string error');

    expect(logger.error).toHaveBeenCalledWith('something failed', {
      congregationId: 'c1',
      errorMessage: 'raw string error',
    });
  });
});
