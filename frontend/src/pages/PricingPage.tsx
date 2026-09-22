import { useState } from 'react';
import { Link } from 'react-router-dom';
import PublicHeader from '../components/PublicHeader';
import PublicFooter from '../components/PublicFooter';
import {
  Check,
  ArrowRight,
  Sparkles,
  HelpCircle,
  ShieldCheck,
  ChevronDown,
} from 'lucide-react';

interface FaqItem {
  q: string;
  a: string;
}

const FAQS: FaqItem[] = [
  {
    q: 'Is the Free Scholar tier really free forever?',
    a: 'Yes! The Free Scholar plan is genuinely free forever for personal academic study. You get up to 3 active courses, 100MB of slide storage, our natural Roman Urdu scheduler, and automated Gmail reminders without paying a single rupee or dollar.',
  },
  {
    q: 'Can I use my own Gemini or Groq API keys (BYOK)?',
    a: 'Absolutely. Every plan (including Free Scholar) supports Bring Your Own Key (BYOK). All API keys are encrypted at rest with authenticated AES-256-GCM encryption tags before saving to your isolated Supabase tenant.',
  },
  {
    q: 'How does WhatsApp Baileys notification integration work?',
    a: 'In your Settings tab, click "Pair WhatsApp". A QR code will display that you scan with your WhatsApp camera just like WhatsApp Web. Once paired, StudySync AI can push daily morning agendas, quiz warnings, and exam countdowns directly to your phone.',
  },
  {
    q: 'Can I cancel or change my plan anytime?',
    a: 'Yes, there are zero contracts or cancellation fees. You can upgrade, downgrade, or cancel your subscription at any time from your account settings. If you downgrade, your courses remain safely stored in your account.',
  },
  {
    q: 'Do you offer group discounts for university classes or FYP teams?',
    a: 'Yes! We offer bulk student group discounts for campus study circles, university clubs, and FYP project teams. Reach out to our campus ambassadors via our Contact page for customized semester packages.',
  },
];

