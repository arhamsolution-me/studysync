import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import PublicHeader from '../components/PublicHeader';
import PublicFooter from '../components/PublicFooter';
import {
  Search,
  BookOpen,
  Sparkles,
  ChevronRight,
  Layers,
  ArrowRight,
  GraduationCap,
  Clock,
  CheckCircle,
} from 'lucide-react';

interface CourseItem {
  id: string;
  code: string;
  name: string;
  department: string;
  credits: number;
  slidesCount: number;
  vectorsCount: number;
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced';
  description: string;
  keyTopics: string[];
  color: string;
}

const ALL_COURSES: CourseItem[] = [
  {
    id: 'cs-402',
    code: 'CS-402',
    name: 'Artificial Intelligence & Machine Learning',
    department: 'Computer Science',
    credits: 3,
    slidesCount: 14,
    vectorsCount: 142,
    difficulty: 'Advanced',
    description: 'Heuristic search algorithms, A* graph search, Support Vector Machines optimal margins proof, neural networks, and prompt engineering.',
    keyTopics: ['A* Search', 'SVM Margins', 'Decision Trees', 'Deep Networks'],
    color: '#4F46E5',
  },
  {
    id: 'cs-201',
    code: 'CS-201',
    name: 'Data Structures & Algorithms',
    department: 'Computer Science',
    credits: 4,
    slidesCount: 18,
    vectorsCount: 186,
    difficulty: 'Intermediate',
    description: 'Dynamic programming, greedy algorithms, balanced AVL trees, red-black trees, Dijkstra shortest paths, and asymptotic complexity.',
    keyTopics: ['AVL Trees', 'Dijkstra', 'DP Memoization', 'Big-O Analysis'],
    color: '#0284C7',
  },
  {
    id: 'math-101',
    code: 'MATH-101',
    name: 'Multivariable Calculus & Linear Algebra',
    department: 'Mathematics & Stats',
    credits: 3,
    slidesCount: 12,
    vectorsCount: 98,
    difficulty: 'Intermediate',
    description: 'Partial derivatives, gradient vectors, double and triple integrals, matrix transformations, eigenvalues, and Stokes theorem.',
    keyTopics: ['Gradients', 'Multiple Integrals', 'Eigenvalues', 'Vector Fields'],
    color: '#7C3AED',
  },
  {
    id: 'se-301',
    code: 'SE-301',
    name: 'Software Architecture & System Design',
    department: 'Software Engineering',
    credits: 3,
    slidesCount: 11,
    vectorsCount: 88,
    difficulty: 'Advanced',
    description: 'Microservices vs monolithic patterns, distributed caching, event-driven pipelines, CQRS pattern, and scalability trade-offs.',
    keyTopics: ['Microservices', 'Event-Driven', 'Caching Strategy', 'CQRS'],
    color: '#059669',
  },
  {
    id: 'cs-305',
    code: 'CS-305',
    name: 'Database Management Systems & SQL',
    department: 'Computer Science',
    credits: 3,
    slidesCount: 15,
    vectorsCount: 124,
    difficulty: 'Intermediate',
    description: 'Relational algebra, B+ Tree indexing, ACID transactions, 2-phase locking, Normalization (1NF to BCNF), and PostgreSQL query planning.',
    keyTopics: ['ACID Transactions', 'B+ Trees', 'BCNF Normalization', 'Postgres SQL'],
    color: '#D97706',
  },
  {
    id: 'ds-410',
    code: 'DS-410',
    name: 'Deep Learning & Computer Vision',
    department: 'Data Science',
    credits: 3,
    slidesCount: 16,
    vectorsCount: 160,
    difficulty: 'Advanced',
    description: 'Convolutional neural networks (CNNs), ResNets, YOLO object detection, transformer vision models, and backpropagation mathematics.',
    keyTopics: ['CNNs', 'ResNets', 'YOLO v8', 'Vision Transformers'],
    color: '#DC2626',
  },
  {
    id: 'ee-210',
    code: 'EE-210',
    name: 'Digital Logic Design & Verilog',
    department: 'Electrical Eng',
    credits: 3,
    slidesCount: 10,
    vectorsCount: 75,
    difficulty: 'Beginner',
    description: 'Karnaugh maps simplification, finite state machines (Moore & Mealy), multiplexers, flip-flops, and FPGA hardware description in Verilog.',
    keyTopics: ['K-Maps', 'FSM State Machines', 'Sequential Logic', 'Verilog'],
    color: '#0891B2',
  },
  {
    id: 'cs-310',
    code: 'CS-310',
    name: 'Computer Networks & Distributed Protocols',
    department: 'Computer Science',
    credits: 3,
    slidesCount: 13,
    vectorsCount: 110,
    difficulty: 'Intermediate',
    description: 'OSI and TCP/IP models, TCP flow and congestion control algorithms, subnetting and CIDR, DNS resolution, and TLS handshakes.',
    keyTopics: ['TCP/IP', 'Congestion Control', 'CIDR Subnetting', 'TLS Security'],
    color: '#9333EA',
  },
];

