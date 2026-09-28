import { requireOptionalNativeModule } from 'expo';
import { Platform } from 'react-native';
import type { RecognitionResult } from 'expo-mlkit-ocr';
import { extractIdentifiers } from './identifiers';

type OcrModule = {
  isSupported: () => boolean;
  recognizeText: (uri: string) => Promise<RecognitionResult>;
};

export async function recognizeVehicle(uri: string) {
  try {
    if (Platform.OS === 'web') {
      const { recognizeTextOnWeb } = await import('./webOcr');
      const text = await recognizeTextOnWeb(uri);
      const candidates = extractIdentifiers(text);
      return {
        candidates,
        message: candidates.length
          ? ''
          : 'No vehicle number was found. Enter it manually or choose a clearer photo.',
      };
    }

    const module = requireOptionalNativeModule<OcrModule>('ExpoMlkitOcr');
    if (!module || !module.isSupported()) {
      return {
        candidates: [] as string[],
        message:
          'Text recognition is unavailable in this app build. Install a development build or enter the vehicle number manually.',
      };
    }
    const result = await module.recognizeText(uri);
    const candidates = extractIdentifiers(result.text);
    return {
      candidates,
      message: candidates.length
        ? ''
        : 'No vehicle number was found. Enter it manually or retake the photo.',
    };
  } catch {
    return {
      candidates: [] as string[],
      message: 'The image could not be read. Enter the number manually or retake the photo.',
    };
  }
}
