import { Platform } from 'react-native';
import { authenticateLocally, getBiometricAvailability } from '@/src/services/security/biometric-service';

const mockHasHardwareAsync = jest.fn();
const mockIsEnrolledAsync = jest.fn();
const mockAuthenticateAsync = jest.fn();

jest.mock('expo-local-authentication', () => ({
  hasHardwareAsync: () => mockHasHardwareAsync(),
  isEnrolledAsync: () => mockIsEnrolledAsync(),
  authenticateAsync: (...args: unknown[]) => mockAuthenticateAsync(...args),
}));

describe('biometric-service', () => {
  const originalPlatformOS = Platform.OS;

  beforeEach(() => {
    jest.clearAllMocks();
    Platform.OS = 'ios';
  });

  afterEach(() => {
    Platform.OS = originalPlatformOS;
  });

  describe('getBiometricAvailability', () => {
    it('reports hardware and enrollment from the native module', async () => {
      mockHasHardwareAsync.mockResolvedValue(true);
      mockIsEnrolledAsync.mockResolvedValue(true);

      const result = await getBiometricAvailability();

      expect(result).toEqual({ hasHardware: true, isEnrolled: true });
    });

    it('never calls the native module on web', async () => {
      Platform.OS = 'web';

      const result = await getBiometricAvailability();

      expect(result).toEqual({ hasHardware: false, isEnrolled: false });
      expect(mockHasHardwareAsync).not.toHaveBeenCalled();
    });

    it('falls back to unavailable if the native calls throw', async () => {
      mockHasHardwareAsync.mockRejectedValue(new Error('native error'));
      mockIsEnrolledAsync.mockResolvedValue(true);

      const result = await getBiometricAvailability();

      expect(result).toEqual({ hasHardware: false, isEnrolled: false });
    });
  });

  describe('authenticateLocally', () => {
    it('returns success when the native module succeeds', async () => {
      mockAuthenticateAsync.mockResolvedValue({ success: true });

      const result = await authenticateLocally({ promptMessage: 'msg', cancelLabel: 'cancel' });

      expect(result).toEqual({ success: true });
      expect(mockAuthenticateAsync).toHaveBeenCalledWith({
        promptMessage: 'msg',
        cancelLabel: 'cancel',
        disableDeviceFallback: false,
      });
    });

    it('maps user_cancel to reason "canceled"', async () => {
      mockAuthenticateAsync.mockResolvedValue({ success: false, error: 'user_cancel' });

      const result = await authenticateLocally({ promptMessage: 'm', cancelLabel: 'c' });

      expect(result).toEqual({ success: false, reason: 'canceled', errorCode: 'user_cancel' });
    });

    it('maps lockout to reason "lockout"', async () => {
      mockAuthenticateAsync.mockResolvedValue({ success: false, error: 'lockout' });

      const result = await authenticateLocally({ promptMessage: 'm', cancelLabel: 'c' });

      expect(result).toEqual({ success: false, reason: 'lockout', errorCode: 'lockout' });
    });

    it('maps not_enrolled to reason "unavailable"', async () => {
      mockAuthenticateAsync.mockResolvedValue({ success: false, error: 'not_enrolled' });

      const result = await authenticateLocally({ promptMessage: 'm', cancelLabel: 'c' });

      expect(result).toEqual({ success: false, reason: 'unavailable', errorCode: 'not_enrolled' });
    });

    it('never calls the native module and reports unavailable on web', async () => {
      Platform.OS = 'web';

      const result = await authenticateLocally({ promptMessage: 'm', cancelLabel: 'c' });

      expect(result).toEqual({ success: false, reason: 'unavailable' });
      expect(mockAuthenticateAsync).not.toHaveBeenCalled();
    });
  });
});
