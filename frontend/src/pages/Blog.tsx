import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import PublicHeader from '../components/PublicHeader';
import PublicFooter from '../components/PublicFooter';
import {
  Sparkles,
  BookOpen,
  Clock,
  ArrowRight,
  Search,
  User,
} from 'lucide-react';

interface BlogPost {
  id: string;
  title: string;
  category: 'Exam Prep' | 'AI & Learning' | 'Time Management' | 'Campus Stories';
  readTime: string;
  date: string;
  author: string;
  snippet: string;
  featured?: boolean;
}

const BLOG_POSTS: BlogPost[] = [
  {
    id: 'react-nlp-cramming',
    title: 'How ReAct Agents and Roman Urdu NLP Are Solving the 2 AM Cramming Crisis',
    category: 'AI & Learning',
    readTime: '5 min read',
    date: 'Sep 18, 2026',
    author: 'Hamza Tariq (AI Research Lead)',
    snippet: 'When students type "kal quiz hai slide 4 se 9 tak", traditional chatbots fail to understand context or calendar math. Discover how dual-language ReAct tool loops parse student intent in under 500ms.',
    featured: true,
  },
  {
    id: 'whatsapp-retention-rule',
    title: 'The 24-Hour Rule: Why Automated WhatsApp Alerts Double Exam Recall',
    category: 'Exam Prep',
    readTime: '4 min read',
    date: 'Sep 15, 2026',
    author: 'Ayesha Malik (Cognitive Psychology)',
    snippet: 'Cognitive science shows that spaced reminders delivered to a primary messaging channel drastically reduce pre-exam cortisol while boosting active recall by up to 68%.',
  },
  {
    id: 'byok-encryption-demystified',
    title: 'BYOK Demystified: Keeping Your Gemini & Groq Keys Cryptographically Safe',
    category: 'AI & Learning',
    readTime: '6 min read',
    date: 'Sep 10, 2026',
    author: 'Saad Ahmed (Security Eng)',
    snippet: 'Learn how StudySync AI uses AES-256-GCM authentication tags and Supabase Row-Level Security so that no one—not even server administrators—can access your raw LLM keys.',
  },
  {
    id: 'cs-student-case-study',
    title: 'From Panic to Dean’s List: How a 3rd-Year CS Major Automated Midterm Prep',
    category: 'Campus Stories',
    readTime: '5 min read',
    date: 'Sep 05, 2026',
    author: 'Bilal Khan (FAST-NUCES Alumni)',
    snippet: 'Managing 6 heavy courses including Operating Systems and Algorithms was overwhelming. Here is how indexing 42 slide decks into localized FAISS vector stores cut revision time in half.',
  },
  {
    id: 'faiss-vs-chatgpt-hallucinations',
    title: 'Why Generic AI Hallucinates on Your Exams (And How FAISS RAG Fixes It)',
    category: 'AI & Learning',
    readTime: '7 min read',
    date: 'Aug 28, 2026',
    author: 'StudySync AI Team',
    snippet: 'When you ask ChatGPT for a specific lecture derivation, it predicts general statistical tokens. StudySync AI grounds its answers strictly in the vector embeddings of your professor’s exact slides.',
  },
  {
    id: 'anti-procrastination-matrix',
    title: 'The Anti-Procrastination Matrix: Breaking Semester Projects Into Daily Milestones',
    category: 'Time Management',
    readTime: '4 min read',
    date: 'Aug 20, 2026',
    author: 'Dr. Sarah Jenkins',
    snippet: 'A practical framework for taking a daunting 40-page software architecture design specification and turning it into effortless 45-minute daily focus sessions.',
  },
];

const CATEGORIES = [
  'All Articles',
  'Exam Prep',
  'AI & Learning',
  'Time Management',
  'Campus Stories',
];

