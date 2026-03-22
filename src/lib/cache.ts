/** KV cache helpers */

export async function getCached<T>(
  kv: KVNamespace,
  key: string,
): Promise<{ data: T; fetchedAt: string } | null> {
  const raw = await kv.get(key);
  if (!raw) return null;
  return JSON.parse(raw);
}

export async function setCache<T>(
  kv: KVNamespace,
  key: string,
  data: T,
  ttlSeconds: number,
): Promise<void> {
  const entry = {
    data,
    fetchedAt: new Date().toISOString(),
  };
  await kv.put(key, JSON.stringify(entry), {
    expirationTtl: ttlSeconds,
  });
}
