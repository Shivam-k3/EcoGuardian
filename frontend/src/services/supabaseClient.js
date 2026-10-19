import { createClient } from '@supabase/supabase-js';

// Supabase client for the browser. Only the PUBLISHABLE/anonymous key is used
// here — the secret key and DATABASE_URL are server-only and never shipped to
// the frontend (see frontend/.env.example).
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export const missingSupabaseEnvVars = [
  !supabaseUrl && 'VITE_SUPABASE_URL',
  !supabaseKey && 'VITE_SUPABASE_PUBLISHABLE_KEY',
].filter(Boolean);

export function isSupabaseConfigured() {
  return Boolean(supabaseUrl && supabaseKey);
}

// Capture recovery-link markers BEFORE createClient() parses the URL and clears
// window.location.hash (auth-js does this during client init). ResetPassword's
// effect runs much later — in a lazy chunk — when the URL markers are already
// gone, so it falls back to this module-load-time snapshot.
export const hadRecoveryAuthParams =
  typeof window !== 'undefined' &&
  (window.location.hash.includes('type=recovery') ||
    window.location.search.includes('type=recovery'));

export const supabase = isSupabaseConfigured()
  ? createClient(supabaseUrl, supabaseKey)
  : null;

export default supabase;
