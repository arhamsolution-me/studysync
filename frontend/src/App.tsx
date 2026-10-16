import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useState, useEffect } from 'react';
import { authApi, setAuthToken, getAuthToken } from './services/api';

// Pages
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Calendar from './pages/Calendar';
import Courses from './pages/Courses';
import Chatbot from './pages/Chatbot';
import Settings from './pages/Settings';
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
        localStorage.setItem('auth_user', JSON.stringify(data.data.user));
      } else {
        const cached = localStorage.getItem('auth_user');
        if (cached) {
          try {
            setUser(JSON.parse(cached));
          } catch {
            setUser(null);
            setAuthToken(null);
          }
        } else {
          setUser(null);
          setAuthToken(null);
        }
      }
    } catch {
      const cached = localStorage.getItem('auth_user');
      if (cached) {
        try {
          setUser(JSON.parse(cached));
        } catch {
          setUser(null);
          setAuthToken(null);
        }
      } else {
        setUser(null);
        setAuthToken(null);
      }
    } finally {
      setAuthChecking(false);
    }
  };

  const handleLogout = async () => {
    try {
      await authApi.logout();
    } catch {}
    setAuthToken(null);
    localStorage.removeItem('auth_user');
    setUser(null);
  };

  if (authChecking) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#0F172A',
        color: '#94A3B8',
      }}>
        <div style={{
          width: '36px',
          height: '36px',
          border: '3px solid rgba(99,102,241,0.2)',
          borderTopColor: '#6366F1',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
        }} />
      </div>
    );
  }

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
          {/* Public Login Route */}
          <Route
            path="/login"
            element={
              user ? (
                <Navigate to="/dashboard" replace />
              ) : (
                <Login onLogin={(u) => setUser(u)} />
              )
            }
          />

          {/* Authenticated Workspace Routes */}
          {user ? (
            <Route element={<Layout user={user} onLogout={handleLogout} />}>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<Dashboard user={user} />} />
              <Route path="/calendar" element={<Calendar />} />
              <Route path="/courses" element={<Courses />} />
              <Route path="/my-courses" element={<Courses />} />
              <Route path="/chatbot" element={<Chatbot />} />
              <Route
                path="/settings"
                element={
                  <Settings
                    user={user}
                    onUpdateUser={(updated) => setUser((prev) => (prev ? { ...prev, ...updated } : null))}
                    onLogout={handleLogout}
                  />
                }
              />
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Route>
          ) : (
            /* Unauthenticated fallback redirects to /login */
            <Route path="*" element={<Navigate to="/login" replace />} />
          )}
        </Routes>
      </BrowserRouter>
    </>
  );
}

export default App;
