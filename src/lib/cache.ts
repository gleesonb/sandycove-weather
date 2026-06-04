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

/**
 * Stale-while-revalidate cache helper.
 * Stores data with a long KV TTL but tracks freshness separately.
 * Returns { data, stale } — stale=true means data is usable but should be refreshed.
 */
export async function getCachedSWR<T>(
  kv: KVNamespace,
  key: string,
  freshTtlSeconds: number,
): Promise<{ data: T; fetchedAt: string; stale: boolean } | null> {
  const raw = await kv.get(key);
  if (!raw) return null;
  const entry = JSON.parse<{ data: T; fetchedAt: string }>(raw);
  const age = (Date.now() - new Date(entry.fetchedAt).getTime()) / 1000;
  return { ...entry, stale: age > freshTtlSeconds };
}

export async function setCacheSWR<T>(
  kv: KVNamespace,
  key: string,
  data: T,
  staleTtlSeconds: number,
): Promise<void> {
  const entry = {
    data,
    fetchedAt: new Date().toISOString(),
  };
  await kv.put(key, JSON.stringify(entry), {
    expirationTtl: staleTtlSeconds,
  });
}
