import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { getSupabaseClient } from '@/lib/supabase';

import { usingLocal } from '@/lib/config';

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  loading: boolean;
  error: string | null;
  signInWithPassword: (email: string, password: string) => Promise<void>;
  sendMagicLink: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (usingLocal) {
      setLoading(false);
      return;
    }
    let mounted = true;
    let authRevision = 0;
    try {
      const client = getSupabaseClient();
      client.auth
        .getSession()
        .then(({ data, error: sessionError }) => {
          // A later auth event is authoritative over this initial session read.
          if (!mounted || authRevision !== 0) return;
          if (sessionError) setError(sessionError.message);
          setSession(data.session);
        })
        .catch((sessionError: unknown) => {
          if (mounted && authRevision === 0)
            setError(
              sessionError instanceof Error
                ? sessionError.message
                : 'Authentication is unavailable.',
            );
        })
        .finally(() => mounted && setLoading(false));
      const { data: listener } = client.auth.onAuthStateChange((_event, nextSession) => {
        if (mounted) {
          authRevision += 1;
          setSession(nextSession);
          setError(null);
          setLoading(false);
        }
      });
      return () => {
        mounted = false;
        listener.subscription.unsubscribe();
      };
    } catch (configurationError) {
      setError(
        configurationError instanceof Error
          ? configurationError.message
          : 'Authentication is unavailable.',
      );
      setLoading(false);
      return () => {
        mounted = false;
      };
    }
  }, []);

  const signInWithPassword = useCallback(async (email: string, password: string) => {
    setError(null);
    const { error: signInError } = await getSupabaseClient().auth.signInWithPassword({
      email,
      password,
    });
    if (signInError) {
      throw signInError;
    }
  }, []);

  const sendMagicLink = useCallback(async (email: string) => {
    setError(null);
    const redirectTo = new URL(
      'auth/callback',
      `${window.location.origin}${import.meta.env.BASE_URL}`,
    ).toString();
    const { error: otpError } = await getSupabaseClient().auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirectTo, shouldCreateUser: false },
    });
    if (otpError) {
      setError(otpError.message);
      throw otpError;
    }
  }, []);

  const signOut = useCallback(async () => {
    setError(null);
    const { error: signOutError } = await getSupabaseClient().auth.signOut();
    if (signOutError) {
      throw signOutError;
    }
    setSession(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      loading,
      error,
      signInWithPassword,
      sendMagicLink,
      signOut,
    }),
    [error, loading, sendMagicLink, session, signInWithPassword, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
