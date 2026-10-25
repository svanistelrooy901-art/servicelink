import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Eye, EyeOff, Loader2, LockKeyhole } from 'lucide-react';
import { Navigate, useNavigate } from 'react-router-dom';
import { ServiceLinkBrand } from '@/components/ServiceLinkBrand';
import { useAuth } from '@/hooks/useAuth';
import { clearPasswordSetupPending } from '@/lib/passwordSetup';
import { getSupabaseClient } from '@/lib/supabase';

const MINIMUM_PASSWORD_LENGTH = 8;

export function SetPasswordPage() {
  const { user } = useAuth();
  return <PasswordSetupForm key={user?.id ?? 'signed-out'} />;
}

function PasswordSetupForm() {
  const { user, loading } = useAuth();
  const userId = user?.id;
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const mounted = useRef(true);
  const submissionInFlight = useRef(false);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-neutral-50">
        <Loader2 className="h-8 w-8 animate-spin text-primary-700" />
      </main>
    );
  }
  if (!userId) {
    return <Navigate to="/login" replace state={{ returnTo: '/auth/set-password' }} />;
  }
  const authenticatedUserId = userId;

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (submissionInFlight.current) return;
    setError('');

    if (password.length < MINIMUM_PASSWORD_LENGTH) {
      setError(`Use at least ${MINIMUM_PASSWORD_LENGTH} characters.`);
      return;
    }
    if (password !== confirmation) {
      setError('Passwords do not match. Re-enter both passwords and try again.');
      return;
    }

    submissionInFlight.current = true;
    setSubmitting(true);
    try {
      const { data, error: identityError } = await getSupabaseClient().auth.getUser();
      if (!mounted.current) return;
      if (identityError || data.user?.id !== authenticatedUserId) {
        throw new Error('Your account has changed. Sign in again before setting your password.');
      }
      const { error: updateError } = await getSupabaseClient().auth.updateUser({ password });
      if (!mounted.current) return;
      if (updateError) throw updateError;
      clearPasswordSetupPending(authenticatedUserId);
      navigate('/dashboard', { replace: true });
    } catch (updateError) {
      if (mounted.current)
        setError(
          updateError instanceof Error
            ? updateError.message
            : 'Unable to save your password. Please try again.',
        );
    } finally {
      submissionInFlight.current = false;
      if (mounted.current) setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-neutral-50 px-4 py-10">
      <section
        className="w-full max-w-md rounded-2xl border border-neutral-200 bg-white p-6 shadow-elevated sm:p-8"
        aria-labelledby="set-password-title"
      >
        <div className="mb-6">
          <ServiceLinkBrand />
        </div>
        <h1 id="set-password-title" className="font-display text-2xl font-bold text-neutral-900">
          Set your password
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-neutral-500">
          Create a password for signing in as {user?.email}.
        </p>

        <form onSubmit={submit} className="mt-6 space-y-4">
          <label className="block">
            <span className="label-field">New password</span>
            <span className="relative block">
              <input
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                required
                minLength={MINIMUM_PASSWORD_LENGTH}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="input-field pr-12"
                aria-describedby="password-requirements"
              />
              <button
                type="button"
                onClick={() => setShowPassword((visible) => !visible)}
                className="absolute inset-y-0 right-0 min-h-11 min-w-11 text-neutral-500 hover:text-neutral-800"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? (
                  <EyeOff className="mx-auto h-4 w-4" />
                ) : (
                  <Eye className="mx-auto h-4 w-4" />
                )}
              </button>
            </span>
          </label>
          <p id="password-requirements" className="text-xs text-neutral-500">
            Use at least {MINIMUM_PASSWORD_LENGTH} characters.
          </p>
          <label className="block">
            <span className="label-field">Confirm password</span>
            <input
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              required
              minLength={MINIMUM_PASSWORD_LENGTH}
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              className="input-field"
            />
          </label>
          <button type="submit" disabled={submitting} className="btn-primary min-h-11 w-full">
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <LockKeyhole className="h-4 w-4" />
            )}
            {submitting ? 'Saving password…' : 'Continue to Service Link'}
          </button>
        </form>

        {error && (
          <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">
            {error}
          </p>
        )}
      </section>
    </main>
  );
}
