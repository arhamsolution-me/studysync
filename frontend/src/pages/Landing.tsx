import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import PublicHeader from '../components/PublicHeader';
import PublicFooter from '../components/PublicFooter';
import {
  Sparkles,
  Search,
  Bot,
  GraduationCap,
  BookOpen,
  Cpu,
  Code2,
  Atom,
  ShieldCheck,
  Zap,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

export default function Landing() {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSlide, setActiveSlide] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const navigate = useNavigate();

  const robotSlides = [
    {
      src: '/hero-ai-study-robot.jpg',
      alt: 'Autonomous AI Student Robot studying with holographic lecture slides',
      title: 'Autonomous AI Student Robot',
      specialty: 'Holographic Slide RAG & Instant Lecture Notes',
      icon: BookOpen,
    },
    {
      src: '/hero-ai-robots-collaborating.jpg',
      alt: 'Collaborative AI robots reasoning together over complex academic coursework',
      title: 'Multi-Robot Reasoning Team',
      specialty: 'Quantum Algorithms & Semester Collaboration',
      icon: Bot,
    },
    {
      src: '/hero-ai-robot-coding.jpg',
      alt: 'Cute AI Robot student coding with glowing holographic terminals',
      title: 'Autonomous Coding Copilot',
      specialty: 'Terminal Debugging & Deep Code Synthesis',
      icon: Code2,
    },
    {
      src: '/hero-ai-robot-graduate.jpg',
      alt: 'Autonomous AI Robot wearing graduation cap with open lecture book',
      title: 'Autonomous Exam Solver',
      specialty: 'GPA Booster & Course-Scoped Deadlines',
      icon: GraduationCap,
    },
    {
      src: '/hero-ai-robot-library.jpg',
      alt: 'Spherical AI companion robot reading in futuristic university library',
      title: 'Campus Library Navigator',
      specialty: '24/7 Research Companion & Syllabus Discovery',
      icon: Cpu,
    },
    {
      src: '/hero-ai-robot-tablet.jpg',
      alt: 'Autonomous AI robot taking digital notes with stylus in campus study lounge',
      title: 'Natural Roman Urdu NLP',
      specialty: 'WhatsApp Alerts & Calendar Autonomous Scheduling',
      icon: Atom,
    },
  ];

  // Auto-advance slides every 4.5 seconds ("ik ky bad ik ati jay")
  useEffect(() => {
    if (isPaused) return;
    const interval = setInterval(() => {
      setActiveSlide((prev) => (prev + 1) % robotSlides.length);
    }, 4500);

    return () => clearInterval(interval);
  }, [isPaused, robotSlides.length]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/register?topic=${encodeURIComponent(searchQuery.trim())}`);
    } else {
      navigate('/register');
    }
  };

  const handlePrevSlide = () => {
    setActiveSlide((prev) => (prev - 1 + robotSlides.length) % robotSlides.length);
  };

  const handleNextSlide = () => {
    setActiveSlide((prev) => (prev + 1) % robotSlides.length);
  };

  const popularTopics = [
    'Machine Learning',
    'Data Structures',
    'Calculus',
    'Database Systems',
    'Software Architecture',
  ];

  const currentRobot = robotSlides[activeSlide];
  const CurrentIcon = currentRobot.icon;

  return (
    <div
      className="ss-landing-page"
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        position: 'relative',
      }}
    >
      {/* ─── Fixed Top Navbar (Shared PublicHeader) ───────────────────── */}
      <PublicHeader />

      {/* ─── Hero Section with Animated Background Robot Slider ───────── */}
      <section
        id="hero"
        className="ss-hero-bg-slider-section"
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
      >
        {/* Full Background Educational Robot Slides ("wo ik ky bad ik ati jay") */}
        <div className="ss-hero-bg-slides-track">
          {robotSlides.map((slide, index) => (
            <div
              key={slide.src}
              className={`ss-hero-bg-slide-item ${index === activeSlide ? 'active' : ''}`}
            >
              <img
                src={slide.src}
                alt={slide.alt}
                className="ss-hero-bg-slide-img"
              />
            </div>
          ))}
        </div>

        {/* High-Contrast Gradient Glass Overlay */}
        <div className="ss-hero-bg-overlay" />

        {/* Hero Foreground Content */}
        <div className="ss-hero-slider-content">
          <div className="ss-hero-slider-tag">
            <Sparkles size={14} color="#A5B4FC" />
            <span>Best Autonomous Academic Platform</span>
          </div>

          <h1 className="ss-hero-slider-title">
            Best Learning <br />
            <span className="ss-hero-slider-gradient">Academic Platform</span> <br />
            in The World
          </h1>

          {/* Search Capsule Input */}
          <form onSubmit={handleSearch} className="ss-hero-slider-search">
            <Search className="ss-edu-search-icon" size={20} />
            <input
              type="text"
              placeholder="What do you want to learn today?"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="ss-edu-search-input"
            />
            <button type="submit" className="ss-edu-search-btn">
              <span>Ask Copilot</span>
            </button>
          </form>

          {/* Popular Topic Pills */}
          <div className="ss-hero-slider-pills">
            <span style={{ fontSize: '0.8125rem', color: '#CBD5E1', fontWeight: 500 }}>
              Popular:
            </span>
            {popularTopics.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => {
                  setSearchQuery(item);
                  navigate(`/register?topic=${encodeURIComponent(item)}`);
                }}
                className="ss-hero-slider-pill"
              >
                {item}
              </button>
            ))}
          </div>

          {/* Autonomous Trust Highlights */}
          <div
            style={{
              display: 'flex',
              gap: '20px',
              alignItems: 'center',
              marginTop: '36px',
              flexWrap: 'wrap',
              fontSize: '0.8125rem',
              color: '#CBD5E1',
              fontWeight: 500,
            }}
          >
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              <Bot size={16} color="#A5B4FC" />
              <span>Multi-Robot AI Tutoring</span>
            </div>
            <span style={{ color: '#64748B' }}>•</span>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              <Zap size={16} color="#FBBF24" />
              <span>Instant Slide-to-Notes RAG</span>
            </div>
            <span style={{ color: '#64748B' }}>•</span>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              <ShieldCheck size={16} color="#34D399" />
              <span>100% Multi-Tenant Isolation</span>
            </div>
          </div>
        </div>

        {/* ─── Bottom Slide Control Bar (Indicators + Active Robot Tag) ─── */}
        <div className="ss-hero-slider-bottom-bar">
          {/* Active Robot Info Pill */}
          <div className="ss-hero-active-robot-pill">
            <CurrentIcon size={16} color="#A5B4FC" />
            <span style={{ fontWeight: 600 }}>{currentRobot.title}</span>
            <span style={{ color: '#64748B' }}>|</span>
            <span style={{ color: '#CBD5E1', fontSize: '0.78rem' }}>{currentRobot.specialty}</span>
          </div>

          {/* Dots and Navigation Arrows */}
          <div className="ss-hero-slider-controls">
            <button
              type="button"
              onClick={handlePrevSlide}
              aria-label="Previous robot background image"
              className="ss-hero-nav-arrow"
            >
              <ChevronLeft size={16} />
            </button>

            {robotSlides.map((_, idx) => (
              <button
                key={`dot-${idx}`}
                type="button"
                onClick={() => setActiveSlide(idx)}
                aria-label={`Jump to background slide ${idx + 1}`}
                className={`ss-hero-dot-btn ${idx === activeSlide ? 'active' : ''}`}
              />
            ))}

            <button
              type="button"
              onClick={handleNextSlide}
              aria-label="Next robot background image"
              className="ss-hero-nav-arrow"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </section>

      {/* ─── Footer (Shared PublicFooter) ───────────────────────────── */}
      <PublicFooter />
    </div>
  );
}
