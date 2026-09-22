import { useState } from 'react';
import { HelpCircle, CheckCircle2, XCircle, RotateCcw } from 'lucide-react';
import InlineMathText from '../InlineMathText';

export interface QuizQuestion {
  question: string;
  options: string[];
  correctAnswerIndex: number;
  explanation: string;
}

export interface QuizWidgetProps {
  data: {
    title: string;
    questions: QuizQuestion[];
  };
}

export default function QuizWidget({ data }: QuizWidgetProps) {
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, number>>({});
  const [showExplanations, setShowExplanations] = useState<Record<number, boolean>>({});

  const handleSelect = (questionIdx: number, optionIdx: number) => {
    if (selectedAnswers[questionIdx] !== undefined) return; // locked once answered
    setSelectedAnswers((prev) => ({ ...prev, [questionIdx]: optionIdx }));
    setShowExplanations((prev) => ({ ...prev, [questionIdx]: true }));
  };

  const handleReset = () => {
    setSelectedAnswers({});
    setShowExplanations({});
  };

  const totalQuestions = data.questions?.length || 0;
  const answeredCount = Object.keys(selectedAnswers).length;
  const correctCount = Object.entries(selectedAnswers).filter(
    ([qIdx, optIdx]) => data.questions[Number(qIdx)]?.correctAnswerIndex === optIdx
  ).length;

  return (
    <div
      style={{
        background: '#FFFFFF',
        border: '1px solid #E5E7EB',
        borderRadius: '16px',
        padding: '20px',
        margin: '16px 0',
        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.04)',
        display: 'flex',
        flexDirection: 'column',
        gap: '18px',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #F3F4F6', paddingBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: '#EEF2FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <HelpCircle size={18} color="#4F46E5" />
          </div>
          <div>
            <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: '#111827' }}>{data.title || 'Interactive Practice Quiz'}</h4>
            <span style={{ fontSize: '0.78rem', color: '#6B7280' }}>
              {answeredCount}/{totalQuestions} Answered {answeredCount > 0 && `• ${correctCount} Correct`}
            </span>
          </div>
        </div>

        {answeredCount > 0 && (
          <button
            type="button"
            onClick={handleReset}
            style={{
              background: '#F9FAFB',
              border: '1px solid #E5E7EB',
              borderRadius: '8px',
              padding: '5px 10px',
              fontSize: '0.76rem',
              color: '#4B5563',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <RotateCcw size={12} />
            <span>Reset</span>
          </button>
        )}
      </div>

      {/* Questions list */}
      {data.questions?.map((q, qIdx) => {
        const userAnswer = selectedAnswers[qIdx];
        const isAnswered = userAnswer !== undefined;
        const isCorrect = userAnswer === q.correctAnswerIndex;

        return (
          <div key={qIdx} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div
              style={{
                fontSize: '0.98rem',
                fontWeight: 600,
                color: '#0F172A',
                lineHeight: 1.65,
                display: 'flex',
                alignItems: 'flex-start',
                gap: 10,
              }}
            >
              <span
                style={{
                  background: '#EEF2FF',
                  color: '#4F46E5',
                  padding: '2px 8px',
                  borderRadius: 6,
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  flexShrink: 0,
                  marginTop: 3,
                }}
              >
                Q{qIdx + 1}
              </span>
              <div style={{ flex: 1, wordBreak: 'break-word' }}>
                <InlineMathText content={q.question} />
              </div>
            </div>

            <div style={{ display: 'grid', gap: 9 }}>
              {q.options?.map((opt, optIdx) => {
                const isSelected = userAnswer === optIdx;
                const isThisOptionCorrect = q.correctAnswerIndex === optIdx;

                let bg = '#FFFFFF';
                let border = '1px solid #E2E8F0';
                let textColor = '#1E293B';
                let badgeBg = '#F1F5F9';
                let badgeColor = '#475569';
                let badgeBorder = '#CBD5E1';

                if (isAnswered) {
                  if (isThisOptionCorrect) {
                    bg = '#F0FDF4';
                    border = '1.5px solid #10B981';
                    textColor = '#065F46';
                    badgeBg = '#10B981';
                    badgeColor = '#FFFFFF';
                    badgeBorder = '#10B981';
                  } else if (isSelected && !isCorrect) {
                    bg = '#FEF2F2';
                    border = '1.5px solid #EF4444';
                    textColor = '#991B1B';
                    badgeBg = '#EF4444';
                    badgeColor = '#FFFFFF';
                    badgeBorder = '#EF4444';
                  } else {
                    bg = '#F8FAFC';
                    border = '1px solid #E2E8F0';
                    textColor = '#64748B';
                  }
                }

                return (
                  <button
                    key={optIdx}
                    type="button"
                    onClick={() => handleSelect(qIdx, optIdx)}
                    disabled={isAnswered}
                    style={{
                      background: bg,
                      border,
                      borderRadius: '12px',
                      padding: '12px 16px',
                      fontSize: '0.92rem',
                      lineHeight: 1.55,
                      color: textColor,
                      textAlign: 'left',
                      cursor: isAnswered ? 'default' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      transition: 'all 0.15s ease',
                      boxShadow: isSelected ? '0 2px 6px rgba(0,0,0,0.04)' : 'none',
                    }}
                  >
                    <span
                      style={{
                        width: 26,
                        height: 26,
                        borderRadius: '50%',
                        background: badgeBg,
                        color: badgeColor,
                        border: `1px solid ${badgeBorder}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '0.78rem',
                        fontWeight: 700,
                        flexShrink: 0,
                        transition: 'all 0.15s ease',
                      }}
                    >
                      {String.fromCharCode(65 + optIdx)}
                    </span>
                    <span style={{ flex: 1, wordBreak: 'break-word' }}>
                      <InlineMathText content={opt} />
                    </span>
                    {isAnswered && isThisOptionCorrect && <CheckCircle2 size={18} color="#10B981" style={{ flexShrink: 0 }} />}
                    {isAnswered && isSelected && !isCorrect && <XCircle size={18} color="#EF4444" style={{ flexShrink: 0 }} />}
                  </button>
                );
              })}
            </div>

            {/* Explanation box */}
            {showExplanations[qIdx] && q.explanation && (
              <div
                style={{
                  background: isCorrect ? '#F0FDF4' : '#FFFBEB',
                  border: `1px solid ${isCorrect ? '#86EFAC' : '#FCD34D'}`,
                  borderRadius: '12px',
                  padding: '12px 16px',
                  fontSize: '0.88rem',
                  color: isCorrect ? '#14532D' : '#78350F',
                  lineHeight: 1.6,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, marginBottom: 4, fontSize: '0.86rem' }}>
                  <span>{isCorrect ? '✅ Well done!' : '💡 Explanation:'}</span>
                </div>
                <div style={{ wordBreak: 'break-word' }}>
                  <InlineMathText content={q.explanation} />
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
