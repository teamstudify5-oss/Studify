import { createClient } from "@supabase/supabase-js";

// Read Supabase credentials from environment variables with fallback defaults
const metaEnv = (typeof import.meta !== 'undefined' && import.meta.env) ? import.meta.env : {};
export const SUPABASE_URL = (metaEnv.VITE_SUPABASE_URL || "https://qmavgwghcolismyhfufn.supabase.co").trim().replace(/\/rest\/v1\/?$/, "").replace(/\/+$/, "");
export const SUPABASE_ANON_KEY = (metaEnv.VITE_SUPABASE_ANON_KEY || "sb_publishable_c_GIM1sA7g9zcj9yXi-x_Q_OajYRgTT").trim();

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/**
 * Initiates Google OAuth sign in using Supabase.
 * Redirects the user to Google authentication flow.
 *
 * @param {object} [options] - Optional custom options for signInWithOAuth
 * @returns {Promise<{ data: any, error: any }>}
 */
export const signInWithGoogle = async (options = {}) => {
  const defaultRedirectTo =
    typeof window !== 'undefined'
      ? `${window.location.origin}/`
      : undefined;

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: defaultRedirectTo,
      ...options,
    },
  });

  if (error) {
    console.error('Error initiating Google login with Supabase:', error.message || error);
  }

  return { data, error };
};

// Alias for convenience
export const loginWithGoogle = signInWithGoogle;

export default supabase;
