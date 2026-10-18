import { describe, expect, it } from 'vitest';
import { shopSlugSchema, userRoleSchema } from '../src/index';

describe('userRoleSchema', () => {
  it('accepts the three platform roles', () => {
    expect(userRoleSchema.options).toEqual(['seller', 'customer', 'admin']);
  });

  it('rejects unknown roles', () => {
    expect(userRoleSchema.safeParse('hacker').success).toBe(false);
  });
});

describe('shopSlugSchema', () => {
  it('accepts a valid slug', () => {
    expect(shopSlugSchema.safeParse('dhaka-threads').success).toBe(true);
  });

  it('rejects uppercase and spaces', () => {
    expect(shopSlugSchema.safeParse('Dhaka Threads').success).toBe(false);
  });
});
