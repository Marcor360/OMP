import { Alert as NativeDialog, Platform } from 'react-native';

/**
 * react-native-web@0.21 implementa Alert como no-op (`static alert() {}`),
 * asi que todo feedback o confirmacion basado en Alert es invisible en web.
 * Este modulo unifica ambos entornos.
 */
export const showAlert = (title: string, message?: string): void => {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined') {
      window.alert(message ? `${title}\n\n${message}` : title);
    }
    return;
  }

  NativeDialog.alert(title, message);
};

export const confirmAlert = (params: {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  destructive?: boolean;
}): Promise<boolean> => {
  if (Platform.OS === 'web') {
    if (typeof window === 'undefined') return Promise.resolve(false);
    return Promise.resolve(window.confirm(`${params.title}\n\n${params.message}`));
  }

  return new Promise((resolve) => {
    NativeDialog.alert(params.title, params.message, [
      { text: params.cancelLabel, style: 'cancel', onPress: () => resolve(false) },
      {
        text: params.confirmLabel,
        style: params.destructive ? 'destructive' : 'default',
        onPress: () => resolve(true),
      },
    ]);
  });
};
