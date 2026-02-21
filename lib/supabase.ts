import { createClient } from '@supabase/supabase-js';

let _client: ReturnType<typeof createClient> | null = null;

export function getSupabase() {
  if (!_client) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_KEY;
    if (!url || !key) {
      throw new Error(`Missing env vars: SUPABASE_URL=${!!url}, SUPABASE_SERVICE_KEY=${!!key}`);
    }
    _client = createClient(url, key);
  }
  return _client;
}
