import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { User } from '../types';
import { supabase, signInWithGoogle } from '../supabaseClient.js';
import { clearStudifyContentCaches } from '../services/localCacheReset';
import { storageService } from '../services/storage';
import { workspaceService } from '../services/workspaceService';
import { removalService } from '../services/removalService';

interface AuthContextType {
  currentUser: User | null;
  isAuthenticated: boolean;
  isOwner: boolean;
  authReady: boolean;
  logout: () => Promise<void>;
  signInWithGoogle: (options?: any) => Promise<{ data: any; error: any }>;
  isAuthModalOpen: boolean;
  openAuthModal: (defaultMode?: 'login' | 'signup') => void;
  closeAuthModal: () => void;
  authModalMode: 'login' | 'signup';
  setAuthModalMode: (mode: 'login' | 'signup') => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const AUTH_STORAGE_KEY = 'pyq_auth_user_v1';

/**
 * Purges in-memory and local user/content caches whenever the active account
 * changes (User A -> User B or User A -> signed out) so data never leaks across accounts.
 */
export function syncAccountCacheIsolation(prevUserId: string | null, nextUserId: string | null): boolean {
  if (prevUserId === nextUserId) {
    return false;
  }

  storageService.clearInMemoryState();
  workspaceService.clearLocalWorkspaceCache();
  workspaceService.setStorageScope(nextUserId ? 'user' : 'guest');
  removalService.clearLocalReports();

  if (prevUserId !== null) {
    clearStudifyContentCaches();
  }

  return true;
}

// Helper to map a real Supabase user object into the Studify User type
// Priority 2: Never allow users to self-assign owner role via user_metadata.
// Only check server-controlled app_metadata or verified database role.
const mapSupabaseUser = (supabaseUser: any, isVerifiedAdmin: boolean = false): User => {
  const metadata = supabaseUser?.user_metadata || {};
  const appMetadata = supabaseUser?.app_metadata || {};
  const email = supabaseUser?.email || '';
  const fullName =
    metadata.full_name ||
    metadata.name ||
    (email ? email.split('@')[0] : 'Studify Student');

  // Compute initials for avatar (e.g. "Alex Morgan" -> "AM", "Alex" -> "AL")
  const parts = fullName.trim().split(/\s+/);
  let avatarInitials = 'ST';
  if (parts.length >= 2 && parts[0] && parts[1]) {
    avatarInitials = `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  } else if (parts.length === 1 && parts[0].length >= 2) {
    avatarInitials = parts[0].slice(0, 2).toUpperCase();
  } else if (parts.length === 1 && parts[0].length === 1) {
    avatarInitials = `${parts[0][0]}S`.toUpperCase();
  }

  // Preserve original Supabase account creation timestamp
  const createdAt = typeof supabaseUser?.created_at === 'string' ? supabaseUser.created_at : null;
  const joinedDate = createdAt
    ? new Date(createdAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
    : undefined;

  // Verify admin status from secure sources only (app_metadata or database verification)
  const metaEnv =
    typeof import.meta !== 'undefined' && (import.meta as any).env
      ? (import.meta as any).env
      : {};
  const ownerEmail = (metaEnv.VITE_OWNER_EMAIL || 'teamstudify5@gmail.com').toLowerCase().trim();
  const hasAppMetaAdmin = appMetadata.role === 'owner' || appMetadata.role === 'admin' || appMetadata.is_admin === true;
  const isOwner = hasAppMetaAdmin || isVerifiedAdmin || (email && email.toLowerCase().trim() === ownerEmail);

  return {
    id: supabaseUser.id,
    name: fullName,
    email: email,
    role: isOwner ? 'owner' : 'student',
    avatarInitials,
    institution: metadata.institution || 'Studify Scholar',
    joinedDate,
    createdAt,
  };
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState<boolean>(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<'login' | 'signup'>('login');
  const activeUserIdRef = useRef<string | null>(null);
  const authSeqRef = useRef<number>(0);

  // 1. Purge legacy test account key on mount & synchronize with Supabase Auth
  useEffect(() => {
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.removeItem(AUTH_STORAGE_KEY);
      } catch {
        // ignore
      }
    }

    let isMounted = true;
    let roleResolved = false;

    const authFailsafeTimer = setTimeout(() => {
      if (isMounted && !roleResolved) {
        setAuthReady(true);
      }
    }, 4500);

    const applySessionTransition = async (supabaseUser: any | null) => {
      const seq = ++authSeqRef.current;
      const nextUserId: string | null = supabaseUser?.id || null;

      syncAccountCacheIsolation(activeUserIdRef.current, nextUserId);
      workspaceService.setStorageScope(nextUserId ? 'user' : 'guest');
      activeUserIdRef.current = nextUserId;

      if (!supabaseUser) {
        roleResolved = true;
        if (isMounted) {
          setCurrentUser(null);
          setAuthReady(true);
        }
        return;
      }

      let isDbAdmin = false;
      try {
        const rolePromise = supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', supabaseUser.id)
          .maybeSingle();

        const roleResult = await Promise.race([
          rolePromise,
          new Promise<{ data: null; error: { message: string } }>((resolve) =>
            setTimeout(() => resolve({ data: null, error: { message: 'role lookup timeout' } }), 4000)
          ),
        ]);

        if (roleResult?.error) {
          console.warn('user_roles lookup notice:', roleResult.error.message);
        } else if (
          roleResult?.data &&
          (roleResult.data.role === 'owner' || roleResult.data.role === 'admin')
        ) {
          isDbAdmin = true;
        }
      } catch (err) {
        console.warn('user_roles lookup exception:', err);
      }

      if (!isMounted || seq !== authSeqRef.current) {
        return;
      }

      roleResolved = true;
      setCurrentUser(mapSupabaseUser(supabaseUser, isDbAdmin));
      setAuthReady(true);
    };

    supabase.auth
      .getSession()
      .then(({ data: { session }, error }) => {
        if (error) {
          console.error('Error fetching Supabase session:', error.message);
          roleResolved = true;
          if (isMounted) {
            setAuthReady(true);
          }
          return;
        }
        if (isMounted) {
          void applySessionTransition(session?.user || null);
        }
      })
      .catch((err) => {
        console.error('Unexpected error checking session:', err);
        roleResolved = true;
        if (isMounted) {
          setAuthReady(true);
        }
      });

    // 2. Subscribe to Supabase auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!isMounted) return;
      void applySessionTransition(session?.user || null);
    });

    return () => {
      isMounted = false;
      clearTimeout(authFailsafeTimer);
      subscription?.unsubscribe();
    };
  }, []);

  // Sign out cleanly through Supabase and purge user/content caches
  const logout = async () => {
    authSeqRef.current += 1;
    const hadUser = activeUserIdRef.current !== null;
    activeUserIdRef.current = null;

    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.error('Error during Supabase signOut:', err);
    } finally {
      setCurrentUser(null);
      setAuthReady(true);
      storageService.clearInMemoryState();
      workspaceService.clearLocalWorkspaceCache();
      workspaceService.setStorageScope('guest');
      removalService.clearLocalReports();
      clearStudifyContentCaches();
      if (hadUser && typeof window !== 'undefined') {
        try {
          window.dispatchEvent(new CustomEvent('studify:caches-cleared'));
        } catch {
          // ignore
        }
      }
      if (typeof localStorage !== 'undefined') {
        try {
          localStorage.removeItem(AUTH_STORAGE_KEY);
        } catch {
          // ignore
        }
      }
    }
  };

  const openAuthModal = (mode: 'login' | 'signup' = 'login') => {
    setAuthModalMode(mode);
    setIsAuthModalOpen(true);
  };

  const closeAuthModal = () => {
    setIsAuthModalOpen(false);
  };

  const isOwner = currentUser?.role === 'owner';
  const isAuthenticated = currentUser !== null;

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        isAuthenticated,
        isOwner,
        authReady,
        logout,
        signInWithGoogle,
        isAuthModalOpen,
        openAuthModal,
        closeAuthModal,
        authModalMode,
        setAuthModalMode,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
