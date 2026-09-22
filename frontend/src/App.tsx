import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useState, useEffect } from 'react';
import { authApi, setAuthToken, getAuthToken } from './services/api';

// Pages
import Landing from './pages/Landing';
import About from './pages/About';
import Features from './pages/Features';
import PricingPage from './pages/PricingPage';
import Blog from './pages/Blog';
import Contact from './pages/Contact';
import Login from './pages/Login';
import Register from './pages/Register';
import VerifyOtp from './pages/VerifyOtp';
import ForgotPassword from './pages/ForgotPassword';
import Dashboard from './pages/Dashboard';
import Calendar from './pages/Calendar';
import Courses from './pages/Courses';
import Chatbot from './pages/Chatbot';
import Settings from './pages/Settings';
import Onboarding from './pages/Onboarding';
import AdminPortal from './pages/AdminPortal';
import Layout from './components/Layout';
import LogoFillLoader from './components/LogoFillLoader';

import './index.css';

export interface User {
  id: string;
  fullName: string;
  email: string;
  role: string;
  isOnboarded?: boolean;
  plan?: string;
  university?: string;
  major?: string;
  semester?: string;
  aiProviderPreference?: string;
  activeByokProvider?: string;
}

// Protected Route Guard: Requires login; forces onboarding if incomplete
function ProtectedRoute({
  user,
  authChecking,
  children,
}: {
  user: User | null;
  authChecking: boolean;
  children: React.ReactNode;
}) {
  if (authChecking) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0F172A', color: '#94A3B8' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: '36px', height: '36px', border: '3px solid rgba(99,102,241,0.2)', borderTopColor: '#6366F1', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 12px' }} />
          <p style={{ fontSize: '0.875rem' }}>Loading student workspace...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (user.isOnboarded === false) {
    return <Navigate to="/onboarding" replace />;
  }

  return <>{children}</>;
}

// Onboarding Route Guard: Requires login; redirects to dashboard if already completed
function OnboardingRoute({
  user,
  authChecking,
  onComplete,
}: {
  user: User | null;
  authChecking: boolean;
  onComplete: (u: any) => void;
}) {
  if (authChecking) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#FAFAF9' }}>
        <div style={{ width: '32px', height: '32px', border: '3px solid #E2E8F0', borderTopColor: '#6366F1', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (user.isOnboarded === true) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Onboarding onComplete={onComplete} />;
}

// Public Auth Route Guard: Redirects logged-in users away from /login & /register
function PublicAuthRoute({
  user,
  authChecking,
  children,
}: {
  user: User | null;
  authChecking: boolean;
  children: React.ReactNode;
}) {
  if (authChecking) {
    return null;
  }

  if (user) {
    if (user.isOnboarded === false) {
      return <Navigate to="/onboarding" replace />;
    }
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}

// Admin Route Guard: Requires authenticated user with role === 'admin'
function AdminRoute({
  user,
  authChecking,
  children,
}: {
  user: User | null;
  authChecking: boolean;
  children: React.ReactNode;
}) {
  if (authChecking) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0F172A', color: '#94A3B8' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: '36px', height: '36px', border: '3px solid rgba(99,102,241,0.2)', borderTopColor: '#6366F1', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 12px' }} />
          <p style={{ fontSize: '0.875rem' }}>Verifying admin authorization...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (user.role !== 'admin') {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authChecking, setAuthChecking] = useState(true);
  const [isAppLoading, setIsAppLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const token = getAuthToken();
    if (!token) {
      setUser(null);
      setAuthChecking(false);
      return;
    }

    try {
      const { data } = await authApi.me();
      if (data.data?.user) {
        setUser(data.data.user);
      } else {
        setUser(null);
        setAuthToken(null);
      }
    } catch {
      setUser(null);
      setAuthToken(null);
    } finally {
      setAuthChecking(false);
    }
  };

  const handleLogout = async () => {
    try {
      await authApi.logout();
    } catch {}
    setAuthToken(null);
    setUser(null);
  };

  return (
    <>
      {isAppLoading && (
        <LogoFillLoader
          onFinish={() => setIsAppLoading(false)}
        />
      )}
      <BrowserRouter>
        <Toaster
          position="top-right"
          toastOptions={{
            className: 'toast-custom',
            duration: 4000,
            style: {
              fontFamily: "'Inter', sans-serif",
              fontSize: '0.875rem',
              borderRadius: '8px',
            },
          }}
        />

        <Routes>
          {/* Public Platform Pages */}
          <Route path="/" element={<Landing />} />
          <Route path="/about" element={<About />} />
          <Route path="/features" element={<Features />} />
          <Route path="/pricing" element={<PricingPage />} />
          <Route path="/blog" element={<Blog />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/courses" element={<Navigate to="/" replace />} />

          {/* Authentication & Account Recovery Routes */}
          <Route
            path="/login"
            element={
              <PublicAuthRoute user={user} authChecking={authChecking}>
                <Login onLogin={(u) => setUser(u)} />
              </PublicAuthRoute>
            }
          />
          <Route
            path="/register"
            element={
              <PublicAuthRoute user={user} authChecking={authChecking}>
                <Register />
              </PublicAuthRoute>
            }
          />
          <Route
            path="/verify-otp"
            element={<VerifyOtp onLogin={(u) => setUser(u)} />}
          />
          <Route path="/forgot-password" element={<ForgotPassword />} />

          {/* Onboarding Wizard (Dedicated Gate for New Students) */}
          <Route
            path="/onboarding"
            element={
              <OnboardingRoute
                user={user}
                authChecking={authChecking}
                onComplete={(u) => setUser((prev) => (prev ? { ...prev, ...u, isOnboarded: true } : u))}
              />
            }
          />

          {/* Protected Workspace Layout (Per-Student Isolated) */}
          <Route
            element={
              <ProtectedRoute user={user} authChecking={authChecking}>
                <Layout user={user!} onLogout={handleLogout} />
              </ProtectedRoute>
            }
          >
            <Route path="/dashboard" element={<Dashboard user={user!} />} />
            <Route path="/calendar" element={<Calendar />} />
            <Route path="/my-courses" element={<Courses />} />
            <Route path="/chatbot" element={<Chatbot />} />
            <Route
              path="/settings"
              element={
                <Settings
                  user={user!}
                  onUpdateUser={(updated) => setUser((prev) => (prev ? { ...prev, ...updated } : null))}
                  onLogout={handleLogout}
                />
              }
            />
            <Route
              path="/admin"
              element={
                <AdminRoute user={user} authChecking={authChecking}>
                  <AdminPortal user={user!} />
                </AdminRoute>
              }
            />
          </Route>

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </>
  );
}

export default App;
