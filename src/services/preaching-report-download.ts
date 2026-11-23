import { Platform } from 'react-native';

export const downloadPreachingReport = async (name: string, csv: string): Promise<void> => {
  if (!/^preaching-(summary|detail)-\d{4}-\d{2}\.csv$/.test(name)) throw new Error('Invalid download filename');

  if (Platform.OS === 'web') {
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
    return;
  }

  const [fs, sharing, crypto] = await Promise.all([
    import('expo-file-system/legacy'), import('expo-sharing'), import('expo-crypto'),
  ]);
  if (!fs.cacheDirectory || !(await sharing.isAvailableAsync())) throw new Error('Sharing unavailable');
  const directory = fs.cacheDirectory + 'omp-csv-' + crypto.randomUUID() + '/';
  await fs.makeDirectoryAsync(directory);
  try {
    const uri = directory + name;
    await fs.writeAsStringAsync(uri, csv, { encoding: fs.EncodingType.UTF8 });
    await sharing.shareAsync(uri, { mimeType: 'text/csv', UTI: 'public.comma-separated-values-text' });
  } finally {
    await fs.deleteAsync(directory, { idempotent: true }).catch(() => undefined);
  }
};
