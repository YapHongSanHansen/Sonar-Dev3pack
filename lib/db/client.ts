import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { config } from '../config.js';

let _client: SupabaseClient | null = null;

// Service-role key bypasses RLS — only safe in server-side code.
// Never expose this client to the browser.
export function supabase(): SupabaseClient {
  if (_client) return _client;
  _client = createClient(config.SUPABASE_URL, config.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return _client;
}
