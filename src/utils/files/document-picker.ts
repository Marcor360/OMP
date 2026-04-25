import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';

type WebDocumentPickerAsset = DocumentPicker.DocumentPickerAsset & {
  file?: File;
};

interface ReadDocumentPickerAssetOptions {
  processKey?: string;
}

const DEFAULT_PROCESS_KEY = 'general';

const sanitizePathSegment = (value: string): string => {
  const cleaned = value
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');

  return cleaned.length > 0 ? cleaned : 'archivo';
};

const getFileExtension = (fileName?: string | null): string => {
  if (!fileName) return '';

  const lastDot = fileName.lastIndexOf('.');
  if (lastDot < 0 || lastDot === fileName.length - 1) return '';

  return sanitizePathSegment(fileName.slice(lastDot + 1)).toLowerCase();
};

const buildInternalDocumentUri = async (
  asset: DocumentPicker.DocumentPickerAsset,
  processKey = DEFAULT_PROCESS_KEY
): Promise<string> => {
  const documentDirectory = FileSystem.documentDirectory;

  if (!documentDirectory) {
    throw new Error('No esta disponible el almacenamiento interno de la app.');
  }

  const safeProcessKey = sanitizePathSegment(processKey);
  const targetDirectory = `${documentDirectory}imports/${safeProcessKey}/`;
  const fileExtension = getFileExtension(asset.name);
  const baseName = sanitizePathSegment(
    fileExtension ? asset.name.slice(0, -(fileExtension.length + 1)) : asset.name || 'documento'
  );
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const targetFileName = fileExtension
    ? `${baseName}-${suffix}.${fileExtension}`
    : `${baseName}-${suffix}`;

  const directoryInfo = await FileSystem.getInfoAsync(targetDirectory);
  if (!directoryInfo.exists) {
    await FileSystem.makeDirectoryAsync(targetDirectory, { intermediates: true });
  }

  return `${targetDirectory}${targetFileName}`;
};

export const copyDocumentPickerAssetToInternalStorage = async (
  asset: DocumentPicker.DocumentPickerAsset,
  options?: ReadDocumentPickerAssetOptions
): Promise<string> => {
  if (Platform.OS === 'web') {
    return asset.uri;
  }

  const targetUri = await buildInternalDocumentUri(asset, options?.processKey);
  await FileSystem.copyAsync({
    from: asset.uri,
    to: targetUri,
  });

  return targetUri;
};

const readBlobAsDataUrl = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onerror = () => {
      reject(new Error('No se pudo leer el archivo seleccionado.'));
    };

    reader.onload = () => {
      if (typeof reader.result !== 'string') {
        reject(new Error('No se pudo convertir el archivo seleccionado.'));
        return;
      }

      resolve(reader.result);
    };

    reader.readAsDataURL(blob);
  });

const extractBase64FromDataUrl = (dataUrl: string): string => {
  const commaIndex = dataUrl.indexOf(',');
  if (commaIndex < 0) return '';

  return dataUrl.slice(commaIndex + 1).trim();
};

const readWebDocumentAsBase64 = async (asset: DocumentPicker.DocumentPickerAsset): Promise<string> => {
  const file = (asset as WebDocumentPickerAsset).file;

  if (file) {
    const dataUrl = await readBlobAsDataUrl(file);
    const base64 = extractBase64FromDataUrl(dataUrl);
    if (base64.length > 0) return base64;
  }

  const response = await fetch(asset.uri);
  if (!response.ok) {
    throw new Error('No se pudo leer el PDF seleccionado.');
  }

  const blob = await response.blob();
  const dataUrl = await readBlobAsDataUrl(blob);
  const base64 = extractBase64FromDataUrl(dataUrl);

  if (base64.length === 0) {
    throw new Error('No se pudo convertir el PDF seleccionado a base64.');
  }

  return base64;
};

export const readDocumentPickerAssetAsBase64 = async (
  asset: DocumentPicker.DocumentPickerAsset,
  options?: ReadDocumentPickerAssetOptions
): Promise<string> => {
  if (Platform.OS === 'web') {
    return readWebDocumentAsBase64(asset);
  }

  const internalUri = await copyDocumentPickerAssetToInternalStorage(asset, options);

  return FileSystem.readAsStringAsync(internalUri, {
    encoding: FileSystem.EncodingType.Base64,
  });
};