export default function PricingPage() {
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const toggleFaq = (idx: number) => {
    setOpenFaq(openFaq === idx ? null : idx);
  };

  return (
    <div className="ss-landing-page">
      <PublicHeader />

      {/* Hero Section */}
      <section className="ss-page-hero">
        <div className="ss-edu-container" style={{ textAlign: 'center' }}>
          <div className="ss-edu-hero-tag">
            <Sparkles size={14} color="#4F46E5" />
            <span>Fair Student Pricing</span>
          </div>

          <h1 className="ss-page-hero-title">
            Invest in Your Grades, <br />
            <span className="ss-edu-highlight">Not Expensive Subscriptions</span>
          </h1>

          <p className="ss-page-hero-subtitle">
            StudySync AI is designed to be affordable for any university student. Free tier is genuinely free forever.
          </p>

          {/* Billing Cycle Toggle */}
          <div className="ss-pricing-toggle-wrap" style={{ marginTop: '28px' }}>
            <div className="ss-pricing-toggle">
              <button
                type="button"
                onClick={() => setBillingCycle('monthly')}
                className={`ss-pricing-toggle-btn ${billingCycle === 'monthly' ? 'active' : ''}`}
              >
                Monthly Billing
              </button>
              <button
                type="button"
                onClick={() => setBillingCycle('yearly')}
                className={`ss-pricing-toggle-btn ${billingCycle === 'yearly' ? 'active' : ''}`}
              >
                <span>Yearly Billing</span>
                <span style={{ fontSize: '0.65rem', padding: '2px 8px', borderRadius: '9999px', background: '#DCFCE7', color: '#166534', fontWeight: 700 }}>
                  Save 20%
                </span>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Cards Grid */}
      <section className="ss-pricing-cards-section">
        <div className="ss-edu-container">
          <div className="ss-pricing-grid">
            {/* Free Tier */}
            <div className="ss-pricing-card">
              <div>
                <div className="ss-pricing-plan-name">Free Scholar</div>
                <h3 className="ss-pricing-plan-headline">Basic</h3>
                <p className="ss-pricing-plan-desc">Essential autonomous study tools for casual students.</p>

                <div className="ss-pricing-price-wrap">
                  <span className="ss-pricing-price">$0</span>
                  <span className="ss-pricing-period">/ forever</span>
                </div>

                <ul className="ss-pricing-features-list">
                  <li className="ss-pricing-feature-item">
                    <Check size={16} color="#10B981" />
                    <span>Up to 3 Active Courses</span>
                  </li>
                  <li className="ss-pricing-feature-item">
                    <Check size={16} color="#10B981" />
                    <span>100MB Slide & Document Storage</span>
                  </li>
                  <li className="ss-pricing-feature-item">
                    <Check size={16} color="#10B981" />
                    <span>Natural Roman Urdu Scheduler</span>
                  </li>
                  <li className="ss-pricing-feature-item">
                    <Check size={16} color="#10B981" />
                    <span>Live Gmail Email Reminders</span>
                  </li>
                  <li className="ss-pricing-feature-item">
                    <Check size={16} color="#10B981" />
                    <span>BYOK Support (Gemini Flash & Groq)</span>
                  </li>
                  <li className="ss-pricing-feature-item">
                    <Check size={16} color="#10B981" />
                    <span>Isolated Supabase Tenant</span>
                  </li>
                </ul>
              </div>

              <Link to="/register?plan=free" className="ss-pricing-btn ss-pricing-btn-outline">
                <span>Start Free Forever</span>
                <ArrowRight size={14} />
              </Link>
            </div>

            {/* Pro Tier (Featured) */}
            <div className="ss-pricing-card featured">
              <div className="ss-pricing-badge-popular">Most Popular for University</div>

              <div>
                <div className="ss-pricing-plan-name">Pro Scholar</div>
                <h3 className="ss-pricing-plan-headline">Power Learner</h3>
                <p className="ss-pricing-plan-desc">Designed for heavy engineering, CS, and medical coursework.</p>

                <div className="ss-pricing-price-wrap">
                  <span className="ss-pricing-price">{billingCycle === 'monthly' ? '$4.99' : '$3.99'}</span>
                  <span className="ss-pricing-period">/ month</span>
                </div>

                <ul className="ss-pricing-features-list">
                  <li className="ss-pricing-feature-item">
                    <Check size={16} color="#10B981" />
                    <span style={{ fontWeight: 600, color: '#0F172A' }}>Unlimited Courses & Workspaces</span>
                  </li>
                  <li className="ss-pricing-feature-item">
                    <Check size={16} color="#10B981" />
                    <span>2GB High-Speed Vector Storage</span>
                  </li>
                  <li className="ss-pricing-feature-item">
                    <Check size={16} color="#10B981" />
                    <span>WhatsApp Baileys Real-Time Alerts</span>
                  </li>
                  <li className="ss-pricing-feature-item">
                    <Check size={16} color="#10B981" />
                    <span>ReAct Deep Thinking Reasoning Loop</span>
                  </li>
                  <li className="ss-pricing-feature-item">
                    <Check size={16} color="#10B981" />
                    <span>Autonomous Quiz & Exam Extraction</span>
                  </li>
                  <li className="ss-pricing-feature-item">
                    <Check size={16} color="#10B981" />
                    <span>Multi-Slide Vector RAG with Citations</span>
                  </li>
                </ul>
              </div>

              <Link to="/register?plan=pro" className="ss-pricing-btn ss-pricing-btn-primary">
                <span>Get Started with Pro</span>
                <ArrowRight size={14} />
              </Link>
            </div>

            {/* Campus Pioneer */}
            <div className="ss-pricing-card">
              <div>
                <div className="ss-pricing-plan-name">Campus Pioneer</div>
                <h3 className="ss-pricing-plan-headline">Research & Teams</h3>
                <p className="ss-pricing-plan-desc">Complete research autonomy for FYP and senior theses.</p>

                <div className="ss-pricing-price-wrap">
                  <span className="ss-pricing-price">{billingCycle === 'monthly' ? '$9.99' : '$7.99'}</span>
                  <span className="ss-pricing-period">/ month</span>
                </div>

                <ul className="ss-pricing-features-list">
                  <li className="ss-pricing-feature-item">
                    <Check size={16} color="#10B981" />
                    <span>Everything in Pro Scholar</span>
                  </li>
                  <li className="ss-pricing-feature-item">
                    <Check size={16} color="#10B981" />
                    <span>10GB Vectorized Slide Storage</span>
                  </li>
                  <li className="ss-pricing-feature-item">
                    <Check size={16} color="#10B981" />
                    <span>Lecture Audio Notes & Transcription</span>
                  </li>
                  <li className="ss-pricing-feature-item">
                    <Check size={16} color="#10B981" />
                    <span>Diagram / OCR Vision Analysis</span>
                  </li>
                  <li className="ss-pricing-feature-item">
                    <Check size={16} color="#10B981" />
                    <span>Priority GPU Inference Queues</span>
                  </li>
                  <li className="ss-pricing-feature-item">
                    <Check size={16} color="#10B981" />
                    <span>Priority 1-on-1 Academic Support</span>
                  </li>
                </ul>
              </div>

              <Link to="/register?plan=campus" className="ss-pricing-btn ss-pricing-btn-outline">
                <span>Select Campus Plan</span>
                <ArrowRight size={14} />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Trust & Guarantee Banner */}
      <section className="ss-pricing-guarantee-section">
        <div className="ss-edu-container">
          <div className="ss-guarantee-card">
            <ShieldCheck size={36} color="#10B981" />
            <div>
              <h3 style={{ margin: '0 0 6px', fontSize: '1.2rem', color: '#0F172A' }}>
                100% Student Satisfaction Guarantee
              </h3>
              <p style={{ margin: 0, color: '#64748B', fontSize: '0.925rem', lineHeight: 1.5 }}>
                Try Pro Scholar risk-free. If you don't feel noticeably less stressed about your exams and quizzes within 14 days, contact us for an instant refund.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Frequently Asked Questions */}
      <section className="ss-faq-section">
        <div className="ss-edu-container" style={{ maxWidth: '840px' }}>
          <div className="ss-edu-section-header">
            <div className="ss-edu-section-tag">Got Questions?</div>
            <h2 className="ss-edu-section-title">Frequently Asked Questions</h2>
            <p className="ss-edu-section-subtitle">
              Everything you need to know about StudySync AI subscriptions, tenant isolation, and billing.
            </p>
          </div>

          <div className="ss-faq-list">
            {FAQS.map((faq, index) => {
              const isOpen = openFaq === index;
              return (
                <div key={faq.q} className={`ss-faq-item ${isOpen ? 'open' : ''}`}>
                  <button
                    type="button"
                    onClick={() => toggleFaq(index)}
                    className="ss-faq-question-btn"
                  >
                    <span style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <HelpCircle size={18} color="#4F46E5" />
                      <strong>{faq.q}</strong>
                    </span>
                    <ChevronDown
                      size={18}
                      className={`ss-faq-chevron ${isOpen ? 'rotated' : ''}`}
                    />
                  </button>
                  {isOpen && (
                    <div className="ss-faq-answer">
                      <p style={{ margin: 0, color: '#475569', lineHeight: 1.6, fontSize: '0.925rem' }}>
                        {faq.a}
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="ss-edu-container ss-edu-cta-section">
        <div className="ss-edu-cta-card">
          <div style={{ position: 'relative', zIndex: 2, maxWidth: '640px', margin: '0 auto' }}>
            <h2 style={{ fontSize: '2.4rem', fontWeight: 800, margin: '0 0 16px', letterSpacing: '-0.02em' }}>
              Start With Free Scholar Today
            </h2>
            <p style={{ fontSize: '1.1rem', opacity: 0.9, lineHeight: 1.6, margin: '0 0 32px' }}>
              No credit card required. Upgrade whenever you're ready to add WhatsApp automation and unlimited course decks.
            </p>
            <div style={{ display: 'flex', gap: '14px', justifyContent: 'center', flexWrap: 'wrap' }}>
              <Link
                to="/register?plan=free"
                style={{
                  background: '#FFFFFF',
                  color: '#4F46E5',
                  padding: '14px 28px',
                  borderRadius: '9999px',
                  fontWeight: 700,
                  fontSize: '1rem',
                  textDecoration: 'none',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  boxShadow: '0 8px 24px rgba(0, 0, 0, 0.15)',
                }}
              >
                <span>Create Free Student Account</span>
                <ArrowRight size={16} />
              </Link>
            </div>
          </div>
        </div>
      </section>

      <PublicFooter />
    </div>
  );
}
