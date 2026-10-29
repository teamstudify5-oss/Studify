import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient.js';

interface ProtectedRouteProps {
  children: React.ReactNode;
  onRedirectToLogin?: () => void;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  onRedirectToLogin,
}) => {
  const [checking, setChecking] = useState(true);
  const [hasSession, setHasSession] = useState(false);

  useEffect(() => {
    let isMounted = true;

    // Protect private pages with supabase.auth.getSession() — if no session, redirect to /login
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (!isMounted) return;

      if (error || !session) {
        setHasSession(false);
        setChecking(false);
        if (window.location.pathname !== '/login') {
          window.history.pushState(null, '', '/login');
        }
        if (onRedirectToLogin) {
          onRedirectToLogin();
        } else {
          window.location.href = '/login';
        }
      } else {
        setHasSession(true);
        setChecking(false);
      }
    }).catch(() => {
      if (!isMounted) return;
      setHasSession(false);
      setChecking(false);
      if (onRedirectToLogin) {
        onRedirectToLogin();
      } else {
        window.location.href = '/login';
      }
    });

    return () => {
      isMounted = false;
    };
  }, [onRedirectToLogin]);

  if (checking) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!hasSession) {
    return null;
  }

  return <>{children}</>;
};
