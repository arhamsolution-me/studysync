import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { Shield, Key, Lock, Eye, EyeOff, AlertTriangle, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { adminApi, setAdminToken } from '../services/api';
import '../styles/admin.css';

export default function AdminLogin() {
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [securityPassphrase, setSecurityPassphrase] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim() || !password) {
      toast.error('Please enter administrator username and password.');
      return;
    }

    setLoading(true);
    try {
      const res = await adminApi.login({
        identifier: identifier.trim(),
        password,
        securityPassphrase: securityPassphrase.trim() || undefined,
      });

      if (res.data.success && res.data.data?.adminToken) {
        setAdminToken(res.data.data.adminToken);
        toast.success(`Welcome Administrator ${res.data.data.admin.username}`);
        navigate('/admin');
      } else {
        toast.error(res.data.message || 'Administrator verification failed.');
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Invalid administrator credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="admin-login-wrapper">
      <div className="admin-shell-glow" />
      <div className="admin-shell-glow-2" />

      <div className="admin-login-card animate-fadeIn">
        <div className="admin-login-badge">
          <Shield size={13} />
          High-Security Gateway
        </div>

        <h1 className="admin-login-title">Operations Vault</h1>
        <p className="admin-login-subtitle">
          Dedicated administrative authentication. Student credentials and standard sessions cannot access this portal.
        </p>

        <form onSubmit={handleSubmit}>
          {/* Admin Identifier */}
          <div className="admin-form-group">
            <label className="admin-form-label" htmlFor="admin-id">Admin Username / Email</label>
            <div className="admin-form-input-wrap">
              <Key className="admin-form-icon" size={17} />
              <input
                id="admin-id"
                type="text"
                autoComplete="username"
                className="admin-form-input"
                placeholder="admin or admin@studysync.ai"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                required
              />
            </div>
          </div>

          {/* Master Password */}
          <div className="admin-form-group">
            <label className="admin-form-label" htmlFor="admin-pass">Master Password</label>
            <div className="admin-form-input-wrap">
              <Lock className="admin-form-icon" size={17} />
              <input
                id="admin-pass"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                className="admin-form-input"
                placeholder="••••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                style={{ paddingRight: '40px' }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: '12px',
                  background: 'none',
                  border: 'none',
                  color: '#64748B',
                  cursor: 'pointer',
                  padding: 0,
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* Master Security Passphrase (Optional or 2FA) */}
          <div className="admin-form-group">
            <label className="admin-form-label" htmlFor="admin-vault">
              Master Security Passphrase
            </label>
            <div className="admin-form-input-wrap">
              <Shield className="admin-form-icon" size={17} />
              <input
                id="admin-vault"
                type="password"
                className="admin-form-input"
                placeholder="STUDYSYNC-MASTER-VAULT-2026"
                value={securityPassphrase}
                onChange={(e) => setSecurityPassphrase(e.target.value)}
              />
            </div>
          </div>

          <button
            type="submit"
            className="admin-btn-submit-vault"
            disabled={loading}
          >
            {loading ? (
              <>Verifying Vault Authorization...</>
            ) : (
              <>
                <CheckCircle2 size={18} />
                Authorize & Enter Operations Center
              </>
            )}
          </button>
        </form>

        <div className="admin-security-banner">
          <AlertTriangle size={24} style={{ flexShrink: 0, color: '#F59E0B' }} />
          <span>
            <strong>Isolated Architecture:</strong> All access attempts are cryptographically verified and recorded in the audit log. Unrecognized tokens are rejected instantly.
          </span>
        </div>

        <div style={{ marginTop: '20px', textAlign: 'center' }}>
          <Link
            to="/"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '0.8rem',
              color: '#64748B',
              textDecoration: 'none',
              transition: 'color 0.2s ease',
            }}
            onMouseOver={(e) => (e.currentTarget.style.color = '#94A3B8')}
            onMouseOut={(e) => (e.currentTarget.style.color = '#64748B')}
          >
            <ArrowLeft size={14} />
            Return to StudySync AI Student Platform
          </Link>
        </div>
      </div>
    </div>
  );
}
