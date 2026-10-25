import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Loader2, LockKeyhole } from 'lucide-react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { ServiceLinkBrand } from '@/components/ServiceLinkBrand';
import { useAuth } from '@/hooks/useAuth';
import { safeReturnTo } from '@/lib/safeReturnTo';

export function LoginPage() {
  const { user, loading, error: sessionError, signInWithPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [signInError, setSignInError] = useState('');
  const submissionInFlight = useRef(false);
  const location = useLocation();
  const navigate = useNavigate();
  const returnTo = safeReturnTo((location.state as { returnTo?: unknown } | null)?.returnTo);

  useEffect(() => {
    if (user) navigate(returnTo, { replace: true });
  }, [navigate, returnTo, user]);

  if (loading) {
    return (
      <main
        className="flex min-h-screen items-center justify-center bg-neutral-50"
        aria-label="Checking your session"
      >
        <Loader2 className="h-8 w-8 animate-spin text-primary-700" aria-hidden="true" />
      </main>
    );
  }
  if (user) return <Navigate to={returnTo} replace />;

  async function submitPassword(event: FormEvent) {
    event.preventDefault();
    if (submissionInFlight.current) return;
    submissionInFlight.current = true;
    setSubmitting(true);
    setSignInError('');
    try {
      await signInWithPassword(email.trim(), password);
    } catch (signInFailure) {
      const code =
        signInFailure && typeof signInFailure === 'object' && 'code' in signInFailure
          ? String(signInFailure.code)
          : '';
      const message = signInFailure instanceof Error ? signInFailure.message : '';
      setSignInError(
        code === 'invalid_credentials' || /invalid login credentials/i.test(message)
          ? 'Email or password is incorrect. Please try again.'
          : 'Unable to sign in right now. Please try again.',
      );
    } finally {
      submissionInFlight.current = false;
      setSubmitting(false);
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-primary-50 via-white to-secondary-50 px-4 py-10">
      <div
        className="pointer-events-none absolute -left-24 top-[-7rem] h-72 w-72 rounded-full bg-primary-200/30 blur-3xl"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -bottom-32 right-[-5rem] h-80 w-80 rounded-full bg-secondary-200/30 blur-3xl"
        aria-hidden="true"
      />
      <section
        className="relative w-full max-w-md rounded-2xl border border-white/80 bg-white/95 p-6 shadow-elevated backdrop-blur sm:p-8"
        aria-labelledby="login-title"
      >
        <div className="mb-7">
          <ServiceLinkBrand />
        </div>
        <h1
          id="login-title"
          className="font-display text-3xl font-bold tracking-tight text-neutral-900"
        >
          Welcome back
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-neutral-500">
          Sign in to your Service Link account.
        </p>
        <form onSubmit={submitPassword} className="mt-6 space-y-4">
          <label className="block">
            <span className="label-field">Email</span>
            <input
              type="email"
              inputMode="email"
              autoComplete="email"
              spellCheck={false}
              required
              disabled={submitting}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="input-field disabled:cursor-wait disabled:opacity-70"
              aria-invalid={Boolean(signInError)}
            />
          </label>
          <label className="block">
            <span className="label-field">Password</span>
            <input
              type="password"
              autoComplete="current-password"
              required
              disabled={submitting}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="input-field disabled:cursor-wait disabled:opacity-70"
              aria-invalid={Boolean(signInError)}
            />
          </label>
          <div className="text-right">
            <Link
              to="/forgot-password"
              className="text-sm font-medium text-primary-700 hover:underline"
            >
              Forgot password?
            </Link>
          </div>
          <button
            type="submit"
            disabled={submitting}
            aria-busy={submitting}
            className="btn-primary min-h-11 w-full disabled:cursor-wait disabled:opacity-70"
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <LockKeyhole className="h-4 w-4" aria-hidden="true" />
            )}
            {submitting ? 'Signing in…' : 'Sign In'}
          </button>
        </form>
        <p className="mt-4 text-center text-sm text-neutral-600">
          New to Service Link?{' '}
          <Link to="/signup" className="font-semibold text-primary-700 underline">
            Create an account
          </Link>
        </p>
        {(signInError || sessionError) && (
          <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">
            {signInError || 'Sign-in is temporarily unavailable. Please try again.'}
          </p>
        )}
      </section>
    </main>
  );
}
