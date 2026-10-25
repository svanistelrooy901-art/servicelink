import { BrowserRouter, Link, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './hooks/useAuth';
import { ProtectedDashboard } from './components/ProtectedDashboard';
import { DashboardLayout } from './components/DashboardLayout';
import { DashboardOverview } from './pages/DashboardOverview';
import { EditorPage } from './pages/EditorPage';
import { PreviewPage } from './pages/PreviewPage';
import { PublicProfilePage } from './pages/PublicProfilePage';
import { MarketplacePage } from './pages/MarketplacePage';
import { LoginPage } from './pages/LoginPage';
import { SignupPage } from './pages/SignupPage';
import { AuthCallbackPage } from './pages/AuthCallbackPage';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage';
import { RecoveryPage } from './pages/RecoveryPage';
import { ResetPasswordPage } from './pages/ResetPasswordPage';
import { SetPasswordPage } from './pages/SetPasswordPage';
import { DemoAccess } from './pages/DemoAccess';
import { AvailabilityPage } from './pages/AvailabilityPage';
import { BookingsPage } from './pages/BookingsPage';
import { BookingRequestPage } from './pages/BookingRequestPage';
import { CustomerBookingPage } from './pages/CustomerBookingPage';
import { usingLocal } from './lib/config';
export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<Navigate to="/marketplace" replace />} />
          <Route path="/marketplace" element={<MarketplacePage />} />
          <Route path="/p/:slug/book" element={<BookingRequestPage />} />
          <Route path="/booking/:id" element={<CustomerBookingPage />} />
          <Route path="/p/:slug" element={<PublicProfilePage />} />
          <Route path="/login" element={usingLocal ? <DemoAccess /> : <LoginPage />} />
          <Route path="/signup" element={usingLocal ? <DemoAccess /> : <SignupPage />} />
          {[
            ['/auth/callback', <AuthCallbackPage />],
            ['/forgot-password', <ForgotPasswordPage />],
            ['/auth/recovery', <RecoveryPage />],
            ['/auth/reset-password', <ResetPasswordPage />],
            ['/auth/set-password', <SetPasswordPage />],
          ].map(([path, element]) => (
            <Route
              key={String(path)}
              path={String(path)}
              element={usingLocal ? <DemoAccess /> : element}
            />
          ))}
          <Route element={<ProtectedDashboard />}>
            <Route path="/dashboard" element={<DashboardLayout />}>
              <Route index element={<DashboardOverview />} />
              <Route path="profile" element={<EditorPage section="profile" />} />
              <Route path="services" element={<EditorPage section="services" />} />
              <Route path="coverage" element={<EditorPage section="coverage" />} />
              <Route path="availability" element={<AvailabilityPage />} />
              <Route path="bookings" element={<BookingsPage />} />
              <Route path="preview" element={<PreviewPage />} />
            </Route>
          </Route>
          <Route
            path="*"
            element={
              <main className="empty-state">
                <h1>Page not found</h1>
                <Link to="/marketplace">Explore Service Link</Link>
              </main>
            }
          />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
