import { useState, useEffect, useMemo } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface SourceItem {
  text: string;
  score: number;
  filename?: string;
}

interface ThinkingBlockProps {
  thought?: string;
  durationSeconds?: number;
  toolCalls?: Array<{ name: string; args: any; result: any }>;
  sources?: SourceItem[];
  defaultExpanded?: boolean;
}

interface SequentialStep {
  number: number;
  title: string;
  body: string;
  tools?: string[];
}

function cleanStepBody(rawBody: string): string {
  if (!rawBody) return '';
  let b = rawBody.trim();

  // Only strip metadata-style labels at the very start of body text (before any real content)
  // These are structured labels like "- **Role:** ...", "- **Dependencies:** ..." that appear
  // as leading metadata in thinking node output — NOT regular content
  const metadataLabels = ['Role', 'Task', 'Purpose', 'Goal', 'Dependencies', 'Dependency',
    'DependsOn', 'Depends on', 'Tools', 'Capabilities', 'Input', 'Output'];
  const metaPattern = new RegExp(
    `^(?:[-*•]\\s+)?(?:\\*\\*)?(?:${metadataLabels.join('|')})(?:\\*\\*)?:\\s*[^\\n]*\\n?`, 'gim'
  );
  b = b.replace(metaPattern, '');

  // Trim leading/trailing whitespace but preserve internal structure (bullets, paragraphs)
  return b.trim();
}

function cleanStepTitle(rawTitle: string): { title: string; extraBody?: string } {
  if (!rawTitle) return { title: '' };
  let t = rawTitle
    .replace(/^Node\s+\d+[:\.]?\s*/i, '')
    .replace(/^\d+[\.\)]\s*/, '')
    .replace(/^\*\*|\*\*$/g, '')
    .replace(/^(?:Phase|Step)\s+\d+[:\.]?\s*/i, '')
    .trim();

  // If title has a colon separating a short title and a descriptive sentence
  // e.g. "Analyze the Request: - User wants a flowchart..."
  // e.g. "Scope & Modeling: Deconstructed functional boundaries..."
  const colonIdx = t.indexOf(':');
  if (colonIdx > 2 && colonIdx < 50) {
    const mainTitle = t.slice(0, colonIdx).replace(/^\*\*|\*\*$/g, '').trim();
    const rest = t.slice(colonIdx + 1).replace(/^[\s\-•*]+/, '').trim();
    return { title: mainTitle, extraBody: rest || undefined };
  }

  return { title: t };
}

