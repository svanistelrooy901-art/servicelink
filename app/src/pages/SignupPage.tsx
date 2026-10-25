import { useState, type FormEvent } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { ServiceLinkBrand } from '../components/ServiceLinkBrand';
import { getSupabaseClient } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
export function SignupPage() {
  const { user } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const { error: failure } = await getSupabaseClient().auth.signUp({
        email: email.trim(),
        password,
        options: { emailRedirectTo: new URL('/auth/callback', window.location.origin).href },
      });
      if (failure) throw failure;
      setSent(true);
    } catch {
      setError('Unable to create your account. Please try again.');
    } finally {
      setBusy(false);
    }
  }
  if (user) return <Navigate to="/dashboard" replace />;
  return (
    <main className="access-page">
      <section className="access-card">
        <ServiceLinkBrand />
        <h1>Make your services easy to find.</h1>
        <p>One plan. All MVP features. 14-day free trial.</p>
        <div className="price-note">
          RM9.90 monthly · RM49 first annual year
          <br />
          <strong>RM99/year on annual renewal from year two.</strong>
          <small>Gateway use is optional. Transaction charges are separate.</small>
        </div>
        {sent ? (
          <p role="status">
            Check your email to confirm your account. If it already exists, sign in or reset your
            password.
          </p>
        ) : (
          <form onSubmit={submit}>
            <label>
              Email
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
            <label>
              Password
              <input
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
            <button className="btn-primary" disabled={busy}>
              {busy ? 'Creating account…' : 'Create account'}
            </button>
          </form>
        )}
        {error && <p role="alert">{error}</p>}
        <Link to="/login">Already have an account? Sign in</Link>
        <p className="tiny">
          Membership checkout and trial activation are not enabled in this foundation.
        </p>
      </section>
    </main>
  );
}
