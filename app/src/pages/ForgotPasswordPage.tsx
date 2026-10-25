import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, Mail } from 'lucide-react';
import { ServiceLinkBrand } from '@/components/ServiceLinkBrand';
import { getSupabaseClient } from '@/lib/supabase';

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (sending) return;
    setSending(true);
    setError('');
    try {
      const redirectTo = new URL(
        'auth/recovery',
        `${window.location.origin}${import.meta.env.BASE_URL}`,
      ).toString();
      const { error: requestError } = await getSupabaseClient().auth.resetPasswordForEmail(
        email.trim(),
        { redirectTo },
      );
      if (requestError) throw requestError;
      setSent(true);
    } catch {
      setError('Unable to send a recovery email right now. Please try again later.');
    } finally {
      setSending(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-neutral-50 px-4 py-10">
      <section className="w-full max-w-md rounded-2xl border border-neutral-200 bg-white p-6 shadow-elevated sm:p-8">
        <div className="mb-6">
          <ServiceLinkBrand />
        </div>
        <h1 className="font-display text-2xl font-bold text-neutral-900">Reset your password</h1>
        {sent ? (
          <p role="status" className="mt-4 text-sm text-neutral-700">
            If an account exists for that email, we have sent a password reset link. Check your
            inbox and spam folder.
          </p>
        ) : (
          <>
            <p className="mt-2 text-sm text-neutral-500">
              Enter your account email and we will send a reset link.
            </p>
            <form onSubmit={submit} className="mt-6 space-y-4">
              <label className="block">
                <span className="label-field">Email</span>
                <input
                  type="email"
                  autoComplete="email"
                  required
                  className="input-field"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={sending}
                />
              </label>
              <button className="btn-primary min-h-11 w-full" type="submit" disabled={sending}>
                {sending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Mail className="h-4 w-4" />
                )}{' '}
                Send reset link
              </button>
            </form>
          </>
        )}
        {error && (
          <p role="alert" className="mt-4 text-sm text-red-700">
            {error}
          </p>
        )}
        <Link
          to="/login"
          className="mt-6 inline-block text-sm font-medium text-primary-700 hover:underline"
        >
          Back to sign in
        </Link>
      </section>
    </main>
  );
}