function parseSequentialSteps(
  rawThought?: string,
  toolCalls?: Array<{ name: string; args: any; result: any }>
): SequentialStep[] {
  const toolsList = (toolCalls || []).map((t) => t.name);

  // If no thought and no tools, do NOT show fake static fallback
  if (!rawThought || !rawThought.trim()) {
    if (toolCalls && toolCalls.length > 0) {
      return toolCalls.map((tc, idx) => ({
        number: idx + 1,
        title: `Executed ${tc.name.replace(/_/g, ' ')}`,
        body: tc.args ? `Parameters: ${JSON.stringify(tc.args)}` : 'Completed tool execution.',
        tools: [tc.name],
      }));
    }
    return [];
  }

  // Clean raw tags or json blocks if any
  const text = rawThought
    .replace(/\[NODE_GRAPH\][\s\S]*?\[\/NODE_GRAPH\]/gi, '')
    .replace(/<\/?(?:thought|think|thinking)[^>]*>/gi, '')
    .trim();

  // 1. Try matching markdown headings: "### Node 1: ...", "### 1. ...", "### ..."
  const headerRegex = /(?:^|\n)###?\s+(?:Node\s+)?(\d+[\.\:]?\s+)?([^\n]+)/gi;
  const matches: Array<{ fullMatch: string; title: string; index: number }> = [];

  let m: RegExpExecArray | null;
  while ((m = headerRegex.exec(text)) !== null) {
    matches.push({
      fullMatch: m[0],
      title: m[2].trim(),
      index: m.index,
    });
  }

  if (matches.length >= 2) {
    return matches.map((cur, idx) => {
      const startIndex = cur.index + cur.fullMatch.length;
      const endIndex = idx < matches.length - 1 ? matches[idx + 1].index : text.length;
      const rawBody = text.slice(startIndex, endIndex);
      const { title, extraBody } = cleanStepTitle(cur.title);
      let combinedBody = cleanStepBody(rawBody);
      if (extraBody) {
        combinedBody = combinedBody ? `${extraBody}\n${combinedBody}` : extraBody;
      }

      return {
        number: idx + 1,
        title: title || `Phase ${idx + 1}`,
        body: combinedBody || 'Executed reasoning step.',
      };
    });
  }

  // 2. Try splitting by numbered items: "1. Title: Body" or "1. Title"
  // Normalize by checking matches of numbered steps at line starts
  const numberedChunks = text.split(/(?:^|\n)(?=\d+[\.\)]\s+)/).filter((c) => c.trim().length > 0);
  if (numberedChunks.length >= 2) {
    return numberedChunks.map((chunk, idx) => {
      const cleanChunk = chunk.replace(/^\d+[\.\)]\s+/, '').trim();
      const firstLineEnd = cleanChunk.indexOf('\n');
      let rawTitle = '';
      let rawBody = '';

      if (firstLineEnd !== -1) {
        rawTitle = cleanChunk.slice(0, firstLineEnd);
        rawBody = cleanChunk.slice(firstLineEnd).trim();
      } else {
        const colonIdx = cleanChunk.indexOf(':');
        if (colonIdx !== -1 && colonIdx < 60) {
          rawTitle = cleanChunk.slice(0, colonIdx);
          rawBody = cleanChunk.slice(colonIdx + 1).trim();
        } else {
          rawTitle = `Step ${idx + 1}`;
          rawBody = cleanChunk;
        }
      }

      const { title, extraBody } = cleanStepTitle(rawTitle);
      let combinedBody = cleanStepBody(rawBody);
      if (extraBody) {
        combinedBody = combinedBody ? `${extraBody}\n${combinedBody}` : extraBody;
      }

      return {
        number: idx + 1,
        title: title || `Step ${idx + 1}`,
        body: combinedBody || cleanChunk,
      };
    });
  }

  // 3. Try splitting by bullet points: "- **Title**: Body" or "- Title"
  const bulletLines = text.split(/(?:^|\n)(?=[-*\u2022]\s+)/).filter((c) => c.trim().length > 0);
  if (bulletLines.length >= 2) {
    return bulletLines.map((chunk, idx) => {
      const cleanChunk = chunk.replace(/^[-*\u2022]\s+/, '').trim();
      const firstLineEnd = cleanChunk.indexOf('\n');
      let rawTitle = '';
      let rawBody = '';

      const colonIdx = cleanChunk.indexOf(':');
      if (colonIdx !== -1 && colonIdx < 60) {
        rawTitle = cleanChunk.slice(0, colonIdx);
        rawBody = cleanChunk.slice(colonIdx + 1).trim();
      } else if (firstLineEnd !== -1 && firstLineEnd < 60) {
        rawTitle = cleanChunk.slice(0, firstLineEnd);
        rawBody = cleanChunk.slice(firstLineEnd).trim();
      } else {
        rawTitle = `Step ${idx + 1}`;
        rawBody = cleanChunk;
      }

      const { title, extraBody } = cleanStepTitle(rawTitle);
      let combinedBody = cleanStepBody(rawBody);
      if (extraBody) {
        combinedBody = combinedBody ? `${extraBody}\n${combinedBody}` : extraBody;
      }

      return {
        number: idx + 1,
        title: title || `Step ${idx + 1}`,
        body: combinedBody || cleanChunk,
      };
    });
  }

  // 4. Fallback: Split by double line breaks (paragraphs)
  const paragraphs = text.split(/\n\n+/).filter((p) => p.trim().length > 0);
  if (paragraphs.length >= 2) {
    return paragraphs.map((p, idx) => {
      const trimmed = p.trim();
      const firstPeriod = trimmed.indexOf('.');
      let rawTitle = `Phase ${idx + 1}`;
      let rawBody = trimmed;

      if (firstPeriod !== -1 && firstPeriod < 70) {
        rawTitle = trimmed.slice(0, firstPeriod);
        rawBody = trimmed.slice(firstPeriod + 1).trim() || trimmed;
      }

      const { title, extraBody } = cleanStepTitle(rawTitle);
      let combinedBody = cleanStepBody(rawBody);
      if (extraBody) {
        combinedBody = combinedBody ? `${extraBody}\n${combinedBody}` : extraBody;
      }

      return {
        number: idx + 1,
        title: title || `Step ${idx + 1}`,
        body: combinedBody || trimmed,
      };
    });
  }

  // 5. Single step fallback
  const { title } = cleanStepTitle(text.slice(0, 60));
  let finalBody = cleanStepBody(text);
  return [
    {
      number: 1,
      title: title || 'Sequential Reasoning',
      body: finalBody || text,
      tools: toolsList.length > 0 ? toolsList : undefined,
    },
  ];
}

function renderFormattedThoughtText(text: string) {
  if (!text) return null;
  const lines = text.split('\n');

  return lines.map((line, lIdx) => {
    const trimmed = line.trim();
    if (!trimmed) return <div key={lIdx} style={{ height: 4 }} />;

    const isBullet = /^[-*•]\s+/.test(trimmed);
    const content = trimmed.replace(/^[-*•]\s+/, '');

    // Parse **bold** parts
    const parts = content.split(/(\*\*[^*]+\*\*)/g);

    return (
      <div
        key={lIdx}
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: isBullet ? 6 : 0,
          marginBottom: 3,
          lineHeight: 1.5,
        }}
      >
        {isBullet && (
          <span style={{ color: '#94A3B8', fontSize: '0.72rem', marginTop: 2, flexShrink: 0 }}>•</span>
        )}
        <span>
          {parts.map((part, pIdx) => {
            if (part.startsWith('**') && part.endsWith('**')) {
              return (
                <strong key={pIdx} style={{ fontWeight: 600, color: '#334155' }}>
                  {part.slice(2, -2)}
                </strong>
              );
            }
            return part;
          })}
        </span>
      </div>
    );
  });
}

