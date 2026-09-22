import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Mail,
  Lock,
  KeyRound,
  Eye,
  EyeOff,
  ArrowRight,
  ArrowLeft,
  Loader2,
  CheckCircle2,
  RefreshCw,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { authApi } from '../services/api';

export default function ForgotPassword() {
  const navigate = useNavigate();

  const [step, setStep] = useState<1 | 2>(1);
  const [email, setEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);

  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !email.includes('@')) {
      toast.error('Please enter a valid university email address');
      return;
    }

    setLoading(true);
    try {
      await authApi.forgotPassword({ email: email.trim().toLowerCase() });
      toast.success('Reset code sent to your email!');
      setStep(2);
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Failed to send reset code';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otpCode.trim().length !== 6) {
      toast.error('Please enter the 6-digit code sent to your email');
      return;
    }
    if (newPassword.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      await authApi.resetPassword({
        email: email.trim().toLowerCase(),
        otpCode: otpCode.trim(),
        newPassword,
      });

      toast.success('Password updated successfully! Please sign in.');
      navigate('/login');
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Invalid reset code or request expired';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (resending || !email) return;
    setResending(true);
    try {
      await authApi.forgotPassword({ email: email.trim().toLowerCase() });
      toast.success('New reset code dispatched to your email.');
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Failed to resend code';
      toast.error(msg);
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="ss-auth-page">
      <div className="ss-glow-mesh-1" />

      <div className="ss-auth-wrapper">
        <div className="ss-auth-card-wrap">
          {/* Header */}
          <div className="ss-auth-brand-header">
            <Link to="/" style={{ textDecoration: 'none', display: 'inline-block' }}>
              <img
                src="/studysync-logo-transparent.png"
                alt="StudySync AI"
                className="ss-auth-brand-logo-img"
              />
            </Link>
            <h1 className="ss-auth-card-title">
              {step === 1 ? 'Reset your Password' : 'Set New Password'}
            </h1>
            <p className="ss-auth-card-subtitle">
              {step === 1
                ? 'Enter your university email to receive a recovery code'
                : `Enter the 6-digit code sent to ${email}`}
            </p>
          </div>

          {/* Card */}
          <div className="ss-auth-card">
            {step === 1 ? (
              <form className="ss-auth-form" onSubmit={handleRequestOtp}>
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
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="ss-auth-btn-submit"
                >
                  {loading ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      <span>Sending Recovery Code...</span>
                    </>
                  ) : (
                    <>
                      <span>Send Recovery Code</span>
                      <ArrowRight size={16} />
                    </>
                  )}
                </button>
              </form>
            ) : (
              <form className="ss-auth-form" onSubmit={handleResetPassword}>
                <div className="ss-form-group">
                  <label className="ss-form-label">6-Digit Reset Code</label>
                  <div className="ss-form-input-wrap">
                    <div className="ss-input-icon">
                      <KeyRound size={16} />
                    </div>
                    <input
                      type="text"
                      required
                      maxLength={6}
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                      placeholder="123456"
                      className="ss-auth-input"
                      style={{ letterSpacing: '0.2em', fontFamily: 'monospace', fontSize: '1.125rem' }}
                    />
                  </div>
                </div>

                <div className="ss-form-group">
                  <label className="ss-form-label">New Password</label>
                  <div className="ss-form-input-wrap">
                    <div className="ss-input-icon">
                      <Lock size={16} />
                    </div>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
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

                <div className="ss-form-group">
                  <label className="ss-form-label">Confirm New Password</label>
                  <div className="ss-form-input-wrap">
                    <div className="ss-input-icon">
                      <Lock size={16} />
                    </div>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Re-enter password"
                      className="ss-auth-input"
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8125rem' }}>
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    style={{ background: 'transparent', border: 'none', color: '#94A3B8', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                  >
                    <ArrowLeft size={14} />
                    <span>Change email</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleResend}
                    disabled={resending}
                    style={{ background: 'transparent', border: 'none', color: '#818CF8', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                  >
                    {resending ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                    <span>Resend code</span>
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="ss-auth-btn-submit"
                >
                  {loading ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      <span>Updating Password...</span>
                    </>
                  ) : (
                    <>
                      <span>Save New Password</span>
                      <CheckCircle2 size={16} />
                    </>
                  )}
                </button>
              </form>
            )}

            <div className="ss-auth-footer-link">
              <span>Remembered your password? </span>
              <Link to="/login">Sign in</Link>
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