const DEPARTMENTS = [
  'All Departments',
  'Computer Science',
  'Software Engineering',
  'Mathematics & Stats',
  'Data Science',
  'Electrical Eng',
];

export default function PublicCourses() {
  const [selectedDept, setSelectedDept] = useState('All Departments');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredCourses = useMemo(() => {
    return ALL_COURSES.filter((c) => {
      const matchesDept =
        selectedDept === 'All Departments' || c.department === selectedDept;
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        c.code.toLowerCase().includes(q) ||
        c.name.toLowerCase().includes(q) ||
        c.description.toLowerCase().includes(q) ||
        c.keyTopics.some((t) => t.toLowerCase().includes(q));
      return matchesDept && matchesSearch;
    });
  }, [selectedDept, searchQuery]);

  return (
    <div className="ss-landing-page">
      <PublicHeader />

      {/* Hero Banner */}
      <section className="ss-page-hero">
        <div className="ss-edu-container" style={{ textAlign: 'center' }}>
          <div className="ss-edu-hero-tag">
            <GraduationCap size={14} color="#4F46E5" />
            <span>Curated University Workspaces</span>
          </div>

          <h1 className="ss-page-hero-title">
            Explore Supported <br />
            <span className="ss-edu-highlight">University Syllabi</span>
          </h1>

          <p className="ss-page-hero-subtitle">
            Every course workspace indexes verified university slides into sub-second vector databases. Ask our ReAct agent questions or automate exam reminders.
          </p>

          {/* Search Box */}
          <div className="ss-edu-search-box" style={{ margin: '0 auto 28px', maxWidth: '600px' }}>
            <Search className="ss-edu-search-icon" size={20} />
            <input
              type="text"
              placeholder="Search by course code, topic (e.g. CS-402, SVM, Dijkstra)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="ss-edu-search-input"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                style={{ background: 'transparent', border: 'none', color: '#94A3B8', cursor: 'pointer', fontSize: '0.875rem' }}
              >
                Clear
              </button>
            )}
          </div>

          {/* Department Filter Tabs */}
          <div className="ss-filter-tabs-row">
            {DEPARTMENTS.map((dept) => (
              <button
                key={dept}
                type="button"
                onClick={() => setSelectedDept(dept)}
                className={`ss-filter-tab ${selectedDept === dept ? 'active' : ''}`}
              >
                {dept}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Courses Grid */}
      <section className="ss-courses-catalog-section">
        <div className="ss-edu-container">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px' }}>
            <div style={{ fontSize: '0.925rem', color: '#64748B', fontWeight: 500 }}>
              Showing <strong style={{ color: '#0F172A' }}>{filteredCourses.length}</strong> active course workspaces
            </div>
            <Link to="/register" style={{ fontSize: '0.875rem', color: '#4F46E5', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <span>Upload Custom Syllabus</span>
              <ChevronRight size={14} />
            </Link>
          </div>

          {filteredCourses.length === 0 ? (
            <div className="ss-empty-courses-card">
              <BookOpen size={44} color="#94A3B8" />
              <h3 style={{ margin: '14px 0 6px', color: '#0F172A' }}>No matching courses found</h3>
              <p style={{ margin: '0 0 16px', color: '#64748B' }}>
                Try searching for a different keyword or department. You can also upload any custom PDF syllabus!
              </p>
              <button
                type="button"
                onClick={() => { setSearchQuery(''); setSelectedDept('All Departments'); }}
                className="ss-edu-search-btn"
              >
                <span>Reset Filters</span>
              </button>
            </div>
          ) : (
            <div className="ss-courses-catalog-grid">
              {filteredCourses.map((c) => (
                <div key={c.id} className="ss-catalog-card">
                  <div className="ss-catalog-card-header">
                    <span className="ss-catalog-code" style={{ color: c.color, borderColor: `${c.color}30`, background: `${c.color}10` }}>
                      {c.code}
                    </span>
                    <span className="ss-catalog-dept">{c.department}</span>
                  </div>

                  <h3 className="ss-catalog-title">{c.name}</h3>
                  <p className="ss-catalog-desc">{c.description}</p>

                  {/* High Yield Topics Pills */}
                  <div className="ss-catalog-topics-row">
                    {c.keyTopics.map((topic) => (
                      <span key={topic} className="ss-topic-pill">
                        {topic}
                      </span>
                    ))}
                  </div>

                  {/* Telemetry metadata */}
                  <div className="ss-catalog-meta-row">
                    <span className="ss-catalog-meta-item">
                      <BookOpen size={13} />
                      <span>{c.slidesCount} Slides</span>
                    </span>
                    <span className="ss-catalog-meta-item">
                      <Layers size={13} />
                      <span>{c.vectorsCount} Vector Chunks</span>
                    </span>
                    <span className="ss-catalog-meta-item">
                      <Clock size={13} />
                      <span>{c.credits} Credit Hours</span>
                    </span>
                  </div>

                  {/* CTA Action Button */}
                  <div className="ss-catalog-action-row">
                    <Link
                      to={`/register?course=${c.code}`}
                      className="ss-catalog-btn-primary"
                    >
                      <Sparkles size={15} />
                      <span>Ask Syllabus Copilot</span>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Explainer: How Course Vector RAG Works */}
      <section className="ss-courses-how-it-works">
        <div className="ss-edu-container">
          <div className="ss-edu-section-header">
            <div className="ss-edu-section-tag">Vector Architecture</div>
            <h2 className="ss-edu-section-title">How Course RAG Guarantees Exam Accuracy</h2>
            <p className="ss-edu-section-subtitle">
              Unlike generic chatbots that hallucinate false formulas, StudySync AI anchors every answer strictly to your professor's lecture slides.
            </p>
          </div>

          <div className="ss-edu-features-grid">
            <div className="ss-edu-feature-card">
              <div className="ss-edu-feature-icon" style={{ background: '#EEF2FF', color: '#4F46E5' }}>
                <Layers size={24} />
              </div>
              <h3 className="ss-edu-feature-title">1. PDF Chunking & Embeddings</h3>
              <p className="ss-edu-feature-desc">
                Your slide decks are partitioned into dense semantic chunks and vectorized using high-dimensional embeddings.
              </p>
            </div>

            <div className="ss-edu-feature-card">
              <div className="ss-edu-feature-icon" style={{ background: '#ECFDF5', color: '#059669' }}>
                <Search size={24} />
              </div>
              <h3 className="ss-edu-feature-title">2. Sub-Second FAISS Search</h3>
              <p className="ss-edu-feature-desc">
                When you ask a question like "Explain Slide 44 SVM margin proof", the exact slide vector is retrieved in under 200ms.
              </p>
            </div>

            <div className="ss-edu-feature-card">
              <div className="ss-edu-feature-icon" style={{ background: '#F5F3FF', color: '#7C3AED' }}>
                <CheckCircle size={24} />
              </div>
              <h3 className="ss-edu-feature-title">3. Citation-Backed Answers</h3>
              <p className="ss-edu-feature-desc">
                The agent quotes exact page numbers, slide titles, and formulas so you study verified material with 100% confidence.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="ss-edu-container ss-edu-cta-section">
        <div className="ss-edu-cta-card">
          <div style={{ position: 'relative', zIndex: 2, maxWidth: '640px', margin: '0 auto' }}>
            <h2 style={{ fontSize: '2.4rem', fontWeight: 800, margin: '0 0 16px', letterSpacing: '-0.02em' }}>
              Don't See Your Specific Course?
            </h2>
            <p style={{ fontSize: '1.1rem', opacity: 0.9, lineHeight: 1.6, margin: '0 0 32px' }}>
              Upload any PDF lecture slide, textbook chapter, or assignment brief. StudySync AI indexes custom courses in seconds.
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
                <span>Upload Custom Course Slides</span>
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
