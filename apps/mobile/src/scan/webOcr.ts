import { createWorker, type Worker } from 'tesseract.js';

let workerPromise: Promise<Worker> | undefined;

function getWorker() {
  workerPromise ??= createWorker('eng').catch((error) => {
    workerPromise = undefined;
    throw error;
  });
  return workerPromise;
}

async function improveForRecognition(uri: string): Promise<string | HTMLCanvasElement> {
  try {
    const response = await fetch(uri);
    const bitmap = await createImageBitmap(await response.blob());
    const scale = Math.min(2, 2400 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) return uri;

    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
    for (let index = 0; index < pixels.data.length; index += 4) {
      const gray =
        pixels.data[index] * 0.299 +
        pixels.data[index + 1] * 0.587 +
        pixels.data[index + 2] * 0.114;
      const contrasted = Math.max(0, Math.min(255, (gray - 128) * 1.8 + 128));
      pixels.data[index] = contrasted;
      pixels.data[index + 1] = contrasted;
      pixels.data[index + 2] = contrasted;
    }
    context.putImageData(pixels, 0, 0);
    return canvas;
  } catch {
    return uri;
  }
}

/** Reads text locally in the browser. The selected image is never uploaded. */
export async function recognizeTextOnWeb(uri: string) {
  const worker = await getWorker();
  const image = await improveForRecognition(uri);
  const result = await worker.recognize(image);
  return result.data.text;
}
