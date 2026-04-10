import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';

type WebDocumentPickerAsset = DocumentPicker.DocumentPickerAsset & {
  file?: File;
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
  asset: DocumentPicker.DocumentPickerAsset
): Promise<string> => {
  if (Platform.OS === 'web') {
    return readWebDocumentAsBase64(asset);
  }

  return FileSystem.readAsStringAsync(asset.uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
};
