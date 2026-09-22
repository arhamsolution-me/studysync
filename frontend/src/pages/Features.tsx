import { useState } from 'react';
import { Link } from 'react-router-dom';
import PublicHeader from '../components/PublicHeader';
import PublicFooter from '../components/PublicFooter';
import {
  Sparkles,
  Brain,
  Search,
  Smartphone,
  Lock,
  Check,
  X,
  ArrowRight,
  ShieldCheck,
  Bot,
  Zap,
} from 'lucide-react';

export default function Features() {
  const [activeTab, setActiveTab] = useState<'nlp' | 'rag' | 'alerts' | 'security'>('nlp');

  const comparisonData = [
    {
      feature: 'Roman Urdu & English Natural Language Processing',
      studySync: true,
      chatGpt: false,
      notion: false,
      googleCal: false,
    },
    {
      feature: 'Upload & Index Custom University Lecture Slides (PDF)',
      studySync: true,
      chatGpt: 'File limits / General web only',
      notion: 'Static storage only',
      googleCal: false,
    },
    {
      feature: 'Slide Citations with Exact Page Numbers & Formulas',
      studySync: true,
      chatGpt: false,
      notion: false,
      googleCal: false,
    },
    {
      feature: 'Proactive WhatsApp Reminders & Morning Agendas',
      studySync: true,
      chatGpt: false,
      notion: false,
      googleCal: false,
    },
    {
      feature: 'Automated 24h & 12h Exam Countdown Email Alerts',
      studySync: true,
      chatGpt: false,
      notion: false,
      googleCal: 'Basic notifications',
    },
    {
      feature: 'AES-256-GCM Encrypted BYOK (Bring Your Own Key)',
      studySync: true,
      chatGpt: false,
      notion: false,
      googleCal: false,
    },
    {
      feature: 'Strict 100% Isolated Supabase Database per Tenant',
      studySync: true,
      chatGpt: false,
      notion: 'Shared workspace',
      googleCal: 'Shared Google ecosystem',
    },
  ];

  return (
    <div className="ss-landing-page">
      <PublicHeader />

      {/* Hero Section */}
      <section className="ss-page-hero">
        <div className="ss-edu-container" style={{ textAlign: 'center' }}>
          <div className="ss-edu-hero-tag">
            <Zap size={14} color="#4F46E5" />
            <span>Autonomous Capabilities</span>
          </div>

          <h1 className="ss-page-hero-title">
            Engineered for <br />
            <span className="ss-edu-highlight">Academic Superpowers</span>
          </h1>

          <p className="ss-page-hero-subtitle">
            StudySync AI combines bilingual ReAct reasoning, course-scoped FAISS vector stores, and automated WhatsApp alert dispatching into one seamless operating system.
          </p>
        </div>
      </section>

      {/* Interactive Feature Deep-Dive Tabs */}
      <section className="ss-features-deepdive-section">
        <div className="ss-edu-container">
          <div className="ss-feature-tab-nav">
            <button
              type="button"
              onClick={() => setActiveTab('nlp')}
              className={`ss-feature-nav-btn ${activeTab === 'nlp' ? 'active' : ''}`}
            >
              <Brain size={18} />
              <span>Roman Urdu ReAct NLP</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('rag')}
              className={`ss-feature-nav-btn ${activeTab === 'rag' ? 'active' : ''}`}
            >
              <Search size={18} />
              <span>Course-Scoped FAISS RAG</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('alerts')}
              className={`ss-feature-nav-btn ${activeTab === 'alerts' ? 'active' : ''}`}
            >
              <Smartphone size={18} />
              <span>WhatsApp & Email Alerts</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('security')}
              className={`ss-feature-nav-btn ${activeTab === 'security' ? 'active' : ''}`}
            >
              <Lock size={18} />
              <span>BYOK & Tenant Security</span>
            </button>
          </div>

          {/* Tab 1: Roman Urdu ReAct NLP */}
          {activeTab === 'nlp' && (
            <div className="ss-deepdive-panel">
              <div className="ss-deepdive-grid">
                <div className="ss-deepdive-text">
                  <span className="ss-edu-section-tag">Bilingual Academic Intelligence</span>
                  <h3 className="ss-deepdive-heading">Talk Like a Student, Get Treated Like a Scholar</h3>
                  <p className="ss-about-paragraph">
                    University students rarely speak in rigid formal sentences. They say <em>"Kal mera AI ka quiz hai slides 3 se 8 tak, schedule bana do"</em> or <em>"Parso raat assignment due hai"</em>.
                  </p>
                  <p className="ss-about-paragraph">
                    Our ReAct (Reasoning + Action) engine detects the target course, parses relative dates against your current timezone, extracts slide bounds, and updates your calendar in under 500 milliseconds.
                  </p>
                  <ul className="ss-deepdive-checklist">
                    <li><Check size={16} color="#10B981" /> <span>Handles Roman Urdu, English, and mixed Pakistani campus slang</span></li>
                    <li><Check size={16} color="#10B981" /> <span>Self-correcting ReAct reasoning loop with tool calling</span></li>
                    <li><Check size={16} color="#10B981" /> <span>Voice note & audio transcription support</span></li>
                  </ul>
                </div>

                <div className="ss-deepdive-demo-card">
                  <div className="ss-demo-header">
                    <Bot size={16} color="#4F46E5" />
                    <span>Live ReAct NLP Trace</span>
                  </div>
                  <div className="ss-demo-body">
                    <div className="ss-demo-user-msg">
                      <strong>You:</strong> "Sir ne bola hai kal AI ka quiz hai slides 4 se 9 tak. Schedule bana do."
                    </div>
                    <div className="ss-demo-trace-step">
                      <Sparkles size={14} color="#6366F1" />
                      <span>Action: <code>schedule_quiz(course="CS-402", date="Tomorrow", slides=[4,9])</code></span>
                    </div>
                    <div className="ss-demo-agent-res">
                      <strong>Copilot:</strong> "Maine aapka CS-402 Quiz 2 schedule kar diya hai. Tomorrow 10:00 AM. WhatsApp alert scheduled for 8:00 AM!"
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Tab 2: Course-Scoped FAISS RAG */}
          {activeTab === 'rag' && (
            <div className="ss-deepdive-panel">
              <div className="ss-deepdive-grid">
                <div className="ss-deepdive-text">
                  <span className="ss-edu-section-tag">Zero-Hallucination Slide Retrieval</span>
                  <h3 className="ss-deepdive-heading">Grounding Every Formula in Your Professor's Slides</h3>
                  <p className="ss-about-paragraph">
                    Generic AI models answer questions with Wikipedia or generalized web definitions that contradict your university syllabus.
                  </p>
                  <p className="ss-about-paragraph">
                    StudySync AI splits lecture slide PDFs into dense semantic embeddings and stores them in localized FAISS vector indexes. Every response includes the exact slide number, slide title, and mathematical derivation.
                  </p>
                  <ul className="ss-deepdive-checklist">
                    <li><Check size={16} color="#10B981" /> <span>Sub-second cosine similarity retrieval in FAISS</span></li>
                    <li><Check size={16} color="#10B981" /> <span>Page number citations with inline mathematical proof preview</span></li>
                    <li><Check size={16} color="#10B981" /> <span>Supports PDF, DOCX, TXT, and scanned image diagrams</span></li>
                  </ul>
                </div>

                <div className="ss-deepdive-demo-card">
                  <div className="ss-demo-header">
                    <Search size={16} color="#059669" />
                    <span>FAISS Vector Retrieval Preview</span>
                  </div>
                  <div className="ss-demo-body">
                    <div style={{ background: '#F8FAFC', padding: '12px', borderRadius: '10px', marginBottom: '10px', border: '1px solid #E2E8F0' }}>
                      <div style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 600 }}>RETRIEVED CHUNK #1 • SCORE: 0.94</div>
                      <div style={{ fontSize: '0.875rem', fontWeight: 700, color: '#0F172A', marginTop: '4px' }}>
                        CS-402 Slide 44: SVM Optimal Hyperplane
                      </div>
                      <code style={{ fontSize: '0.78rem', color: '#4F46E5', background: '#EEF2FF', padding: '2px 6px', borderRadius: '4px' }}>
                        w^T x + b = 0 & Margin = 2 / ||w||
                      </code>
                    </div>
                    <div style={{ fontSize: '0.8125rem', color: '#059669', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Check size={14} /> Verified with Course Syllabus
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Tab 3: WhatsApp & Email Alerts */}
          {activeTab === 'alerts' && (
            <div className="ss-deepdive-panel">
              <div className="ss-deepdive-grid">
                <div className="ss-deepdive-text">
                  <span className="ss-edu-section-tag">Proactive Omnichannel Delivery</span>
                  <h3 className="ss-deepdive-heading">Never Miss an Exam or Quiz Announcement Again</h3>
                  <p className="ss-about-paragraph">
                    You shouldn't have to keep an app open to remember your deadlines. StudySync AI pushes time-sensitive reminders straight to where you actually look: WhatsApp and your university inbox.
                  </p>
                  <p className="ss-about-paragraph">
                    Receive morning agendas at 8:00 AM, high-priority quiz warnings 24 hours and 12 hours prior, and instant flashcard digests.
                  </p>
                  <ul className="ss-deepdive-checklist">
                    <li><Check size={16} color="#10B981" /> <span>One-click QR code WhatsApp pairing via Baileys</span></li>
                    <li><Check size={16} color="#10B981" /> <span>Gmail SMTP integration with branded countdown digests</span></li>
                    <li><Check size={16} color="#10B981" /> <span>Ask questions directly in WhatsApp chat</span></li>
                  </ul>
                </div>

                <div className="ss-deepdive-demo-card">
                  <div className="ss-demo-header">
                    <Smartphone size={16} color="#0284C7" />
                    <span>WhatsApp Alert Dispatch</span>
                  </div>
                  <div className="ss-demo-body">
                    <div style={{ background: '#DCF8C6', padding: '14px', borderRadius: '12px', color: '#0F172A', fontSize: '0.875rem', lineHeight: 1.5, boxShadow: '0 2px 6px rgba(0,0,0,0.05)' }}>
                      <strong>StudySync Copilot 🔔</strong><br />
                      Assalam-o-Alaikum! Kal subha 10:00 AM aapka <strong>CS-402 AI Quiz</strong> hai.<br />
                      📌 Syllabus: Slides 4 - 9 (SVM & Heuristics).<br />
                      <em>Good luck with your revision!</em>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Tab 4: BYOK & Security */}
          {activeTab === 'security' && (
            <div className="ss-deepdive-panel">
              <div className="ss-deepdive-grid">
                <div className="ss-deepdive-text">
                  <span className="ss-edu-section-tag">Enterprise-Grade Student Privacy</span>
                  <h3 className="ss-deepdive-heading">Your Data Is Yours. Period.</h3>
                  <p className="ss-about-paragraph">
                    We believe student notes, academic transcripts, and LLM API keys should never be pooled or mined. Every user gets a fully isolated tenant schema in Supabase with strict Row-Level Security (RLS).
                  </p>
                  <p className="ss-about-paragraph">
                    Want to use your own Google Gemini Flash or Groq high-speed key? Enter it in Settings; your key is encrypted with AES-256-GCM authenticated tags before hitting the database.
                  </p>
                  <ul className="ss-deepdive-checklist">
                    <li><Check size={16} color="#10B981" /> <span>AES-256-GCM BYOK encryption engine</span></li>
                    <li><Check size={16} color="#10B981" /> <span>100% Isolated Supabase schema per student</span></li>
                    <li><Check size={16} color="#10B981" /> <span>Zero data sharing or public model retraining</span></li>
                  </ul>
                </div>

                <div className="ss-deepdive-demo-card">
                  <div className="ss-demo-header">
                    <ShieldCheck size={16} color="#F59E0B" />
                    <span>Cryptographic BYOK Status</span>
                  </div>
                  <div className="ss-demo-body">
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem' }}>
                        <span style={{ color: '#64748B' }}>Encryption Algorithm:</span>
                        <strong style={{ color: '#0F172A' }}>AES-256-GCM</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem' }}>
                        <span style={{ color: '#64748B' }}>Tenant Isolation:</span>
                        <span style={{ color: '#059669', fontWeight: 700 }}>Supabase RLS Active</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem' }}>
                        <span style={{ color: '#64748B' }}>BYOK Providers:</span>
                        <strong style={{ color: '#4F46E5' }}>Gemini, Groq, OpenAI</strong>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Feature Comparison Table */}
      <section className="ss-comparison-section">
        <div className="ss-edu-container">
          <div className="ss-edu-section-header">
            <div className="ss-edu-section-tag">Direct Comparison</div>
            <h2 className="ss-edu-section-title">How StudySync AI Compares</h2>
            <p className="ss-edu-section-subtitle">
              Why thousands of university students switch from generic note apps and chatbots to dedicated academic autonomy.
            </p>
          </div>

          <div className="ss-table-responsive-wrap">
            <table className="ss-comparison-table">
              <thead>
                <tr>
                  <th style={{ width: '40%' }}>Core Academic Capability</th>
                  <th className="highlight-col" style={{ width: '22%' }}>StudySync AI</th>
                  <th style={{ width: '15%' }}>ChatGPT Free</th>
                  <th style={{ width: '11%' }}>Notion</th>
                  <th style={{ width: '12%' }}>Google Cal</th>
                </tr>
              </thead>
              <tbody>
                {comparisonData.map((row) => (
                  <tr key={row.feature}>
                    <td style={{ fontWeight: 600, color: '#0F172A' }}>{row.feature}</td>
                    <td className="highlight-col">
                      {typeof row.studySync === 'boolean' ? (
                        row.studySync ? <Check size={18} color="#4F46E5" strokeWidth={3} /> : <X size={18} color="#94A3B8" />
                      ) : (
                        <span>{row.studySync}</span>
                      )}
                    </td>
                    <td>
                      {typeof row.chatGpt === 'boolean' ? (
                        row.chatGpt ? <Check size={18} color="#10B981" /> : <X size={18} color="#CBD5E1" />
                      ) : (
                        <span style={{ fontSize: '0.78rem', color: '#64748B' }}>{row.chatGpt}</span>
                      )}
                    </td>
                    <td>
                      {typeof row.notion === 'boolean' ? (
                        row.notion ? <Check size={18} color="#10B981" /> : <X size={18} color="#CBD5E1" />
                      ) : (
                        <span style={{ fontSize: '0.78rem', color: '#64748B' }}>{row.notion}</span>
                      )}
                    </td>
                    <td>
                      {typeof row.googleCal === 'boolean' ? (
                        row.googleCal ? <Check size={18} color="#10B981" /> : <X size={18} color="#CBD5E1" />
                      ) : (
                        <span style={{ fontSize: '0.78rem', color: '#64748B' }}>{row.googleCal}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="ss-edu-container ss-edu-cta-section">
        <div className="ss-edu-cta-card">
          <div style={{ position: 'relative', zIndex: 2, maxWidth: '640px', margin: '0 auto' }}>
            <h2 style={{ fontSize: '2.4rem', fontWeight: 800, margin: '0 0 16px', letterSpacing: '-0.02em' }}>
              Unlock Every Feature For Free
            </h2>
            <p style={{ fontSize: '1.1rem', opacity: 0.9, lineHeight: 1.6, margin: '0 0 32px' }}>
              Create your free student account today. No credit card required. Free tier includes Roman Urdu NLP and verified slide search.
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
                <span>Get Started Now</span>
                <ArrowRight size={16} />
              </Link>
              <Link
                to="/pricing"
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
                <span>View All Plans</span>
              </Link>
            </div>
          </div>
        </div>
      </section>

      <PublicFooter />
    </div>
  );
}
