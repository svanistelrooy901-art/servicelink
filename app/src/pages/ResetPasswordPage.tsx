import { useState, type FormEvent } from 'react';
import { Eye, EyeOff, Loader2, LockKeyhole } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { ServiceLinkBrand } from '@/components/ServiceLinkBrand';
import { useAuth } from '@/hooks/useAuth';
import { getSupabaseClient } from '@/lib/supabase';
import { isRecoveryGrantValid, recoveryGrantKey } from '@/lib/recoveryGrant';

export function ResetPasswordPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const authorized = isRecoveryGrantValid(sessionStorage.getItem(recoveryGrantKey), user?.id);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!authorized || saving) return;
    if (password.length < 8) {
      setError('Use at least 8 characters.');
      return;
    }
    if (password !== confirmation) {
      setError('Passwords do not match.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const { error: updateError } = await getSupabaseClient().auth.updateUser({ password });
      if (updateError) throw updateError;
      sessionStorage.removeItem(recoveryGrantKey);
      navigate('/dashboard', { replace: true });
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Unable to reset your password.');
    } finally {
      setSaving(false);
    }
  }

  if (loading)
    return (
      <main className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </main>
    );
  return (
    <main className="flex min-h-screen items-center justify-center bg-neutral-50 px-4 py-10">
      <section className="w-full max-w-md rounded-2xl border border-neutral-200 bg-white p-6 shadow-elevated sm:p-8">
        <div className="mb-6">
          <ServiceLinkBrand />
        </div>
        <h1 className="font-display text-2xl font-bold text-neutral-900">Choose a new password</h1>
        {!authorized ? (
          <>
            <p role="alert" className="mt-4 text-sm text-red-700">
              Your recovery session is missing or expired. Please request a new link.
            </p>
            <Link to="/forgot-password" className="mt-4 inline-block text-primary-700 underline">
              Request reset link
            </Link>
          </>
        ) : (
          <form onSubmit={submit} className="mt-6 space-y-4">
            <label className="block">
              <span className="label-field">New password</span>
              <span className="relative block">
                <input
                  className="input-field pr-12"
                  type={show ? 'text' : 'password'}
                  autoComplete="new-password"
                  minLength={8}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShow((v) => !v)}
                  className="absolute inset-y-0 right-0 min-h-11 min-w-11"
                  aria-label={show ? 'Hide password' : 'Show password'}
                >
                  {show ? (
                    <EyeOff className="mx-auto h-4 w-4" />
                  ) : (
                    <Eye className="mx-auto h-4 w-4" />
                  )}
                </button>
              </span>
            </label>
            <p className="text-xs text-neutral-500">Use at least 8 characters.</p>
            <label className="block">
              <span className="label-field">Confirm password</span>
              <input
                className="input-field"
                type={show ? 'text' : 'password'}
                autoComplete="new-password"
                minLength={8}
                required
                value={confirmation}
                onChange={(e) => setConfirmation(e.target.value)}
              />
            </label>
            <button type="submit" disabled={saving} className="btn-primary min-h-11 w-full">
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <LockKeyhole className="h-4 w-4" />
              )}{' '}
              Save new password
            </button>
            {error && (
              <p role="alert" className="text-sm text-red-700">
                {error}
              </p>
            )}
          </form>
        )}
      </section>
    </main>
  );
}
