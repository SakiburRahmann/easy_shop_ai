import { z } from 'zod';

/**
 * Shared contracts between api, web and mobile.
 * Anything web and mobile must agree on lives here: types, Zod schemas,
 * API client helpers. Import from '@easyshop/shared' in every app.
 */

export const userRoleSchema = z.enum(['seller', 'customer', 'admin']);
export type UserRole = z.infer<typeof userRoleSchema>;

export const shopSlugSchema = z
  .string()
  .min(3)
  .max(50)
  .regex(/^[a-z0-9][a-z0-9-]*[a-z0-9]$/, 'lowercase letters, numbers and hyphens only');
export type ShopSlug = z.infer<typeof shopSlugSchema>;
