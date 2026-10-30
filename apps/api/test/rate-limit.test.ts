import { describe, expect, it } from 'vitest';
import { createRateLimiter } from '../src/lib/rate-limit';

describe('createRateLimiter', () => {
  it('allows up to the limit then blocks within the window', () => {
    const limiter = createRateLimiter(3);
    expect(limiter.hit('ip1')).toBe(true);
    expect(limiter.hit('ip1')).toBe(true);
    expect(limiter.hit('ip1')).toBe(true);
    expect(limiter.hit('ip1')).toBe(false);
    expect(limiter.hit('ip2')).toBe(true); // independent keys
  });

  it('blocks beyond the limit even per call ordering', () => {
    const limiter = createRateLimiter(2, 60_000);
    expect(limiter.hit('k')).toBe(true);
    expect(limiter.hit('k')).toBe(true);
    expect(limiter.hit('k')).toBe(false);
    expect(limiter.hit('other')).toBe(true);
  });
});
