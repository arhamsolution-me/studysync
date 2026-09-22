import { useState, useEffect } from 'react';
import {
  ExternalLink,
  Maximize2,
  Clock,
  CheckCircle2,
  XCircle,
  RotateCcw,
  FileText,
} from 'lucide-react';

export interface VideoChapter {
  time: string;
  seconds: number;
  label: string;
}

export interface VideoPlayerWidgetProps {
  data: {
    videoId: string;
    videoTitle: string;
    author?: string;
    url?: string;
    description?: string;
    chapters?: VideoChapter[];
  };
}

export default function VideoPlayerWidget({ data }: VideoPlayerWidgetProps) {
  const [activeSeconds, setActiveSeconds] = useState<number>(0);
  const [activeChapterIdx, setActiveChapterIdx] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isMovedToSidePanel, setIsMovedToSidePanel] = useState<boolean>(false);
  const [showQuiz, setShowQuiz] = useState<boolean>(false);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, number>>({});

  useEffect(() => {
    const handleArtifactClosed = () => {
      setIsMovedToSidePanel(false);
    };
    window.addEventListener('studysync:artifact-closed', handleArtifactClosed);
    return () => window.removeEventListener('studysync:artifact-closed', handleArtifactClosed);
  }, []);

  const videoId = data.videoId || 'xsg9BDiwiJE';
  const videoTitle = data.videoTitle || 'Educational Video';
  const author = data.author || 'YouTube Educator';
  const chapters = data.chapters || [];

  // Fallback conceptual quiz questions for ERD / database videos if not custom provided
  const videoQuiz = [
    {
      question: 'In an Entity Relationship Diagram (ERD), what does an "Entity" represent?',
      options: [
        'A property or column of a table',
        'A real-world object or concept that stores data (e.g., Customer, Order)',
        'The mathematical relationship between tables',
        'A database query command like SELECT',
      ],
      correctAnswerIndex: 1,
      explanation: 'Entities are objects or concepts that are associated with important data—like a customer, order, or product.',
    },
    {
      question: 'What is the role of "Cardinality" in database design?',
      options: [
        'It calculates the total storage size of rows in megabytes',
        'It encrypts sensitive foreign keys in database tables',
        'It specifies the numerical minimum and maximum relationships between entities (e.g., 1-to-many)',
        'It indexes tables for faster querying',
      ],
      correctAnswerIndex: 2,
      explanation: 'Cardinality defines the numerical limits and relationships (such as one-to-one, one-to-many, or many-to-many) between entities.',
    },
    {
      question: 'How do "Attributes" relate to "Entities"?',
      options: [
        'Attributes represent traits or characteristics of an entity (e.g., Customer Phone Number)',
        'Attributes are separate standalone databases',
        'Attributes connect two completely unrelated databases together',
        'Attributes execute SQL transactions automatically',
      ],
      correctAnswerIndex: 0,
      explanation: 'Attributes represent properties or traits of an entity, such as a customer’s phone number, email, or home address.',
    },
  ];

  const chapterInsights: Record<string, string> = {
    '0:00': 'ERD ka maqsad aur visual relational data modeling ki zaroorat.',
    '0:41': 'Database ki basic definition aur structured tables me data kaise store hota hai.',
    '1:25': 'Entities (real-world objects) aur attributes (properties) ki mukammal wazahat.',
    '2:24': 'Mukhtalif tables ke darmian connections aur primary/foreign keys ka role.',
    '2:44': 'Cardinality rules: One-to-One, One-to-Many aur Many-to-Many ki limits.',
    '3:15': 'Customer aur Order ki practical case study aur ER diagram design karna.',
    '4:35': 'Order aur Product ki complex Many-to-Many relationship ko handle karna.',
    '5:34': 'Visual ERD diagram ko direct SQL code aur database schema me export karna.',
  };

  const handleSeek = (seconds: number, idx: number) => {
    setIsMovedToSidePanel(false);
    setIsPlaying(true);
    setActiveSeconds(seconds);
    setActiveChapterIdx(idx);
  };

  const handleOpenInSidePanel = () => {
    setIsMovedToSidePanel(true);
    setIsPlaying(false);
    window.dispatchEvent(
      new CustomEvent('studysync:open-artifact', {
        detail: {
          id: `video-${videoId}`,
          title: videoTitle,
          language: 'video',
          type: 'video',
          content: JSON.stringify({
            videoId,
            videoTitle,
            author,
            chapters,
            activeSeconds,
          }),
        },
      })
    );
  };

  const handleSelectQuizAnswer = (qIdx: number, optIdx: number) => {
    if (selectedAnswers[qIdx] !== undefined) return;
    setSelectedAnswers((prev) => ({ ...prev, [qIdx]: optIdx }));
  };

  const handleResetQuiz = () => {
    setSelectedAnswers({});
  };

  const answeredCount = Object.keys(selectedAnswers).length;
  const correctCount = Object.entries(selectedAnswers).filter(
    ([qIdx, optIdx]) => videoQuiz[Number(qIdx)]?.correctAnswerIndex === optIdx
  ).length;

  return (
    <div
      style={{
        background: '#FFFFFF',
        border: '1px solid #E2E8F0',
        borderRadius: '16px',
        padding: '18px 20px',
        margin: '16px 0',
        boxShadow: '0 4px 16px rgba(15, 23, 42, 0.04)',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        maxWidth: '100%',
      }}
    >
      {/* ─── Header: Video Info & Actions ─── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, borderBottom: '1px solid #F1F5F9', paddingBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: 8,
              background: '#FEE2E2',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#DC2626',
              flexShrink: 0,
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
            </svg>
          </div>
          <div style={{ minWidth: 0 }}>
            <h4
              style={{
                margin: 0,
                fontSize: '0.96rem',
                fontWeight: 600,
                color: '#0F172A',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
              title={videoTitle}
            >
              {videoTitle}
            </h4>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.78rem', color: '#64748B', marginTop: 2 }}>
              <span>{author}</span>
              {chapters.length > 0 && <span>• {chapters.length} Interactive Chapters</span>}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            type="button"
            onClick={handleOpenInSidePanel}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              padding: '6px 11px',
              borderRadius: 7,
              background: '#EEF2FF',
              border: '1px solid #C7D2FE',
              color: '#4338CA',
              fontSize: '0.76rem',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
            title="Open interactive video & timestamps in side window"
          >
            <Maximize2 size={13} />
            <span>Watch in Side Panel ↗</span>
          </button>

          <a
            href={data.url || `https://www.youtube.com/watch?v=${videoId}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              padding: '6px 10px',
              borderRadius: 7,
              background: '#F8FAFC',
              border: '1px solid #E2E8F0',
              color: '#64748B',
              fontSize: '0.76rem',
              textDecoration: 'none',
              fontWeight: 500,
              cursor: 'pointer',
            }}
            title="Open on YouTube"
          >
            <ExternalLink size={12} />
            <span>YouTube</span>
          </a>
        </div>
      </div>

      {/* ─── Embedded YouTube Player ─── */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          paddingTop: '56.25%', // 16:9 Aspect Ratio
          borderRadius: 12,
          overflow: 'hidden',
          background: '#0F172A',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)',
        }}
      >
        {isMovedToSidePanel ? (
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              background: 'linear-gradient(135deg, #1E1B4B 0%, #0F172A 100%)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 12,
              color: '#FFFFFF',
              padding: 20,
              textAlign: 'center',
            }}
          >
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: '50%',
                background: 'rgba(99, 102, 241, 0.2)',
                border: '1px solid #818CF8',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Maximize2 size={20} color="#A5B4FC" />
            </div>
            <div>
              <div style={{ fontWeight: 600, fontSize: '0.94rem' }}>Playing in Side Panel ↗</div>
              <div style={{ fontSize: '0.78rem', color: '#94A3B8', marginTop: 3 }}>
                Video is active in the side window. Audio is focused there to avoid echo.
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setIsMovedToSidePanel(false);
                setIsPlaying(true);
              }}
              style={{
                marginTop: 4,
                padding: '6px 14px',
                borderRadius: 7,
                background: '#4F46E5',
                border: 'none',
                color: '#FFFFFF',
                fontSize: '0.78rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Watch in Main Chat
            </button>
          </div>
        ) : (
          <iframe
            key={`${videoId}-${activeSeconds}-${isPlaying}`}
            src={`https://www.youtube-nocookie.com/embed/${videoId}?start=${activeSeconds}&autoplay=${isPlaying ? 1 : 0}&rel=0`}
            title={videoTitle}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              border: 0,
            }}
          />
        )}
      </div>

      {/* ─── Interactive Clickable Chapters / Timestamps ─── */}
      {chapters.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.82rem', fontWeight: 600, color: '#334155' }}>
              <Clock size={14} color="#64748B" />
              <span>Click a Chapter to Jump & Play:</span>
            </div>
            {activeSeconds > 0 && (
              <span style={{ fontSize: '0.74rem', color: '#4F46E5', fontWeight: 600 }}>
                Playing from: {chapters[activeChapterIdx]?.time || '0:00'}
              </span>
            )}
          </div>

          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 8,
              maxHeight: 180,
              overflowY: 'auto',
              paddingRight: 4,
            }}
          >
            {chapters.map((ch, idx) => {
              const isSelected = activeChapterIdx === idx;
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSeek(ch.seconds, idx)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '6px 11px',
                    borderRadius: 8,
                    background: isSelected ? '#EEF2FF' : '#F8FAFC',
                    border: isSelected ? '1px solid #818CF8' : '1px solid #E2E8F0',
                    color: isSelected ? '#3730A3' : '#334155',
                    fontSize: '0.78rem',
                    fontWeight: isSelected ? 600 : 500,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    textAlign: 'left',
                  }}
                  title={`Jump to ${ch.time} - ${ch.label}`}
                >
                  <span
                    style={{
                      fontFamily: 'monospace',
                      fontSize: '0.74rem',
                      background: isSelected ? '#4F46E5' : '#E2E8F0',
                      color: isSelected ? '#FFFFFF' : '#475569',
                      padding: '1px 5px',
                      borderRadius: 4,
                      fontWeight: 600,
                    }}
                  >
                    {ch.time}
                  </span>
                  <span>{ch.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ─── Simple Clean Text Summary ("Video me kya kya kaha gaya hai") ─── */}
      <div
        style={{
          borderTop: '1px solid #F1F5F9',
          paddingTop: '12px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          fontSize: '0.86rem',
          color: '#334155',
          lineHeight: 1.6,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.92rem', fontWeight: 600, color: '#0F172A' }}>
          <FileText size={16} color="#4F46E5" />
          <span>Video Summary (Is video me kya kya kaha gaya hai):</span>
        </div>

        <p style={{ margin: 0 }}>
          {data.description ? (
            data.description.split('\n\n')[0]
          ) : (
            'Yeh video Entity Relationship Diagrams (ERDs) ke buniyadi concepts ko step-by-step samjhati hai taake database banane se pehle data ko visually model kiya ja sake.'
          )}
        </p>

        <div style={{ fontWeight: 600, color: '#0F172A', marginTop: 4 }}>Aham Nukat (Key Points):</div>
        <ul style={{ margin: 0, paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <li><strong>Entities:</strong> Asal duniya ke objects (Customer, Order, Product) jo data store karte hain aur database tables bante hain.</li>
          <li><strong>Attributes:</strong> Har entity ki fields aur properties (maslan Customer Name, Email, Phone Number).</li>
          <li><strong>Relationships:</strong> Tables ke darmian rishta aur link, jo Primary Keys aur Foreign Keys ke zariye banta hai.</li>
          <li><strong>Cardinality:</strong> Numerical limits (One-to-One, One-to-Many, ya Many-to-Many connections).</li>
          <li><strong>Database Export:</strong> Diagram ko relational schema aur direct SQL queries me convert karna.</li>
        </ul>

        {chapters.length > 0 && (
          <>
            <div style={{ fontWeight: 600, color: '#0F172A', marginTop: 4 }}>Timestamp ke mutabiq topics:</div>
            <ul style={{ margin: 0, paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '3px' }}>
              {chapters.map((ch, idx) => (
                <li key={idx}>
                  <button
                    type="button"
                    onClick={() => handleSeek(ch.seconds, idx)}
                    style={{
                      background: 'none',
                      border: 'none',
                      padding: 0,
                      color: '#4F46E5',
                      fontFamily: 'monospace',
                      fontWeight: 600,
                      cursor: 'pointer',
                      marginRight: 6,
                    }}
                  >
                    [{ch.time}]
                  </button>
                  <span>
                    <strong>{ch.label}</strong>
                    {chapterInsights[ch.time] ? ` — ${chapterInsights[ch.time]}` : ''}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      {/* ─── Optional Practice Quiz (Expandable) ─── */}
      <div style={{ borderTop: '1px solid #F1F5F9', paddingTop: '10px' }}>
        <button
          type="button"
          onClick={() => setShowQuiz(!showQuiz)}
          style={{
            background: 'none',
            border: 'none',
            color: '#4F46E5',
            fontSize: '0.8rem',
            fontWeight: 600,
            cursor: 'pointer',
            padding: 0,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          <span>{showQuiz ? '▾ Hide Practice Quiz' : '▸ 🎯 Test Your Knowledge (Optional Quiz)'}</span>
        </button>

        {showQuiz && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.78rem', color: '#64748B' }}>
              <span>
                Progress: {answeredCount}/{videoQuiz.length} Answered {answeredCount > 0 && `• ${correctCount} Correct`}
              </span>
              {answeredCount > 0 && (
                <button
                  type="button"
                  onClick={handleResetQuiz}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#4F46E5',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    fontSize: '0.76rem',
                    fontWeight: 500,
                  }}
                >
                  <RotateCcw size={12} />
                  <span>Reset Quiz</span>
                </button>
              )}
            </div>

            {videoQuiz.map((q, qIdx) => {
              const selectedOpt = selectedAnswers[qIdx];
              const isAnswered = selectedOpt !== undefined;

              return (
                <div
                  key={qIdx}
                  style={{
                    background: '#F8FAFC',
                    border: '1px solid #E2E8F0',
                    borderRadius: 8,
                    padding: '10px 12px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                    <span
                      style={{
                        background: '#EEF2FF',
                        color: '#4F46E5',
                        fontSize: '0.74rem',
                        fontWeight: 700,
                        padding: '1px 6px',
                        borderRadius: 4,
                        flexShrink: 0,
                      }}
                    >
                      Q{qIdx + 1}
                    </span>
                    <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#0F172A', lineHeight: 1.4 }}>
                      {q.question}
                    </span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                    {q.options.map((opt, optIdx) => {
                      const isThisSelected = selectedOpt === optIdx;
                      const isCorrect = optIdx === q.correctAnswerIndex;

                      let optBg = '#FFFFFF';
                      let optBorder = '#E2E8F0';
                      let optColor = '#334155';

                      if (isAnswered) {
                        if (isCorrect) {
                          optBg = '#ECFDF5';
                          optBorder = '#6EE7B7';
                          optColor = '#065F46';
                        } else if (isThisSelected) {
                          optBg = '#FEF2F2';
                          optBorder = '#FCA5A5';
                          optColor = '#991B1B';
                        }
                      }

                      return (
                        <button
                          key={optIdx}
                          type="button"
                          disabled={isAnswered}
                          onClick={() => handleSelectQuizAnswer(qIdx, optIdx)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '6px 10px',
                            borderRadius: 6,
                            background: optBg,
                            border: `1px solid ${optBorder}`,
                            color: optColor,
                            fontSize: '0.78rem',
                            fontWeight: isThisSelected ? 600 : 400,
                            textAlign: 'left',
                            cursor: isAnswered ? 'default' : 'pointer',
                            transition: 'all 0.15s ease',
                          }}
                        >
                          <span>{opt}</span>
                          {isAnswered && isCorrect && <CheckCircle2 size={14} color="#059669" />}
                          {isAnswered && isThisSelected && !isCorrect && <XCircle size={14} color="#DC2626" />}
                        </button>
                      );
                    })}
                  </div>

                  {isAnswered && (
                    <div
                      style={{
                        padding: '6px 8px',
                        borderRadius: 5,
                        background: selectedOpt === q.correctAnswerIndex ? '#F0FDF4' : '#FFFBEB',
                        border: `1px solid ${selectedOpt === q.correctAnswerIndex ? '#BBF7D0' : '#FDE68A'}`,
                        fontSize: '0.74rem',
                        color: selectedOpt === q.correctAnswerIndex ? '#166534' : '#92400E',
                        lineHeight: 1.4,
                      }}
                    >
                      <strong>💡 Explanation:</strong> {q.explanation}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
