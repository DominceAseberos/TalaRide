import { useSyncExternalStore } from 'react';
import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { randomUUID } from 'expo-crypto';

export type ScanDraft = { id: string; uri?: string; candidates: string[]; message: string };
let draft: ScanDraft | null = null;
const listeners = new Set<() => void>();
const folder = FileSystem.cacheDirectory ? `${FileSystem.cacheDirectory}talaride-scans/` : null;
let initialized: Promise<void> | undefined;

function emit() {
  listeners.forEach((listener) => listener());
}

export function prepareScanCache() {
  if (Platform.OS === 'web' || !folder) return Promise.resolve();
  initialized ??= (async () => {
    // Remove only this feature's directory, including abandoned photos after a crash.
    await FileSystem.deleteAsync(folder, { idempotent: true });
    await FileSystem.makeDirectoryAsync(folder, { intermediates: true });
  })().catch((error) => {
    initialized = undefined;
    throw error;
  });
  return initialized;
}

export async function retainScanPhoto(source: string) {
  if (Platform.OS === 'web') return source;
  if (!folder) throw new Error('Camera cache is unavailable.');
  await prepareScanCache();
  const uri = `${folder}${randomUUID()}.jpg`;
  await FileSystem.copyAsync({ from: source, to: uri });
  await discardCapture(source).catch(() => {
    /* The scanner retries source cleanup when processing ends. */
  });
  return uri;
}

export async function discardCapture(uri: string) {
  if (Platform.OS === 'web' && uri.startsWith('blob:')) {
    URL.revokeObjectURL(uri);
    return;
  }
  if (
    Platform.OS !== 'web' &&
    FileSystem.cacheDirectory &&
    uri.startsWith(FileSystem.cacheDirectory)
  ) {
    await FileSystem.deleteAsync(uri, { idempotent: true });
  }
}

export function publishDraft(value: Omit<ScanDraft, 'id'>) {
  clearDraft();
  draft = { ...value, id: randomUUID() };
  emit();
}

export function clearDraft(id?: string) {
  if (id && draft?.id !== id) return;
  const old = draft;
  draft = null;
  emit();
  if (old?.uri)
    void discardCapture(old.uri).catch(() => {
      /* Retried by startup cleanup. */
    });
}

export function useScanDraft() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    () => draft,
    () => null,
  );
}
