import { useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { isPasswordSetupPending, markPasswordSetupPending } from '@/lib/passwordSetup';
import { getSupabaseClient } from '@/lib/supabase';
import {
  createCallbackCompletion,
  getInvitationAccount,
  parseAuthCallback,
} from '@/lib/authCallback';
import { useAuth } from '@/hooks/useAuth';
import { ServiceLinkBrand } from '@/components/ServiceLinkBrand';

export function AuthCallbackPage() {
  const { user, loading } = useAuth();
  const busy = useRef(false);
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const [input] = useState(() => parseAuthCallback(window.location.search, window.location.hash));
  const [error, setError] = useState('');
  const [invitation, setInvitation] = useState<{ id: string; email?: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();
  const auth = useMemo(() => {
    try {
      return getSupabaseClient().auth;
    } catch {
      return null;
    }
  }, []);
  const complete = useMemo(
    () => (auth ? createCallbackCompletion(input, auth) : null),
    [auth, input],
  );

  useEffect(() => {
    let mounted = true;
    // Capture once, then scrub credentials on success AND every failure path.
    window.history.replaceState(window.history.state, '', window.location.pathname);
    if (input.kind === 'error') {
      setError('This sign-in link is invalid or has expired. Please request a new link.');
      return () => {
        mounted = false;
      };
    }
    if (!auth || !complete) {
      setError('Authentication is unavailable. Please try again later.');
      return () => {
        mounted = false;
      };
    }
    if (input.kind === 'signup-token') {
      // A GET/prefetch must never consume a signup email token.
      return () => {
        mounted = false;
      };
    } else if (input.kind === 'invite-session') {
      getInvitationAccount(input, auth)
        .then((account) => {
          if (mounted) setInvitation(account);
        })
        .catch(() => {
          if (mounted) setError('This invitation is invalid or has expired.');
        });
    } else {
      complete()
        .then(({ data, error: failure }) => {
          if (!mounted) return;
          if (failure || !data.user) {
            setError('This sign-in link is invalid or has expired. Please request a new link.');
            return;
          }
          const invite = input.kind === 'invite-token';
          if (invite) markPasswordSetupPending(data.user.id);
          navigate(
            invite || isPasswordSetupPending(data.user.id) ? '/auth/set-password' : '/dashboard',
            { replace: true },
          );
        })
        .catch(() => {
          if (mounted) setError('Sign-in failed. Please request a new link.');
        });
    }
    return () => {
      mounted = false;
    };
  }, [auth, complete, input, navigate]);

  async function confirmSignup() {
    if (!auth || !complete || busy.current || user || loading) return;
    busy.current = true;
    setSubmitting(true);
    setError('');
    try {
      const current = await auth.getSession();
      if (current.error || current.data.session || !mounted.current)
        throw new Error('Session changed.');
      const { data, error: failure } = await complete();
      if (failure || !data.user) throw new Error('Verification failed.');
      const active = await auth.getSession();
      if (!mounted.current || active.error || active.data.session?.user.id !== data.user.id) return;
      navigate(isPasswordSetupPending(data.user.id) ? '/auth/set-password' : '/dashboard', {
        replace: true,
      });
    } catch {
      if (mounted.current)
        setError(
          'Unable to confirm this link. It may have expired or already been used. Try signing in, or request a new signup email.',
        );
    } finally {
      busy.current = false;
      if (mounted.current) setSubmitting(false);
    }
  }

  async function acceptInvitation() {
    if (!invitation || !complete || submitting) return;
    setSubmitting(true);
    try {
      const { data, error: failure } = await complete(invitation.id);
      if (failure || !data.user || data.user.id !== invitation.id)
        throw new Error('Unable to accept this invitation. Please request a new link.');
      markPasswordSetupPending(data.user.id);
      navigate('/auth/set-password', { replace: true });
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Unable to accept this invitation.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-primary-50 via-white to-secondary-50 px-4 py-10">
      <section className="w-full max-w-md rounded-2xl border border-white/80 bg-white/95 p-6 shadow-elevated sm:p-8">
        <div className="mb-7">
          <ServiceLinkBrand />
        </div>
        {error ? (
          <>
            <h1 className="font-display text-xl font-bold text-neutral-900">Unable to sign in</h1>
            <p role="alert" className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">
              {error}
            </p>
          </>
        ) : input.kind === 'signup-token' ? (
          <>
            <h1 className="font-display text-2xl font-bold text-neutral-900">Confirm your email</h1>
            <p className="mt-3 text-sm leading-relaxed text-neutral-600">
              {user
                ? 'You are already signed in. Sign out before confirming an email for another account.'
                : 'Confirm your email address and sign in to Service Link.'}
            </p>
            <button
              type="button"
              disabled={submitting || loading || Boolean(user)}
              onClick={confirmSignup}
              className="btn-primary mt-5 min-h-11 w-full disabled:opacity-70"
            >
              {submitting ? 'Confirming…' : 'Confirm email and sign in'}
            </button>
          </>
        ) : invitation ? (
          <>
            <h1 className="font-display text-xl font-bold text-neutral-900">
              Accept your invitation
            </h1>
            <p className="mt-3 text-sm text-neutral-600">
              Continue to Service Link as <strong>{invitation.email}</strong>.
            </p>
            <button
              type="button"
              disabled={submitting}
              onClick={acceptInvitation}
              className="btn-primary mt-5 min-h-11 w-full"
            >
              {submitting ? 'Accepting…' : 'Continue with this account'}
            </button>
            <button
              type="button"
              onClick={() => navigate('/login', { replace: true })}
              disabled={submitting}
              className="btn-secondary mt-3 min-h-11 w-full"
            >
              Cancel
            </button>
          </>
        ) : (
          <div className="text-center">
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary-700" />
            <p className="mt-3 inline-flex items-center gap-2 text-sm text-neutral-600">
              <CheckCircle2 className="h-4 w-4" />
              Completing secure sign-in…
            </p>
          </div>
        )}
        <p className="mt-6 text-center text-sm">
          <Link to="/login" className="font-semibold text-primary-700 underline">
            Back to sign in
          </Link>{' '}
          ·{' '}
          <Link to="/signup" className="font-semibold text-primary-700 underline">
            Signup
          </Link>
        </p>
      </section>
    </main>
  );
}
