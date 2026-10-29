import { createClient } from "@supabase/supabase-js";

// Supabase project credentials (you can replace these two variables anytime)
const SUPABASE_URL = "https://qmavgwghcolismyhfufn.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_c_GIM1sA7g9zcj9yXi-x_Q_OajYRgTT";

// Normalize URL to remove any trailing slash or /rest/v1 path if provided
const normalizedUrl = SUPABASE_URL.replace(/\/rest\/v1\/?$/, "").replace(/\/+$/, "");

export const supabase = createClient(normalizedUrl, SUPABASE_ANON_KEY);

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
