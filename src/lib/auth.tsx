import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { withTimeout } from './utils';
import type { Profile } from './database.types';

interface AuthState {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  signUp: (displayName: string, email: string, password: string) => Promise<SignUpResult>;
  signIn: (email: string, password: string) => Promise<SignInResult>;
  resendConfirmation: (email: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

export interface SignUpResult {
  error: string | null;
  /** True when the account was created but Supabase requires email confirmation before a session is issued. */
  confirmationRequired?: boolean;
}

export interface SignInResult {
  error: string | null;
  /** True when login was rejected specifically because the email is not confirmed yet. */
  emailNotConfirmed?: boolean;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = async (userId: string) => {
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
    if (!data) {
      // Self-heal: the auth user exists but the profile row is missing
      // (e.g. first login happened before migrations ran, or the user was
      // created in the dashboard). Without this row, creating spaces fails
      // with a spaces_owner_id_fkey violation, so create it now.
      const { data: sess } = await supabase.auth.getSession();
      const u = sess.session?.user;
      if (u && u.id === userId) {
        const metaName = ((u.user_metadata as { display_name?: string } | undefined)?.display_name ?? '').trim();
        const name = metaName || (u.email ?? '').split('@')[0] || 'Member';
        await supabase.from('profiles').upsert({
          id: userId,
          display_name: name.slice(0, 80),
          email: (u.email ?? '').trim().toLowerCase(),
        });
        const { data: retry } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
        setProfile((retry as Profile | null) ?? null);
        return;
      }
    }
    setProfile((data as Profile | null) ?? null);
  };

  const refreshProfile = async () => {
    if (session?.user) await loadProfile(session.user.id);
  };

  useEffect(() => {
    let cancelled = false;
    // Never leave the app stuck on "Loading…": if session restore hangs
    // (unreachable backend, bad URL), give up after 10s and show the app.
    withTimeout(supabase.auth.getSession(), 10_000, 'Session restore')
      .then(({ data }) => {
        if (cancelled) return;
        setSession(data.session);
        if (data.session?.user) void loadProfile(data.session.user.id).catch(() => undefined);
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) {
          console.warn('[nalds] Session restore timed out — check VITE_SUPABASE_URL and network.');
          setLoading(false);
        }
      });
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, s) => {
      setSession(s);
      if (s?.user) void loadProfile(s.user.id);
      else setProfile(null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const signUp: AuthState['signUp'] = async (displayName, email, password) => {
    const cleanEmail = email.trim();
    const cleanName = displayName.trim();
    try {
      const { data, error } = await withTimeout(
        supabase.auth.signUp({
          email: cleanEmail,
          password,
          options: { data: { display_name: cleanName } },
        }),
        20_000,
        'Registration',
      );
      if (error) return { error: error.message };
      if (!data.user) return { error: 'Registration did not return a user. Please try again.' };
      // Email confirmation is ON: no session is issued until the user clicks the
      // link in their inbox. Return a flag so the UI can show a friendly
      // "check your email" state instead of an error.
      if (!data.session) {
        return { error: null, confirmationRequired: true };
      }
      // Create profile row (RLS allows own insert). Email stored for invitation matching.
      // NOTE: Promise.resolve bridges the PostgREST builder (thenable, not a
      // real Promise) so it works with the timeout helper.
      const { error: pErr } = await withTimeout(
        Promise.resolve(
          supabase
            .from('profiles')
            .upsert({ id: data.user.id, display_name: cleanName, email: cleanEmail.toLowerCase() }),
        ),
        20_000,
        'Profile setup',
      );
      if (pErr) return { error: friendlyProfileError(pErr.message) };
      await loadProfile(data.user.id);
      return { error: null };
    } catch (e) {
      return { error: (e as Error).message };
    }
  };

  const signIn: AuthState['signIn'] = async (email, password) => {
    try {
      const { data, error } = await withTimeout(
        supabase.auth.signInWithPassword({ email: email.trim(), password }),
        20_000,
        'Login',
      );
      if (error) {
        if (/email not confirmed/i.test(error.message)) {
          return {
            error: 'Your email address has not been verified yet. Please check your inbox for the verification email, then try again.',
            emailNotConfirmed: true,
          };
        }
        return { error: error.message };
      }
      // loadProfile self-heals a missing profile row (accounts created while
      // email confirmation was ON, or first login before migrations ran).
      if (data.user) {
        await loadProfile(data.user.id);
      }
      return { error: null };
    } catch (e) {
      return { error: (e as Error).message };
    }
  };

  const resendConfirmation: AuthState['resendConfirmation'] = async (email) => {
    try {
      const { error } = await withTimeout(
        supabase.auth.resend({ type: 'signup', email: email.trim() }),
        20_000,
        'Resend verification email',
      );
      if (error) return { error: error.message };
      return { error: null };
    } catch (e) {
      return { error: (e as Error).message };
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setProfile(null);
    setSession(null);
  };

  return (
    <AuthContext.Provider
      value={{ user: session?.user ?? null, session, profile, loading, signUp, signIn, resendConfirmation, signOut, refreshProfile }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

/** Translate common PostgREST failures into actionable messages. */
function friendlyProfileError(raw: string): string {
  if (/schema cache/i.test(raw)) {
    return (
      'Database table "public.profiles" was not found (PostgREST schema cache). ' +
      'The migrations have not been applied to this Supabase project. ' +
      'Run supabase/migrations/0001_init.sql in the Supabase SQL editor, then reload with: NOTIFY pgrst, \'reload schema\';'
    );
  }
  return raw;
}
