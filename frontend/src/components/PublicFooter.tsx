import { Link } from 'react-router-dom';
import { Sparkles, ShieldCheck, Mail, ArrowRight } from 'lucide-react';

export default function PublicFooter() {
  return (
    <footer className="ss-landing-footer">
      <div className="ss-footer-main ss-edu-container">
        {/* Brand & Mission Column */}
        <div className="ss-footer-col-brand">
          <Link to="/" className="ss-landing-brand" style={{ marginBottom: '16px' }}>
            <img
              src="/studysync-logo-transparent.png"
              alt="StudySync AI"
              className="ss-landing-brand-logo-img"
            />
            <span className="ss-landing-badge-pro">AI Pro</span>
          </Link>
          <p className="ss-footer-bio">
            The world's first autonomous multi-tenant academic operating system. Empowering university students to master course slides, calculate deadlines in Roman Urdu, and automate study reminders to WhatsApp and Gmail.
          </p>
          <div className="ss-footer-trust-chips">
            <span className="ss-footer-chip">
              <ShieldCheck size={14} color="#10B981" />
              <span>100% Isolated Supabase Cloud</span>
            </span>
            <span className="ss-footer-chip">
              <Sparkles size={14} color="#6366F1" />
              <span>AES-256-GCM BYOK</span>
            </span>
          </div>
        </div>

        {/* Quick Navigation */}
        <div className="ss-footer-col">
          <h4 className="ss-footer-col-title">Platform</h4>
          <ul className="ss-footer-links-list">
            <li><Link to="/" className="ss-footer-link">Home</Link></li>
            <li><Link to="/about" className="ss-footer-link">About Us</Link></li>
            <li><Link to="/features" className="ss-footer-link">Superpowers</Link></li>
            <li><Link to="/pricing" className="ss-footer-link">Student Pricing</Link></li>
          </ul>
        </div>

        {/* Resources & Community */}
        <div className="ss-footer-col">
          <h4 className="ss-footer-col-title">Resources</h4>
          <ul className="ss-footer-links-list">
            <li><Link to="/blog" className="ss-footer-link">Academic Blog</Link></li>
            <li><Link to="/contact" className="ss-footer-link">Contact & Support</Link></li>
            <li><Link to="/login" className="ss-footer-link">Student Sign In</Link></li>
            <li><Link to="/register" className="ss-footer-link">Create Account</Link></li>
          </ul>
        </div>

        {/* Newsletter / Stay Ahead */}
        <div className="ss-footer-col ss-footer-newsletter-col">
          <h4 className="ss-footer-col-title">Semester Insights</h4>
          <p style={{ fontSize: '0.875rem', color: '#64748B', lineHeight: 1.5, marginBottom: '14px' }}>
            Get weekly exam prep strategies, high-yield study frameworks, and product updates.
          </p>
          <div className="ss-footer-newsletter-form">
            <div className="ss-newsletter-input-wrap">
              <Mail size={16} color="#94A3B8" />
              <input
                type="email"
                placeholder="Enter university email..."
                className="ss-newsletter-input"
              />
            </div>
            <button
              type="button"
              className="ss-newsletter-btn"
              onClick={() => alert('Thank you for subscribing to StudySync Academic Insights!')}
            >
              <span>Join</span>
              <ArrowRight size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="ss-footer-bottom-bar ss-edu-container">
        <div style={{ color: '#94A3B8', fontSize: '0.8125rem' }}>
          © {new Date().getFullYear()} StudySync AI Inc. All rights reserved. Built for university scholars.
        </div>
        <div className="ss-footer-legal-links">
          <span style={{ color: '#059669', fontSize: '0.8125rem', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <span className="ss-pulse-dot" /> All Systems Operational
          </span>
          <span className="ss-dot-sep">•</span>
          <Link to="/about" className="ss-footer-sublink">Privacy & Tenant Isolation</Link>
          <span className="ss-dot-sep">•</span>
          <Link to="/contact" className="ss-footer-sublink">Campus Support</Link>
        </div>
      </div>
    </footer>
  );
}
