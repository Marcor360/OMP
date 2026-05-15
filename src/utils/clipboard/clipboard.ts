import * as Clipboard from 'expo-clipboard';

export const copyToClipboard = async (value: string): Promise<void> => {
  const text = value.trim();
  if (!text) {
    throw new Error('No hay texto para copiar.');
  }

  await Clipboard.setStringAsync(text);
};
