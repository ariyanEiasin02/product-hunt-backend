/**
 * Lightweight in-memory TTL cache.
 *
 * Why: On a single Render instance the fastest cache is the process itself —
 * zero network round-trips, zero external services, zero cost. Hot, mostly
 * static endpoints (home page, footer, category lists, admin dashboard)
 * are cached here for 30–60s.
 *
 * When to move to Redis:
 *  - When you scale to 2+ instances (each instance would have its own cache)
 *  - When you need cache invalidation that is visible across instances
 * The public API (cacheGet / cacheSet / getOrSet / cacheDel) is intentionally
 * shaped so a Redis implementation can replace it without touching callers.
 */

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

const store = new Map<string, CacheEntry<unknown>>();

/** Hard cap so a buggy key generator can never OOM the process. */
const MAX_ENTRIES = 10_000;

/** Stats (useful for a /health or /metrics endpoint). */
const stats = { hits: 0, misses: 0 };

function isExpired<T>(entry: CacheEntry<T>): boolean {
  return entry.expiresAt <= Date.now();
}

/** Read a value from the cache. Returns undefined on miss/expiry. */
export function cacheGet<T>(key: string): T | undefined {
  const entry = store.get(key) as CacheEntry<T> | undefined;
  if (!entry) {
    stats.misses++;
    return undefined;
  }
  if (isExpired(entry)) {
    store.delete(key);
    stats.misses++;
    return undefined;
  }
  stats.hits++;
  return entry.value;
}

/** Write a value to the cache with a TTL (milliseconds). */
export function cacheSet<T>(key: string, value: T, ttlMs: number): void {
  // Lazy eviction protects against unbounded growth.
  if (store.size >= MAX_ENTRIES) {
    evictExpired();
    if (store.size >= MAX_ENTRIES) {
      // Still full — evict the oldest entry as a last resort.
      const oldest = store.keys().next().value;
      if (oldest !== undefined) store.delete(oldest);
    }
  }
  store.set(key, { value, expiresAt: Date.now() + ttlMs });
}

/**
 * Get a cached value or produce + cache it.
 * Catches producer errors so a failed DB query never gets cached.
 */
export async function getOrSet<T>(
  key: string,
  ttlMs: number,
  producer: () => Promise<T>
): Promise<T> {
  const cached = cacheGet<T>(key);
  if (cached !== undefined) return cached;

  const value = await producer();
  cacheSet(key, value, ttlMs);
  return value;
}

/** Delete a single key. */
export function cacheDel(key: string): void {
  store.delete(key);
}

/**
 * Delete every key that starts with a prefix.
 * Useful to invalidate e.g. all "home:" entries after a write.
 */
export function cacheDelPrefix(prefix: string): void {
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) store.delete(key);
  }
}

/** Remove all expired entries. */
export function evictExpired(): void {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (entry.expiresAt <= now) store.delete(key);
  }
}

/** Clear the whole cache. */
export function cacheFlush(): void {
  store.clear();
}

export function cacheStats() {
  return { size: store.size, ...stats };
}

// Periodic background sweep — keeps memory flat even if keys are never read
// again. `unref()` so it never keeps the process alive.
const SWEEP_INTERVAL_MS = 60_000;
const sweepTimer = setInterval(evictExpired, SWEEP_INTERVAL_MS);
if (typeof sweepTimer.unref === "function") sweepTimer.unref();

export default { cacheGet, cacheSet, getOrSet, cacheDel, cacheDelPrefix, cacheFlush, evictExpired, cacheStats };
