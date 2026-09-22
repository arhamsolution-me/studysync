import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Mail,
  Lock,
  User,
  Eye,
  EyeOff,
  ArrowRight,
  Sparkles,
  ShieldCheck,
  Loader2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { authApi } from '../services/api';

export default function Register() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialPlan = searchParams.get('plan') || 'free';

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) {
      toast.error('Please enter your full name');
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      toast.error('Please enter a valid university email address');
      return;
    }
    if (password.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }

    setLoading(true);
    try {
      await authApi.register({
        fullName: fullName.trim(),
        email: email.trim().toLowerCase(),
        password,
      });

      toast.success('Account created! Verification code sent to your email.');
      navigate(`/verify-otp?email=${encodeURIComponent(email.trim().toLowerCase())}&name=${encodeURIComponent(fullName.trim())}&plan=${initialPlan}`);
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Registration failed. Please try again.';
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
            <h1 className="ss-auth-card-title">Create Student Account</h1>
            <p className="ss-auth-card-subtitle">Instant multi-tenant workspace with cloud Supabase persistence</p>

            {initialPlan !== 'free' && (
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 12px', borderRadius: '9999px', background: 'rgba(99, 102, 241, 0.15)', border: '1px solid rgba(99, 102, 241, 0.3)', color: '#A5B4FC', fontSize: '0.75rem', marginTop: '12px' }}>
                <Sparkles size={13} color="#818CF8" />
                <span>Selected Plan: <strong style={{ color: '#FFFFFF', textTransform: 'uppercase' }}>{initialPlan}</strong></span>
              </div>
            )}
          </div>

          {/* Card */}
          <div className="ss-auth-card">
            <form className="ss-auth-form" onSubmit={handleSubmit}>
              {/* Full Name */}
              <div className="ss-form-group">
                <label className="ss-form-label">Full Name</label>
                <div className="ss-form-input-wrap">
                  <div className="ss-input-icon">
                    <User size={16} />
                  </div>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. Ali Ahmed"
                    className="ss-auth-input"
                  />
                </div>
              </div>

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
                  />
                </div>
                <div style={{ fontSize: '0.6875rem', color: '#94A3B8', marginTop: '4px' }}>
                  We'll email you a 6-digit verification code to confirm your identity.
                </div>
              </div>

              {/* Password */}
              <div className="ss-form-group">
                <label className="ss-form-label">Password</label>
                <div className="ss-form-input-wrap">
                  <div className="ss-input-icon">
                    <Lock size={16} />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 8 characters"
                    className="ss-auth-input"
                    style={{ paddingRight: '42px' }}
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

              {/* Security Notice */}
              <div style={{ padding: '10px 14px', borderRadius: '10px', background: 'rgba(11, 15, 25, 0.6)', border: '1px solid rgba(51, 65, 85, 0.6)', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.75rem', color: '#94A3B8' }}>
                <ShieldCheck size={18} color="#34D399" style={{ flexShrink: 0 }} />
                <span>Your account is isolated in a dedicated tenant with Argon2id password hashing.</span>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="ss-auth-btn-submit"
              >
                {loading ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Sending 6-Digit OTP...</span>
                  </>
                ) : (
                  <>
                    <span>Continue to Verification</span>
                    <ArrowRight size={16} />
                  </>
                )}
              </button>
            </form>

            <div className="ss-auth-footer-link">
              <span>Already have an account? </span>
              <Link to="/login">Sign In</Link>
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