export default function Blog() {
  const [selectedCategory, setSelectedCategory] = useState('All Articles');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredPosts = useMemo(() => {
    return BLOG_POSTS.filter((post) => {
      const matchesCategory =
        selectedCategory === 'All Articles' || post.category === selectedCategory;
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        post.title.toLowerCase().includes(q) ||
        post.snippet.toLowerCase().includes(q) ||
        post.author.toLowerCase().includes(q);
      return matchesCategory && matchesSearch;
    });
  }, [selectedCategory, searchQuery]);

  const featuredPost = BLOG_POSTS.find((p) => p.featured) || BLOG_POSTS[0];

  return (
    <div className="ss-landing-page">
      <PublicHeader />

      {/* Hero Section */}
      <section className="ss-page-hero">
        <div className="ss-edu-container" style={{ textAlign: 'center' }}>
          <div className="ss-edu-hero-tag">
            <BookOpen size={14} color="#4F46E5" />
            <span>Academic Insights & Guides</span>
          </div>

          <h1 className="ss-page-hero-title">
            Master the Science of <br />
            <span className="ss-edu-highlight">Autonomous Learning</span>
          </h1>

          <p className="ss-page-hero-subtitle">
            Curated articles on cognitive learning strategies, bilingual NLP breakthroughs, and high-yield exam preparation tactics.
          </p>

          {/* Search Box */}
          <div className="ss-edu-search-box" style={{ margin: '0 auto 28px', maxWidth: '560px' }}>
            <Search className="ss-edu-search-icon" size={20} />
            <input
              type="text"
              placeholder="Search guides, strategies, or research..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="ss-edu-search-input"
            />
          </div>

          {/* Category Filter Tabs */}
          <div className="ss-filter-tabs-row">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`ss-filter-tab ${selectedCategory === cat ? 'active' : ''}`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Featured Article Banner */}
      {selectedCategory === 'All Articles' && !searchQuery && (
        <section className="ss-blog-featured-section">
          <div className="ss-edu-container">
            <div className="ss-featured-post-card">
              <div className="ss-featured-post-badge">
                <Sparkles size={13} />
                <span>Featured Guide</span>
              </div>
              <div className="ss-featured-post-meta">
                <span>{featuredPost.category}</span>
                <span className="ss-dot-sep">•</span>
                <span>{featuredPost.readTime}</span>
                <span className="ss-dot-sep">•</span>
                <span>{featuredPost.date}</span>
              </div>
              <h2 className="ss-featured-post-title">{featuredPost.title}</h2>
              <p className="ss-featured-post-desc">{featuredPost.snippet}</p>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '20px', flexWrap: 'wrap', gap: '12px' }}>
                <span style={{ fontSize: '0.875rem', color: '#64748B', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <User size={15} color="#4F46E5" /> {featuredPost.author}
                </span>
                <Link to="/register" className="ss-landing-btn-cta">
                  <span>Read Full Article</span>
                  <ArrowRight size={14} />
                </Link>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Articles Grid */}
      <section className="ss-blog-grid-section">
        <div className="ss-edu-container">
          <div className="ss-blog-grid">
            {filteredPosts.map((post) => (
              <article key={post.id} className="ss-blog-card">
                <div>
                  <div className="ss-blog-card-top">
                    <span className="ss-blog-category-badge">{post.category}</span>
                    <span className="ss-blog-read-time">
                      <Clock size={12} />
                      {post.readTime}
                    </span>
                  </div>

                  <h3 className="ss-blog-card-title">{post.title}</h3>
                  <p className="ss-blog-card-desc">{post.snippet}</p>
                </div>

                <div className="ss-blog-card-footer">
                  <span className="ss-blog-author">{post.author}</span>
                  <Link to="/register" className="ss-blog-read-link">
                    <span>Read</span>
                    <ArrowRight size={13} />
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Newsletter Signup */}
      <section className="ss-edu-container ss-edu-cta-section">
        <div className="ss-edu-cta-card">
          <div style={{ position: 'relative', zIndex: 2, maxWidth: '640px', margin: '0 auto' }}>
            <h2 style={{ fontSize: '2.4rem', fontWeight: 800, margin: '0 0 16px', letterSpacing: '-0.02em' }}>
              Get Weekly High-Yield Study Frameworks
            </h2>
            <p style={{ fontSize: '1.1rem', opacity: 0.9, lineHeight: 1.6, margin: '0 0 32px' }}>
              Subscribe to the StudySync Academic Dispatch. Zero spam, just cognitive learning tips and new AI features.
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
                <span>Subscribe Free With Student Account</span>
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
