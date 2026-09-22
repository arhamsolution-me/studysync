import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  Loader2,
  Sparkles,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { authApi, setAuthToken } from '../services/api';

interface LoginProps {
  onLogin?: (user: any) => void;
}

export default function Login({ onLogin }: LoginProps) {
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      toast.error('Please enter both email and password');
      return;
    }

    setLoading(true);
    try {
      const { data } = await authApi.login({
        email: email.trim().toLowerCase(),
        password,
      });

      // Handle unverified user
      if (data.requiresVerification || data.data?.requiresVerification) {
        const targetEmail = data.email || data.data?.email || email.trim();
        toast('Please verify your email to continue. A fresh OTP was sent!', {
          icon: '✉️',
        });
        navigate(`/verify-otp?email=${encodeURIComponent(targetEmail)}`);
        return;
      }

      const token = data.data?.accessToken || data.data?.token;
      if (token) {
        setAuthToken(token);
      }

      const loggedUser = data.data?.user;
      if (onLogin && loggedUser) {
        onLogin(loggedUser);
      }

      toast.success(`Welcome back, ${loggedUser?.fullName || 'Student'}!`);

      if (loggedUser && loggedUser.isOnboarded === false) {
        navigate('/onboarding');
      } else {
        navigate('/dashboard');
      }
    } catch (err: any) {
      if (err.response?.data?.requiresVerification) {
        const targetEmail = err.response?.data?.email || email.trim();
        toast('Account unverified. A new verification OTP was sent to your email.', {
          icon: '✉️',
        });
        navigate(`/verify-otp?email=${encodeURIComponent(targetEmail)}`);
        return;
      }

      const msg = err.response?.data?.message || err.message || 'Invalid email or password';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = async () => {
    setEmail('devnexes.support@gmail.com');
    setPassword('Password123');
    setLoading(true);
    try {
      const { data } = await authApi.login({
        email: 'devnexes.support@gmail.com',
        password: 'Password123',
      });

      const token = data.data?.accessToken || data.data?.token;
      if (token) {
        setAuthToken(token);
      }

      const loggedUser = data.data?.user;
      if (onLogin && loggedUser) {
        onLogin(loggedUser);
      }

      toast.success('Logged in as Verified Demo Student!');
      if (loggedUser && loggedUser.isOnboarded === false) {
        navigate('/onboarding');
      } else {
        navigate('/dashboard');
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Demo login failed';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="ss-auth-page">
      <div className="ss-glow-mesh-1" />

      <div className="ss-auth-wrapper">
        <div className="ss-auth-card-wrap">
          {/* Brand Header */}
          <div className="ss-auth-brand-header">
            <Link to="/" style={{ textDecoration: 'none', display: 'inline-block' }}>
              <img
                src="/studysync-logo-transparent.png"
                alt="StudySync AI"
                className="ss-auth-brand-logo-img"
              />
            </Link>
            <h1 className="ss-auth-card-title">Sign In to StudySync</h1>
            <p className="ss-auth-card-subtitle">Access your courses, schedule, and RAG copilot</p>
          </div>

          {/* Card */}
          <div className="ss-auth-card">
            <form className="ss-auth-form" onSubmit={handleSubmit}>
              {/* Email */}
              <div className="ss-form-group">
                <label className="ss-form-label">University Email Address</label>
                <div className="ss-form-input-wrap">
                  <div className="ss-input-icon">
                    <Mail size={16} />
                  </div>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="student@university.edu"
                    className="ss-auth-input"
                    autoComplete="email"
                  />
                </div>
              </div>

              {/* Password */}
              <div className="ss-form-group">
                <div className="ss-form-label">
                  <span>Password</span>
                  <Link to="/forgot-password" style={{ color: '#818CF8', textDecoration: 'none', fontSize: '0.75rem' }}>
                    Forgot password?
                  </Link>
                </div>
                <div className="ss-form-input-wrap">
                  <div className="ss-input-icon">
                    <Lock size={16} />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="ss-auth-input"
                    style={{ paddingRight: '42px' }}
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="ss-eye-toggle-btn"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* Remember Me */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8125rem', color: '#94A3B8' }}>
                <input
                  type="checkbox"
                  id="rememberMe"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  style={{ accentColor: '#6366F1', cursor: 'pointer' }}
                />
                <label htmlFor="rememberMe" style={{ cursor: 'pointer' }}>Remember this device</label>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                className="ss-auth-btn-submit"
              >
                {loading ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Signing in...</span>
                  </>
                ) : (
                  <>
                    <span>Sign In</span>
                    <ArrowRight size={16} />
                  </>
                )}
              </button>
            </form>

            {/* Demo Student 1-Click */}
            <button
              type="button"
              onClick={handleDemoLogin}
              disabled={loading}
              className="ss-auth-demo-btn"
            >
              <Sparkles size={14} color="#818CF8" />
              <span>Explore as Demo Verified Student</span>
            </button>

            {/* Footer Link */}
            <div className="ss-auth-footer-link">
              <span>Don't have an account? </span>
              <Link to="/register">Create student account</Link>
            </div>
          </div>

          <div style={{ textAlign: 'center', marginTop: '20px' }}>
            <Link to="/" style={{ color: '#64748B', textDecoration: 'none', fontSize: '0.8125rem' }}>
              ← Back to Home
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
