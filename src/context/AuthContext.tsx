import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '../types';
import { supabase, signInWithGoogle } from '../supabaseClient.js';

interface AuthContextType {
  currentUser: User | null;
  isAuthenticated: boolean;
  isOwner: boolean;
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

  // Format creation timestamp
  const createdDate = supabaseUser?.created_at
    ? new Date(supabaseUser.created_at)
    : new Date();
  const joinedDate = createdDate.toLocaleDateString('en-US', {
    month: 'short',
    year: 'numeric',
  });

  // Verify admin status from secure sources only (app_metadata or database verification)
  const ownerEmail = (import.meta.env.VITE_OWNER_EMAIL || 'teamstudify5@gmail.com').toLowerCase().trim();
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
  };
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<'login' | 'signup'>('login');

  // 1. Purge legacy test account key on mount & synchronize with Supabase Auth
  useEffect(() => {
    try {
      localStorage.removeItem(AUTH_STORAGE_KEY);
    } catch {
      // ignore
    }

    // Check existing Supabase session on application start
    let isMounted = true;

    const syncUserWithDbRole = async (user: any) => {
      let isDbAdmin = false;
      try {
        const { data: roleRow } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .maybeSingle();
        if (roleRow && (roleRow.role === 'owner' || roleRow.role === 'admin')) {
          isDbAdmin = true;
        }
      } catch {
        // ignore
      }
      if (isMounted) {
        setCurrentUser(mapSupabaseUser(user, isDbAdmin));
      }
    };

    supabase.auth
      .getSession()
      .then(({ data: { session }, error }) => {
        if (error) {
          console.error('Error fetching Supabase session:', error.message);
          return;
        }
        if (isMounted && session?.user) {
          syncUserWithDbRole(session.user);
        }
      })
      .catch((err) => {
        console.error('Unexpected error checking session:', err);
      });

    // 2. Subscribe to Supabase auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!isMounted) return;
      if (session?.user) {
        syncUserWithDbRole(session.user);
      } else {
        setCurrentUser(null);
      }
    });

    return () => {
      isMounted = false;
      subscription?.unsubscribe();
    };
  }, []);

  // Sign out cleanly through Supabase
  const logout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.error('Error during Supabase signOut:', err);
    } finally {
      setCurrentUser(null);
      try {
        localStorage.removeItem(AUTH_STORAGE_KEY);
      } catch {
        // ignore
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
