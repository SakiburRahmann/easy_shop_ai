/**
 * In-memory sliding-window rate limiter. Fine for a single-isolate MVP;
 * replace with Cloudflare KV/DO based limiting when the API scales out.
 */
export interface RateLimiter {
  /** Returns true if allowed (and records the hit), false if over the limit. */
  hit(key: string): boolean;
}

const buckets = new Map<string, number[]>();

export function createRateLimiter(maxPerWindow: number, windowMs = 60_000): RateLimiter {
  return {
    hit(key: string): boolean {
      const now = Date.now();
      let hits = buckets.get(key);
      if (!hits) {
        hits = [];
        buckets.set(key, hits);
      }
      while (hits.length && now - (hits[0] ?? 0) > windowMs) hits.shift();
      if (hits.length >= maxPerWindow) return false;
      hits.push(now);
      if (buckets.size > 10_000) {
        // crude pruning so the map cannot grow forever
        for (const [k, v] of buckets)
          if (!v.length || now - (v[v.length - 1] ?? 0) > windowMs) buckets.delete(k);
      }
      return true;
    },
  };
}
