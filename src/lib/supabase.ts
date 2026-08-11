/**
 * Supabase wiring.
 *
 * Deliberately thin for this sprint. The game is fully playable without any
 * Supabase configuration at all — if the environment variables are absent the
 * client is simply null and the app falls back to a local demo manager saved
 * in localStorage. That keeps "can I test the game?" independent of "is auth
 * finished?".
 *
 * To enable it, set in `.env.local` (and in Netlify's environment):
 *   VITE_SUPABASE_URL=...
 *   VITE_SUPABASE_ANON_KEY=...
 * and apply `supabase/schema.sql` to the project.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const isSupabaseConfigured = Boolean(url && anonKey);

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(url as string, anonKey as string)
  : null;

function requireClient(): SupabaseClient {
  if (!supabase) {
    throw new Error(
      'Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.',
    );
  }
  return supabase;
}

export async function signUpWithEmail(email: string, password: string) {
  return requireClient().auth.signUp({ email, password });
}

export async function signInWithEmail(email: string, password: string) {
  return requireClient().auth.signInWithPassword({ email, password });
}

export async function signOut() {
  return requireClient().auth.signOut();
}

export async function getCurrentUser() {
  if (!supabase) return null;
  const { data } = await supabase.auth.getUser();
  return data.user ?? null;
}