export function AnimatedThinkingBook({
  isOpen = false,
  isLive = false,
  size = 15,
  color = 'currentColor',
  className = '',
}: {
  isOpen?: boolean;
  isLive?: boolean;
  size?: number;
  color?: string;
  className?: string;
}) {
  const stateClass = isLive ? 'is-live' : isOpen ? 'is-open' : 'is-closed';

  return (
    <span
      className={`thinking-book-anim ${stateClass} ${className}`}
      style={{ width: size, height: size, color }}
      title={isLive ? 'Thinking in progress...' : isOpen ? 'Thinking process expanded' : 'Thinking process collapsed'}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {/* Left Page (Classic authentic curved page) */}
        <path
          className="book-page-left"
          d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"
          fill="currentColor"
          fillOpacity={isOpen || isLive ? '0.18' : '0.08'}
        />

        {/* Right Page */}
        <path
          className="book-page-right"
          d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"
          fill="currentColor"
          fillOpacity={isOpen || isLive ? '0.18' : '0.08'}
        />

        {/* Subtle Text Lines inside left page */}
        <path
          className="book-text-left"
          d="M5 8h4 M5 12h3"
          strokeWidth="1.2"
          strokeOpacity="0.4"
          fill="none"
        />

        {/* Subtle Text Lines inside right page */}
        <path
          className="book-text-right"
          d="M15 8h4 M16 12h3"
          strokeWidth="1.2"
          strokeOpacity="0.4"
          fill="none"
        />

        {/* Flipping Leaf for Live Thinking */}
        {isLive && (
          <path
            className="book-leaf"
            d="M12 7c2-2.5 5.5-3 8.5-3v14c-3 0-6.5.5-8.5 2.5z"
            fill="currentColor"
            fillOpacity="0.32"
            strokeWidth="1.6"
          />
        )}

        {/* Ribbon Bookmark for Static Thinking Block */}
        {!isLive && (
          <path
            className="book-ribbon"
            d="M12 4v8l1.5-1.2 1.5 1.2V4"
            fill="currentColor"
            fillOpacity="0.45"
            strokeWidth="1.1"
          />
        )}
      </svg>
    </span>
  );
}

export default function ThinkingBlock({
  thought,
  durationSeconds = 3,
  toolCalls,
  sources: _sources,
  defaultExpanded = false,
}: ThinkingBlockProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  const steps = useMemo(() => {
    return parseSequentialSteps(thought, toolCalls);
  }, [thought, toolCalls]);

  // If no real steps, do not render anything
  if (steps.length === 0) return null;

  const displaySeconds = durationSeconds > 0 ? durationSeconds : 3;

  return (
    <div className="thinking-simple-container">
      {/* ChatGPT / Claude style toggle: "Thought for 3 seconds ▼" with Animated Book */}
      <button
        type="button"
        className="thinking-simple-toggle"
        onClick={() => setIsExpanded(!isExpanded)}
        aria-expanded={isExpanded}
      >
        <AnimatedThinkingBook isOpen={isExpanded} size={15} color="#64748B" />
        <span className="thinking-simple-label">
          Thought for {displaySeconds} {displaySeconds === 1 ? 'second' : 'seconds'}
        </span>
        <div className="thinking-simple-chevron">
          {isExpanded ? <ChevronUp size={12} color="#94A3B8" /> : <ChevronDown size={12} color="#94A3B8" />}
        </div>
      </button>

      {/* Expanded Sequential Reasoning Steps in Order */}
      {isExpanded && (
        <div className="thought-seq-timeline">
          {steps.map((step, idx) => {
            const isLast = idx === steps.length - 1;

            return (
              <div key={step.number} className="thought-seq-item">
                <div className="thought-seq-track">
                  <span className="thought-seq-num">{step.number}</span>
                  {!isLast && <div className="thought-seq-line" />}
                </div>

                <div className="thought-seq-body">
                  <div className="thought-seq-title">{step.title}</div>
                  <div className="thought-seq-text">{renderFormattedThoughtText(step.body)}</div>

                  {step.tools && step.tools.length > 0 && (
                    <div className="thought-seq-tools">
                      <span className="thought-seq-tools-label">Tools used:</span>{' '}
                      {step.tools.join(', ')}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/**
 * Live Thinking Indicator (During Generation) with Open/Close Animated Book
 */
export function LiveThinkingIndicator({ courseColor = '#6366F1' }: { courseColor?: string }) {
  const [seconds, setSeconds] = useState(0.5);

  useEffect(() => {
    const timer = setInterval(() => {
      setSeconds((prev) => +(prev + 0.5).toFixed(1));
    }, 500);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="thinking-simple-live">
      <AnimatedThinkingBook isLive={true} size={16} color={courseColor} />
      <span className="thinking-simple-live-label">Thinking...</span>
      <span className="thinking-simple-live-timer">({seconds.toFixed(1)}s)</span>
    </div>
  );
}
