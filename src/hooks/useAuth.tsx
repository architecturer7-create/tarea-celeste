import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import type { Perfil } from '@/lib/types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

// XHR bypasses the Lovable preview fetch proxy that causes "Failed to fetch"
// on POST /auth/v1/token in the preview iframe.
function xhrJson(url: string, body: unknown): Promise<{ status: number; data: any }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url, true);
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.setRequestHeader('apikey', SUPABASE_KEY);
    xhr.setRequestHeader('Authorization', `Bearer ${SUPABASE_KEY}`);
    xhr.onload = () => {
      try {
        resolve({ status: xhr.status, data: JSON.parse(xhr.responseText || '{}') });
      } catch {
        resolve({ status: xhr.status, data: null });
      }
    };
    xhr.onerror = () => reject(new Error('Network error'));
    xhr.send(JSON.stringify(body));
  });
}

const isFetchFailure = (err: unknown) => {
  const msg = (err as { message?: string } | null)?.message?.toLowerCase() ?? '';
  return msg.includes('failed to fetch') || msg.includes('load failed') || msg.includes('networkerror');
};

async function signInFallback(email: string, password: string) {
  const { status, data } = await xhrJson(
    `${SUPABASE_URL}/auth/v1/token?grant_type=password`,
    { email, password }
  );
  if (status >= 200 && status < 300 && data?.access_token) {
    const { error } = await supabase.auth.setSession({
      access_token: data.access_token,
      refresh_token: data.refresh_token,
    });
    return { error: (error as Error | null) ?? null };
  }
  return { error: new Error(data?.error_description || data?.msg || 'No se pudo iniciar sesión') };
}

async function signUpFallback(email: string, password: string, nombre: string) {
  const { status, data } = await xhrJson(`${SUPABASE_URL}/auth/v1/signup`, {
    email,
    password,
    data: { nombre },
  });
  if (status >= 200 && status < 300) {
    if (data?.access_token && data?.refresh_token) {
      await supabase.auth.setSession({
        access_token: data.access_token,
        refresh_token: data.refresh_token,
      });
    }
    return { error: null };
  }
  return { error: new Error(data?.error_description || data?.msg || 'No se pudo crear la cuenta') };
}

interface AuthContextType {
  session: Session | null;
  user: User | null;
  perfil: Perfil | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, nombre: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const loadProfile = async (userId: string) => {
      try {
        const { data } = await supabase
          .from('perfiles')
          .select('*')
          .eq('user_id', userId)
          .maybeSingle();

        if (isMounted) {
          setPerfil((data as Perfil | null) ?? null);
        }
      } catch {
        if (isMounted) {
          setPerfil(null);
        }
      }
    };

    const syncAuthState = (currentSession: Session | null) => {
      if (!isMounted) return;

      setSession(currentSession);
      setUser(currentSession?.user ?? null);
      setLoading(false);

      if (currentSession?.user) {
        void loadProfile(currentSession.user.id);
      } else {
        setPerfil(null);
      }
    };

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, currentSession) => {
      syncAuthState(currentSession);
    });

    void supabase.auth.getSession()
      .then(({ data: { session: currentSession } }) => {
        syncAuthState(currentSession);
      })
      .catch(() => {
        if (isMounted) {
          setSession(null);
          setUser(null);
          setPerfil(null);
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error && isFetchFailure(error)) {
        return await signInFallback(email, password);
      }
      return { error: error as Error | null };
    } catch (err) {
      if (isFetchFailure(err)) {
        return await signInFallback(email, password);
      }
      return { error: err as Error };
    }
  };

  const signUp = async (email: string, password: string, nombre: string) => {
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { nombre } },
      });
      if (error && isFetchFailure(error)) {
        return await signUpFallback(email, password, nombre);
      }
      return { error: error as Error | null };
    } catch (err) {
      if (isFetchFailure(err)) {
        return await signUpFallback(email, password, nombre);
      }
      return { error: err as Error };
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ session, user, perfil, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}
