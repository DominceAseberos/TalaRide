/** Chunked keychain storage: session JSON can exceed SecureStore's per-item limit. */
type Driver = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
};
type Manifest = { generation: string; count: number };
export function createSessionStorage(driver: Driver, newId: () => string) {
  let queue: Promise<unknown> = Promise.resolve();
  function serialized<T>(task: () => Promise<T>): Promise<T> {
    const next = queue.then(task, task);
    queue = next.catch(() => {});
    return next;
  }
  async function manifest(key: string): Promise<Manifest | null> {
    const value = await driver.getItem(key);
    if (!value) return null;
    try {
      const parsed = JSON.parse(value) as Manifest;
      if (
        !parsed ||
        !/^[a-zA-Z0-9-]+$/.test(parsed.generation) ||
        !Number.isInteger(parsed.count) ||
        parsed.count < 1 ||
        parsed.count > 256
      )
        throw new Error('Invalid manifest');
      return parsed;
    } catch {
      // Corrupt metadata cannot restore a session or permanently block a new sign-in.
      await driver.removeItem(key);
      return null;
    }
  }
  const chunkKey = (key: string, item: Manifest, index: number) =>
    `${key}.${item.generation}.${index}`;
  async function removeChunks(key: string, item: Manifest | null) {
    if (item)
      await Promise.all(
        Array.from({ length: item.count }, (_, i) => driver.removeItem(chunkKey(key, item, i))),
      );
  }
  return {
    getItem: (key: string) =>
      serialized(async () => {
        const item = await manifest(key);
        if (!item) return null;
        const chunks = await Promise.all(
          Array.from({ length: item.count }, (_, i) => driver.getItem(chunkKey(key, item, i))),
        );
        if (chunks.some((chunk) => chunk === null)) {
          await driver.removeItem(key);
          await removeChunks(key, item).catch(() => {});
          return null;
        }
        return chunks.join('');
      }),
    setItem: (key: string, value: string) =>
      serialized(async () => {
        // Unicode code points keep each item below 1600 UTF-8 bytes without splitting surrogates.
        const chars = Array.from(value);
        const item = { generation: newId(), count: Math.max(1, Math.ceil(chars.length / 400)) };
        if (item.count > 256) throw new Error('Session is too large to store securely.');
        const old = await manifest(key);
        try {
          for (let i = 0; i < item.count; i++)
            await driver.setItem(
              chunkKey(key, item, i),
              chars.slice(i * 400, (i + 1) * 400).join(''),
            );
          await driver.setItem(key, JSON.stringify(item));
        } catch (error) {
          await removeChunks(key, item).catch(() => {});
          throw error;
        }
        // An old orphan is safer than reporting a failed write after the new manifest was committed.
        await removeChunks(key, old).catch(() => {});
      }),
    removeItem: (key: string) =>
      serialized(async () => {
        const old = await manifest(key);
        await driver.removeItem(key);
        await removeChunks(key, old).catch(() => {});
      }),
  };
}
