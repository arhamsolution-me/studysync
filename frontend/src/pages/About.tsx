import { Link } from 'react-router-dom';
import PublicHeader from '../components/PublicHeader';
import PublicFooter from '../components/PublicFooter';
import {
  Sparkles,
  ShieldCheck,
  Brain,
  Smartphone,
  Lock,
  ArrowRight,
  Award,
  Users,
  CheckCircle2,
} from 'lucide-react';

export default function About() {
  const values = [
    {
      icon: <ShieldCheck size={28} color="#10B981" />,
      title: 'Zero-Knowledge Privacy',
      desc: 'Your university slides, notes, assignments, and exam dates are strictly isolated in your dedicated Supabase schema. We never train public models on your data.',
    },
    {
      icon: <Brain size={28} color="#6366F1" />,
      title: 'Bilingual Roman Urdu NLP',
      desc: 'Built specifically for bilingual South Asian and global university students. Speak or text naturally in Roman Urdu or English without rigid syntax.',
    },
    {
      icon: <Smartphone size={28} color="#0284C7" />,
      title: 'Autonomous Proactivity',
      desc: 'Traditional tools require you to open them. StudySync actively monitors your academic milestones and pushes critical reminders to your WhatsApp & Gmail.',
    },
    {
      icon: <Lock size={28} color="#F59E0B" />,
      title: 'Client-Side BYOK Sovereignty',
      desc: 'Bring your own Gemini or Groq API keys. Your keys are protected with authenticated AES-256-GCM encryption before saving to cloud storage.',
    },
  ];

  const milestones = [
    { number: '100K+', label: 'Slide Chunks Vectorized' },
    { number: '99.4%', label: 'Exam Date Extraction Accuracy' },
    { number: '100%', label: 'Supabase Tenant Isolation' },
    { number: '24/7', label: 'Autonomous Alert Dispatcher' },
  ];

  return (
    <div className="ss-landing-page">
      <PublicHeader />

      {/* Hero Banner */}
      <section className="ss-page-hero">
        <div className="ss-edu-container" style={{ textAlign: 'center' }}>
          <div className="ss-edu-hero-tag">
            <Sparkles size={14} color="#4F46E5" />
            <span>About StudySync AI</span>
          </div>

          <h1 className="ss-page-hero-title">
            Empowering Students with <br />
            <span className="ss-edu-highlight">True Academic Autonomy</span>
          </h1>

          <p className="ss-page-hero-subtitle">
            StudySync AI was built by engineers and university alumni who grew tired of scattered lecture slides, missed quiz notices, and generic AI chatbots that hallucinate.
          </p>
        </div>
      </section>

      {/* The Story & Mission Section */}
      <section className="ss-about-story-section">
        <div className="ss-edu-container">
          <div className="ss-about-story-grid">
            <div className="ss-about-story-content">
              <div className="ss-edu-section-tag">Our Origin Story</div>
              <h2 className="ss-edu-section-title" style={{ textAlign: 'left' }}>
                Born From 2 AM Cramming & WhatsApp Syllabus Chaos
              </h2>
              <p className="ss-about-paragraph">
                Every semester, university students face the same overwhelming cycle: 5 to 6 heavy courses, 40+ slide decks per course, spontaneous quiz announcements dropped in messy WhatsApp group chats, and vague exam schedules.
              </p>
              <p className="ss-about-paragraph">
                Existing tools like Notion require tedious manual data entry. Generic AI tools like ChatGPT don't have access to your specific professor's lecture slides and invent concepts that cost you marks on your exams.
              </p>
              <p className="ss-about-paragraph">
                We designed <strong>StudySync AI</strong> to be different: a personal, autonomous academic copilot that indexes your course slides using sub-second vector search, understands your natural Roman Urdu messages, and proactively alerts you before high-stakes deadlines.
              </p>

              <div className="ss-about-story-highlights">
                <div className="ss-story-pill">
                  <CheckCircle2 size={16} color="#4F46E5" />
                  <span>No tedious manual task entry</span>
                </div>
                <div className="ss-story-pill">
                  <CheckCircle2 size={16} color="#4F46E5" />
                  <span>Verified slide citations with page numbers</span>
                </div>
                <div className="ss-story-pill">
                  <CheckCircle2 size={16} color="#4F46E5" />
                  <span>Works over WhatsApp & Gmail</span>
                </div>
              </div>
            </div>

            {/* Visual Card / Collage */}
            <div className="ss-about-story-visual">
              <div className="ss-about-image-card">
                <img
                  src="/hero-ai-study-robot.jpg"
                  alt="StudySync AI autonomous student robot assistant"
                  className="ss-about-img"
                />
                <div className="ss-about-floating-stat">
                  <Award size={24} color="#FFFFFF" />
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '1.25rem' }}>Top 1%</div>
                    <div style={{ fontSize: '0.75rem', opacity: 0.9 }}>Academic Copilot Architecture</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Core Values Section */}
      <section className="ss-about-values-section">
        <div className="ss-edu-container">
          <div className="ss-edu-section-header">
            <div className="ss-edu-section-tag">Guiding Principles</div>
            <h2 className="ss-edu-section-title">What Drives StudySync AI</h2>
            <p className="ss-edu-section-subtitle">
              Every design decision in our platform is anchored in academic integrity, data privacy, and extreme student convenience.
            </p>
          </div>

          <div className="ss-edu-features-grid">
            {values.map((v) => (
              <div key={v.title} className="ss-edu-feature-card">
                <div className="ss-edu-feature-icon" style={{ background: '#F8FAFC' }}>
                  {v.icon}
                </div>
                <h3 className="ss-edu-feature-title">{v.title}</h3>
                <p className="ss-edu-feature-desc">{v.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* By the Numbers Stats Bar */}
      <section className="ss-about-stats-section">
        <div className="ss-edu-container">
          <div className="ss-about-stats-grid">
            {milestones.map((m) => (
              <div key={m.label} className="ss-about-stat-item">
                <div className="ss-about-stat-number">{m.number}</div>
                <div className="ss-about-stat-label">{m.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Team / Student Community Section */}
      <section className="ss-about-team-section">
        <div className="ss-edu-container">
          <div className="ss-edu-section-header">
            <div className="ss-edu-section-tag">University Community</div>
            <h2 className="ss-edu-section-title">Engineered with Student Feedback</h2>
            <p className="ss-edu-section-subtitle">
              Built alongside university students from FAST-NUCES, UMT, NUST, LUMS, and global universities who tested our NLP and RAG pipelines.
            </p>
          </div>

          <div className="ss-team-quote-card">
            <div style={{ display: 'flex', gap: '16px', alignItems: 'center', marginBottom: '16px' }}>
              <div className="ss-team-avatar">
                <Users size={22} color="#4F46E5" />
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: '1.05rem', color: '#0F172A' }}>
                  Student Advisory Panel
                </div>
                <div style={{ fontSize: '0.8125rem', color: '#64748B' }}>
                  CS, Software Engineering & Medical Cohorts
                </div>
              </div>
            </div>
            <p style={{ fontSize: '1rem', color: '#334155', lineHeight: 1.65, fontStyle: 'italic', margin: 0 }}>
              "StudySync AI eliminated the panic of unexpected quizzes. You just send a voice note or Roman Urdu message like 'Kal AI ka test hai', and by the time you check your phone, your agenda is organized, notes are extracted, and your WhatsApp alert is scheduled."
            </p>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="ss-edu-container ss-edu-cta-section">
        <div className="ss-edu-cta-card">
          <div style={{ position: 'relative', zIndex: 2, maxWidth: '640px', margin: '0 auto' }}>
            <h2 style={{ fontSize: '2.4rem', fontWeight: 800, margin: '0 0 16px', letterSpacing: '-0.02em' }}>
              Join the Academic Revolution
            </h2>
            <p style={{ fontSize: '1.1rem', opacity: 0.9, lineHeight: 1.6, margin: '0 0 32px' }}>
              Experience the difference of an AI that truly understands your course slides, syllabus deadlines, and university life.
            </p>
            <div style={{ display: 'flex', gap: '14px', justifyContent: 'center', flexWrap: 'wrap' }}>
              <Link
                to="/register"
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
              <Link
                to="/features"
                style={{
                  background: 'rgba(255, 255, 255, 0.15)',
                  color: '#FFFFFF',
                  border: '1px solid rgba(255, 255, 255, 0.3)',
                  padding: '14px 24px',
                  borderRadius: '9999px',
                  fontWeight: 600,
                  fontSize: '1rem',
                  textDecoration: 'none',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <span>Explore Superpowers</span>
              </Link>
            </div>
          </div>
        </div>
      </section>

      <PublicFooter />
    </div>
  );
}
