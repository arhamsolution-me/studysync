import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowRight,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { authApi, setAuthToken } from '../services/api';

interface VerifyOtpProps {
  onLogin?: (user: any) => void;
}

export default function VerifyOtp({ onLogin }: VerifyOtpProps) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const email = searchParams.get('email') || '';
  const plan = searchParams.get('plan') || 'free';

  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [countdown, setCountdown] = useState(60);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (inputRefs.current[0]) {
      inputRefs.current[0].focus();
    }
  }, []);

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const handleDigitChange = (index: number, value: string) => {
    const val = value.replace(/\D/g, '');
    if (!val) {
      const newOtp = [...otp];
      newOtp[index] = '';
      setOtp(newOtp);
      return;
    }

    const digit = val.slice(-1);
    const newOtp = [...otp];
    newOtp[index] = digit;
    setOtp(newOtp);

    if (index < 5 && digit) {
      inputRefs.current[index + 1]?.focus();
    }

    if (newOtp.every((d) => d.length === 1)) {
      submitOtp(newOtp.join(''));
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pastedData) return;

    const newOtp = [...otp];
    for (let i = 0; i < pastedData.length; i++) {
      newOtp[i] = pastedData[i];
    }
    setOtp(newOtp);

    const nextIndex = Math.min(pastedData.length, 5);
    inputRefs.current[nextIndex]?.focus();

    if (pastedData.length === 6) {
      submitOtp(pastedData);
    }
  };

  const submitOtp = async (codeToSubmit?: string) => {
    const fullCode = codeToSubmit || otp.join('');
    if (fullCode.length !== 6) {
      toast.error('Please enter the full 6-digit verification code');
      return;
    }

    if (!email) {
      toast.error('Email address missing. Please register again.');
      navigate('/register');
      return;
    }

    setLoading(true);
    try {
      const { data } = await authApi.verifyOtp({
        email,
        otpCode: fullCode,
      });

      const token = data.data?.accessToken || data.data?.token;
      if (token) {
        setAuthToken(token);
      }

      if (onLogin && data.data?.user) {
        onLogin(data.data.user);
      }

      toast.success('Email verified successfully! Welcome to StudySync.');
      navigate(`/onboarding?plan=${plan}`);
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Verification failed. Please check your code.';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (countdown > 0 || resending) return;
    if (!email) {
      toast.error('Email address missing. Please register again.');
      return;
    }

    setResending(true);
    try {
      await authApi.resendOtp({ email });
      toast.success('New verification code sent to your email.');
      setCountdown(60);
      setOtp(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Failed to resend code.';
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
            <h1 className="ss-auth-card-title">Verify your Email</h1>
            <p className="ss-auth-card-subtitle">We sent a 6-digit verification code to</p>
            <div style={{ fontFamily: 'monospace', fontWeight: 600, color: '#A5B4FC', marginTop: '6px', fontSize: '0.9375rem' }}>
              {email || 'your email'}
            </div>
          </div>

          {/* Card */}
          <div className="ss-auth-card">
            <div className="ss-otp-grid">
              {otp.map((digit, idx) => (
                <input
                  key={idx}
                  ref={(el) => { inputRefs.current[idx] = el; }}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleDigitChange(idx, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(idx, e)}
                  onPaste={handlePaste}
                  disabled={loading}
                  className="ss-otp-box"
                />
              ))}
            </div>

            <button
              type="button"
              onClick={() => submitOtp()}
              disabled={loading || otp.join('').length !== 6}
              className="ss-auth-btn-submit"
            >
              {loading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>Verifying Code...</span>
                </>
              ) : (
                <>
                  <span>Confirm & Continue to Setup</span>
                  <ArrowRight size={16} />
                </>
              )}
            </button>

            {/* Countdown / Resend */}
            <div style={{ textAlign: 'center', marginTop: '20px', fontSize: '0.8125rem', color: '#94A3B8' }}>
              {countdown > 0 ? (
                <span>Resend code in <strong style={{ color: '#F1F5F9' }}>{countdown}s</strong></span>
              ) : (
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={resending}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'transparent', border: 'none', color: '#818CF8', fontWeight: 600, cursor: 'pointer', fontSize: '0.8125rem' }}
                >
                  {resending ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                  <span>Resend Verification Code</span>
                </button>
              )}
            </div>

            <div className="ss-auth-footer-link">
              <span>Wrong email address? </span>
              <Link to="/register">Change email</Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
