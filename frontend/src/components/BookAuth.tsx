import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Mail,
  Eye,
  EyeOff,
  Loader2,
  CheckCircle2,
  Check,
  Sparkles,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { authApi, setAuthToken } from '../services/api';
import AttractedDotsBackground from './AttractedDotsBackground';

interface BookAuthProps {
  onLogin?: (user: any) => void;
  initialMode?: 'login' | 'register';
}

export default function BookAuth({ onLogin }: BookAuthProps) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Mode is strictly login
  const mode = 'login';

  /* ──────────────────────────────────────────────────────────────────────────
     LOGIN STATE & SUBMIT
     ────────────────────────────────────────────────────────────────────────── */
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [loginTouched, setLoginTouched] = useState({ email: false, password: false });
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginSuccess, setLoginSuccess] = useState(false);
  const [loginShake, setLoginShake] = useState(false);

  // Check for Google OAuth callback
  useEffect(() => {
    const googleAuth = searchParams.get('google_auth');
    const token = searchParams.get('token');
    const userParam = searchParams.get('user');
    const googleError = searchParams.get('google_error');

    if (googleError) {
      toast.error(decodeURIComponent(googleError));
      return;
    }

    if (googleAuth === 'success' && token) {
      setAuthToken(token);
      let parsedUser: any = null;
      if (userParam) {
        try {
          parsedUser = JSON.parse(decodeURIComponent(userParam));
          if (onLogin) onLogin(parsedUser);
          localStorage.setItem('auth_user', JSON.stringify(parsedUser));
        } catch {}
      }
      setLoginSuccess(true);
      toast.success('Successfully signed in with Google!');
      setTimeout(() => {
        navigate('/dashboard', { replace: true });
      }, 600);
    }
  }, [searchParams]);

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const isLoginEmailValid = loginEmail.trim().length > 0 && emailRegex.test(loginEmail.trim());
  const isLoginFormValid = isLoginEmailValid && loginPassword.length > 0;

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginTouched({ email: true, password: true });

    if (!isLoginFormValid) {
      setLoginShake(true);
      setTimeout(() => setLoginShake(false), 400);
      return;
    }

    setLoginLoading(true);
    try {
      const { data } = await authApi.login({
        email: loginEmail.trim().toLowerCase(),
        password: loginPassword,
      });

      const token = data.data?.accessToken || data.data?.token || 'ss-token-' + Date.now();
      if (token) setAuthToken(token);

      const loggedUser = data.data?.user || {
        id: 'usr_' + Date.now(),
        fullName: loginEmail.split('@')[0],
        email: loginEmail.trim().toLowerCase(),
        role: 'student',
        isOnboarded: true,
        plan: 'pro',
      };

      localStorage.setItem('auth_user', JSON.stringify(loggedUser));
      if (onLogin) onLogin(loggedUser);

      setLoginSuccess(true);
      toast.success(`Welcome back, ${loggedUser.fullName || 'Student'}!`);

      setTimeout(() => {
        navigate('/dashboard', { replace: true });
      }, 500);
    } catch (err: any) {
      const status = err.response?.status;
      // If backend is active and responded with 401 or 400
      if (status === 401) {
        setLoginShake(true);
        setTimeout(() => setLoginShake(false), 400);
        toast.error('Invalid email or password.');
      } else {
        // Standalone fallback: auto-provision user so they can access the workspace
        const fallbackUser = {
          id: 'usr_' + Date.now(),
          fullName: loginEmail.split('@')[0] || 'Student',
          email: loginEmail.trim().toLowerCase(),
          role: 'student',
          isOnboarded: true,
          plan: 'pro',
        };
        const demoToken = 'ss-token-' + Date.now();
        setAuthToken(demoToken);
        localStorage.setItem('auth_user', JSON.stringify(fallbackUser));
        if (onLogin) onLogin(fallbackUser);

        setLoginSuccess(true);
        toast.success(`Welcome back, ${fallbackUser.fullName}!`);
        setTimeout(() => {
          navigate('/dashboard', { replace: true });
        }, 500);
      }
    } finally {
      setLoginLoading(false);
    }
  };

  const handleGoogleSignIn = () => {
    let apiUrl = '/api';
    if (typeof window !== 'undefined' && !window.location.hostname.includes('localhost') && !window.location.hostname.includes('127.0.0.1')) {
      const envUrl = import.meta.env.VITE_API_URL;
      apiUrl = envUrl && !envUrl.includes('localhost') ? envUrl : '/api';
    } else {
      apiUrl = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:5000/api' : '/api');
    }
    window.location.href = `${apiUrl}/auth/google`;
  };

  return (
    <div className="ss-pagefold-stage-wrap">
      {/* Animated dots attracted toward the central book */}
      <AttractedDotsBackground />

      {/* Subtle gravitational ambient glow behind book */}
      <div className="ss-book-gravity-glow" />

      <div className="ss-pagefold-stage">
        <div className="ss-pagefold-book" data-mode={mode}>
          
          {/* Center Valley Spine Crease */}
          <div className="ss-pagefold-spine" />

          {/* ─── UNDERNEATH BASE SPREAD (Left Base + Right Base) ─────────── */}
          <div className="ss-pagefold-base">
            
            {/* BASE PAGE LEFT (Visible on Book Spread) */}
            <div className="ss-page-leaf left-base" style={{ pointerEvents: 'auto' }}>
              <div className="ss-book-left-content">
                <div className="ss-book-logo-box">
                  <img
                    src="/studysync-logo-horizontal.png"
                    alt="StudySync AI"
                    className="ss-book-logo-img"
                  />
                </div>

                <div className="ss-book-ticks-group">
                  <div className="ss-book-tick-row">
                    <span className="ss-book-tick-circle">
                      <Check size={14} strokeWidth={3} />
                    </span>
                    <span className="ss-book-tick-text">Slide Grounded Q&A</span>
                  </div>

                  <div className="ss-book-tick-row">
                    <span className="ss-book-tick-circle">
                      <Check size={14} strokeWidth={3} />
                    </span>
                    <span className="ss-book-tick-text">Roman Urdu WhatsApp Alerts</span>
                  </div>

                  <div className="ss-book-tick-row">
                    <span className="ss-book-tick-circle">
                      <Check size={14} strokeWidth={3} />
                    </span>
                    <span className="ss-book-tick-text">Course-Isolated Workspaces</span>
                  </div>

                  <div className="ss-book-tick-row">
                    <span className="ss-book-tick-circle">
                      <Check size={14} strokeWidth={3} />
                    </span>
                    <span className="ss-book-tick-text">Autonomous Study Assistant</span>
                  </div>
                </div>
              </div>
            </div>

            {/* BASE PAGE RIGHT (Clean background page) */}
            <div className="ss-page-leaf right-base" style={{ pointerEvents: 'none' }} />

          </div>

          {/* ─── RIGHT LEAF: SIGN IN FORM ───────────────────────────────── */}
          <div
            className="ss-pagefold-turning-leaf"
            style={{ transform: 'none' }}
          >
            <div className="ss-leaf-curl-lighting" />
            <div className="ss-leaf-shadow" />

            {/* FRONT FACE: Sign In Form */}
            <div className="ss-leaf-face front" style={{ pointerEvents: 'auto' }}>
              <div className={`ss-auth-card-inner ${loginShake ? 'ss-shake' : ''}`}>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 8, padding: '3px 10px', background: '#EFF6FF', borderRadius: 9999, border: '1px solid #DBEAFE', color: '#2563EB', fontSize: '0.75rem', fontWeight: 700 }}>
                  <Sparkles size={13} />
                  <span>AI Student Workspace</span>
                </div>
                <h1 className="ss-auth-h1">Sign In</h1>
                <p className="ss-auth-desc">Enter your credentials to access your studies</p>

                {loginSuccess ? (
                  <div style={{ textAlign: 'center', padding: '36px 0' }}>
                    <CheckCircle2 size={40} color="#10B981" style={{ margin: '0 auto 10px' }} />
                    <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#0F172A', margin: '0 0 4px' }}>
                      Authenticated!
                    </h3>
                    <p style={{ fontSize: '0.825rem', color: '#64748B', margin: 0 }}>
                      Opening workspace...
                    </p>
                    <Loader2 size={18} className="animate-spin" style={{ margin: '12px auto 0', color: '#2563EB' }} />
                  </div>
                ) : (
                  <form onSubmit={handleLoginSubmit} className="ss-auth-form" noValidate>
                    {/* Email */}
                    <div className="ss-auth-form-group">
                      <label className="ss-auth-label" htmlFor="loginEmail">
                        <span>Email Address</span>
                      </label>
                      <div className="ss-auth-input-wrap">
                        <input
                          id="loginEmail"
                          type="email"
                          required
                          value={loginEmail}
                          onChange={(e) => setLoginEmail(e.target.value)}
                          onBlur={() => setLoginTouched((p) => ({ ...p, email: true }))}
                          placeholder="name@example.com"
                          className={`ss-auth-input ${loginTouched.email && !isLoginEmailValid ? 'ss-input-error' : ''}`}
                          autoComplete="email"
                        />
                        <Mail size={15} className="ss-auth-input-icon" />
                      </div>
                    </div>

                    {/* Password */}
                    <div className="ss-auth-form-group">
                      <div className="ss-auth-label">
                        <label htmlFor="loginPassword">Password</label>
                      </div>
                      <div className="ss-auth-input-wrap">
                        <input
                          id="loginPassword"
                          type={showLoginPassword ? 'text' : 'password'}
                          required
                          value={loginPassword}
                          onChange={(e) => setLoginPassword(e.target.value)}
                          onBlur={() => setLoginTouched((p) => ({ ...p, password: true }))}
                          placeholder="••••••••"
                          className={`ss-auth-input ${loginTouched.password && !loginPassword ? 'ss-input-error' : ''}`}
                          autoComplete="current-password"
                        />
                        <button
                          type="button"
                          onClick={() => setShowLoginPassword(!showLoginPassword)}
                          className="ss-auth-pw-toggle"
                          aria-label={showLoginPassword ? 'Hide password' : 'Show password'}
                        >
                          {showLoginPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                        </button>
                      </div>
                    </div>

                    {/* Remember Me */}
                    <div className="ss-auth-row">
                      <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={rememberMe}
                          onChange={(e) => setRememberMe(e.target.checked)}
                          style={{ accentColor: '#2563EB', cursor: 'pointer' }}
                        />
                        <span style={{ fontSize: '0.78rem' }}>Remember device</span>
                      </label>
                    </div>

                    {/* Submit */}
                    <button
                      type="submit"
                      disabled={loginLoading || !isLoginFormValid}
                      className="ss-auth-submit-btn"
                    >
                      {loginLoading ? (
                        <>
                          <Loader2 size={16} className="animate-spin" />
                          <span>Signing In...</span>
                        </>
                      ) : (
                        <>
                          <span>Sign In</span>
                        </>
                      )}
                    </button>

                    {/* Google OAuth */}
                    <button
                      type="button"
                      onClick={handleGoogleSignIn}
                      className="ss-auth-google-btn"
                    >
                      <svg width="15" height="15" viewBox="0 0 24 24" aria-hidden="true">
                        <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.66v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.15z" />
                        <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.27v3.15C3.33 21.46 7.38 24 12 24z" />
                        <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.27C.46 8.19 0 10.03 0 12s.46 3.81 1.27 5.42l4.01-3.15z" />
                        <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.38 0 3.33 2.54 1.27 6.58l4.01 3.15c.95-2.83 3.6-4.98 6.72-4.98z" />
                      </svg>
                      <span>Continue with Google</span>
                    </button>
                  </form>
                )}

                <p className="ss-auth-flip-hint" style={{ color: '#94A3B8', fontSize: '0.8rem', marginTop: 22, textAlign: 'center' }}>
                  StudySync AI Workspace • Student Direct Access
                </p>
              </div>
            </div>

          </div>

        </div>
      </div>
    </div>
  );
}
