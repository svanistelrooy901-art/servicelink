import { t } from '../i18n';
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { getSupabaseClient } from '@/lib/supabase';
import { createRecoveryGrant, recoveryCallbackCode, recoveryGrantKey } from '@/lib/recoveryGrant';

let inFlightCode = '';
let inFlight: Promise<string> | null = null;

function exchangeRecoveryCode(code: string): Promise<string> {
  if (inFlightCode === code && inFlight) return inFlight;
  inFlightCode = code;
  inFlight = getSupabaseClient()
    .auth.exchangeCodeForSession(code)
    .then(({ data, error }) => {
      if (error || !data.user) throw error ?? new Error(t('Invalid recovery session'));
      return data.user.id;
    });
  return inFlight;
}

export function RecoveryPage() {
  const navigate = useNavigate();
  const [error, setError] = useState('');
  useEffect(() => {
    let mounted = true;
    const code = recoveryCallbackCode(window.location.search, window.location.hash);
    if (!code) {
      setError(t('This password reset link is invalid or has expired. Request a new one.'));
      return () => {
        mounted = false;
      };
    }
    exchangeRecoveryCode(code)
      .then((userId) => {
        if (!mounted) return;
        sessionStorage.setItem(recoveryGrantKey, createRecoveryGrant(userId));
        window.history.replaceState(window.history.state, '', window.location.pathname);
        navigate('/auth/reset-password', { replace: true });
      })
      .catch(() => {
        if (mounted)
          setError(t('This password reset link is invalid or has expired. Request a new one.'));
      });
    return () => {
      mounted = false;
    };
  }, [navigate]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-neutral-50 px-4">
      {error ? (
        <div className="text-center">
          <p role="alert" className="text-sm text-red-700">
            {t(error)}
          </p>
          <Link className="mt-4 inline-block text-primary-700 underline" to="/forgot-password">
            {t('Request another link')}
          </Link>
        </div>
      ) : (
        <div className="flex items-center gap-3 text-sm text-neutral-600">
          <Loader2 className="h-5 w-5 animate-spin" /> {t('Verifying recovery link…')}
        </div>
      )}
    </main>
  );
}
