import { Platform } from 'react-native';
import jsQR from 'jsqr';

// Pure pixel decode — runs anywhere, headless-testable.
export function decodeQrFromPixels(
  data: Uint8ClampedArray,
  width: number,
  height: number,
): string {
  if (!width || !height || data.length < width * height * 4)
    throw new Error('Invalid image data.');
  const result = jsQR(data, width, height);
  if (!result?.data) throw new Error('No QR code found in this image. Try a clearer photo.');
  return result.data;
}

// Uploaded-file decode. Web only (canvas); native uses camera/manual entry.
export async function decodeQrImageUri(uri: string): Promise<string> {
  if (Platform.OS !== 'web') throw new Error('Image upload decode is web-only. Use the camera on device.');
  const img = await loadImage(uri);
  const maxSide = 1200;
  const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
  const width = Math.max(1, Math.round(img.width * scale));
  const height = Math.max(1, Math.round(img.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Image decode is unavailable in this browser.');
  ctx.drawImage(img, 0, 0, width, height);
  const pixels = ctx.getImageData(0, 0, width, height);
  return decodeQrFromPixels(pixels.data, width, height);
}

function loadImage(uri: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not read this image file.'));
    img.src = uri;
  });
}
