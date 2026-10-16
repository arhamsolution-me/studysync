import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useState, useEffect } from 'react';
import { authApi, setAuthToken } from './services/api';

// Main Workspace Pages
import Dashboard from './pages/Dashboard';
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

const DEFAULT_STUDENT_USER: User = {
  id: 'personal-user',
  fullName: 'Personal Student',
  email: 'student@studysync.local',
  role: 'student',
  isOnboarded: true,
  plan: 'pro',
  university: 'University of Management and Technology',
  major: 'Software Engineering',
  semester: '6th Semester',
  aiProviderPreference: 'system',
};

function App() {
  const [user, setUser] = useState<User>(DEFAULT_STUDENT_USER);
  const [, setAuthChecking] = useState(true);
  const [isAppLoading, setIsAppLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const { data } = await authApi.me();
      if (data.data?.user) {
        setUser(data.data.user);
      }
    } catch {
      // Keep DEFAULT_STUDENT_USER fallback seamlessly
    } finally {
      setAuthChecking(false);
    }
  };

  const handleLogout = async () => {
    try {
      await authApi.logout();
    } catch {}
    setAuthToken(null);
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
          {/* Main Area: Dashboard, Courses, Chatbot, Settings */}
          <Route element={<Layout user={user} onLogout={handleLogout} />}>
            <Route path="/" element={<Dashboard user={user} />} />
            <Route path="/dashboard" element={<Dashboard user={user} />} />
            <Route path="/courses" element={<Courses />} />
            <Route path="/my-courses" element={<Courses />} />
            <Route path="/chatbot" element={<Chatbot />} />
            <Route
              path="/settings"
              element={
                <Settings
                  user={user}
                  onUpdateUser={(updated) => setUser((prev) => ({ ...prev, ...updated }))}
                  onLogout={handleLogout}
                />
              }
            />
          </Route>

          {/* Any unknown route directly routes to dashboard */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </>
  );
}

export default App;
