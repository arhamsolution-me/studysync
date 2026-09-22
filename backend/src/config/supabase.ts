import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from './index';

export const supabase: SupabaseClient = createClient(
  config.supabase.url,
  config.supabase.anonKey,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  }
);

/**
 * Convert camelCase object keys to snake_case for Supabase PostgreSQL tables
 */
export function toSnakeCase(obj: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined) continue;
    const snakeKey = key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
    result[snakeKey] = value;
  }
  return result;
}

/**
 * Convert snake_case object keys to camelCase for TypeScript/Prisma compatibility
 */
export function toCamelCase(obj: Record<string, any>): Record<string, any> {
  if (!obj || typeof obj !== 'object') return obj;
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
    result[camelKey] = value;
  }
  return result;
}

/**
 * Test connectivity to Supabase
 */
export async function testSupabaseConnection(): Promise<boolean> {
  try {
    const { error } = await supabase.from('users').select('id').limit(1);
    if (error) {
      console.warn('[Supabase] Connection test notice:', error.message);
      return false;
    }
    console.log('[Supabase] ✅ Connected to Supabase Cloud Database (twluwkcduduvswmjvqfl)');
    return true;
  } catch (err: any) {
    console.error('[Supabase] Connection error:', err.message);
    return false;
  }
}
