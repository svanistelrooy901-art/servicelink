import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { AppStoreProvider } from '../hooks/useAppStore';
import { usingLocal, DEMO_ACCESS_KEY } from '../lib/config';
import { isPasswordSetupPending } from '../lib/passwordSetup';
export function ProtectedDashboard() {
  const { user, loading, error } = useAuth();
  const location = useLocation();
  if (loading) return <p className="loading">Checking your session…</p>;
  if (!(usingLocal ? sessionStorage.getItem(DEMO_ACCESS_KEY) === 'active' : user))
    return <Navigate to="/login" replace state={{ returnTo: location.pathname }} />;
  if (!usingLocal && error)
    return <p role="alert">Authentication is unavailable. Please sign in again.</p>;
  if (user && isPasswordSetupPending(user.id)) return <Navigate to="/auth/set-password" replace />;
  return (
    <AppStoreProvider key={user?.id ?? 'local-demo'}>
      <Outlet />
    </AppStoreProvider>
  );
}
