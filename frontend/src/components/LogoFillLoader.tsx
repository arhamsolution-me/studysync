import React, { useEffect, useState } from 'react';

interface LogoFillLoaderProps {
  isDataReady?: boolean;
  onFinish?: () => void;
  minDurationMs?: number;
}

// Letter definitions for "StudySync AI" (y: 385 to 475)
const LETTERS = [
  { id: 'S1', x: 18,  w: 58, minP: 62, maxP: 65 },
  { id: 't',  x: 75,  w: 44, minP: 65, maxP: 68 },
  { id: 'u',  x: 120, w: 58, minP: 68, maxP: 71 },
  { id: 'd',  x: 180, w: 60, minP: 71, maxP: 74 },
  { id: 'y1', x: 241, w: 60, minP: 74, maxP: 77 },
  { id: 'S2', x: 299, w: 60, minP: 77, maxP: 80 },
  { id: 'y2', x: 357, w: 60, minP: 80, maxP: 83 },
  { id: 'n',  x: 418, w: 58, minP: 83, maxP: 86 },
  { id: 'c',  x: 480, w: 56, minP: 86, maxP: 89 },
  { id: 'A',  x: 556, w: 78, minP: 89, maxP: 92 },
  { id: 'I',  x: 634, w: 26, minP: 92, maxP: 95 },
];

export const LogoFillLoader: React.FC<LogoFillLoaderProps> = ({
  isDataReady = true,
  onFinish,
  minDurationMs = 880,
}) => {
  const [progress, setProgress] = useState(0);
  const [isDone, setIsDone] = useState(false);
  const [isFadingOut, setIsFadingOut] = useState(false);

  useEffect(() => {
    let rafId: number;
    const startTime = performance.now();
    let isTerminated = false;

    const loop = (currentTime: number) => {
      if (isTerminated) return;

      const elapsed = currentTime - startTime;
      const linearRatio = Math.min(1, elapsed / minDurationMs);

      // Smooth continuous linear progress calculation (Zero jitter, zero timer drift)
      const currentP = Math.min(100, Math.round(linearRatio * 100));
      setProgress(currentP);

      // When animation reaches 100% and data is loaded:
      // IMMEDIATELY fade into dashboard with ZERO hang/freeze!
      if (linearRatio >= 1) {
        if (isDataReady) {
          isTerminated = true;
          setIsDone(true);
          setIsFadingOut(true);
          setTimeout(() => {
            if (onFinish) onFinish();
          }, 200);
          return;
        }
      }

      rafId = requestAnimationFrame(loop);
    };

    rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId);
  }, [isDataReady, minDurationMs, onFinish]);

  // ─── 1. BOOK PAGE SEQUENTIAL FLOW (0% -> 34%) ───
  // Flows simultaneously outward & upward from center bottom spine (NO diagonal wipe)
  const bookRatio = Math.min(1, progress / 32);
  const bookOuterOffset = 720 * (1 - bookRatio);
  const bookInnerOffset = 640 * (1 - bookRatio);
  const spineOffset = 90 * (1 - bookRatio);

  // ─── 2. INFINITY CIRCUIT SEQUENTIAL FLOW (30% -> 66%) ───
  // Loops outward through left & right neural lobes from central crossover node
  const infRatio = Math.min(1, Math.max(0, (progress - 30) / 36));
  const infOffset = 460 * (1 - infRatio);
  const branchRatio = Math.min(1, Math.max(0, (progress - 46) / 20));
  const branchOffset = 80 * (1 - branchRatio);

  // ─── 3. SUBTITLE SEQUENTIAL FLOW (72% -> 95%) ───
  const subRatio = Math.min(1, Math.max(0, (progress - 72) / 23));
  const subWidth = Math.round(500 * subRatio);

  return (
    <div
      className={`logo-loader-overlay ${isFadingOut ? 'fade-out' : ''}`}
      role="status"
      aria-label="Loading StudySync AI"
    >
      <div className={`loader-seq-stage ${isDone ? 'is-complete' : ''}`}>
        <svg
          viewBox="0 0 673 540"
          className="loader-seq-svg"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            {/* Pure In-Line Sequential Mask: Zero diagonal wipe */}
            <mask id="seqLineFlowMask">
              <rect x="0" y="0" width="673" height="540" fill="black" />

              {/* ─── 1. BOOK LINES: Outward & upward from center bottom spine ─── */}
              {bookRatio > 0 && (
                <>
                  {/* Outer Left Book Page */}
                  <path
                    d="M 336 345 C 220 320, 103 315, 103 310 L 103 70 C 123 20, 243 20, 336 68"
                    fill="none"
                    stroke="white"
                    strokeWidth="46"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{
                      strokeDasharray: 720,
                      strokeDashoffset: bookOuterOffset,
                    }}
                  />

                  {/* Outer Right Book Page */}
                  <path
                    d="M 336 345 C 452 320, 570 315, 570 310 L 570 70 C 550 20, 430 20, 336 68"
                    fill="none"
                    stroke="white"
                    strokeWidth="46"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{
                      strokeDasharray: 720,
                      strokeDashoffset: bookOuterOffset,
                    }}
                  />

                  {/* Inner Left Book Page */}
                  <path
                    d="M 336 325 C 230 300, 138 290, 138 285 L 138 90 C 150 48, 240 45, 336 85"
                    fill="none"
                    stroke="white"
                    strokeWidth="38"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{
                      strokeDasharray: 640,
                      strokeDashoffset: bookInnerOffset,
                    }}
                  />

                  {/* Inner Right Book Page */}
                  <path
                    d="M 336 325 C 442 300, 534 290, 534 285 L 534 90 C 522 48, 432 45, 336 85"
                    fill="none"
                    stroke="white"
                    strokeWidth="38"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{
                      strokeDasharray: 640,
                      strokeDashoffset: bookInnerOffset,
                    }}
                  />

                  {/* Center Spine Line (bottom of book only) */}
                  <path
                    d="M 336 345 L 336 265"
                    fill="none"
                    stroke="white"
                    strokeWidth="32"
                    strokeLinecap="round"
                    style={{
                      strokeDasharray: 90,
                      strokeDashoffset: spineOffset,
                    }}
                  />
                </>
              )}

              {/* ─── 2. INFINITY RIBBON & CIRCUIT: Loops outward from center ─── */}
              {infRatio > 0 && (
                <>
                  {/* Left Neural Lobe */}
                  <path
                    d="M 336 175 C 310 95, 190 90, 168 175 C 150 250, 270 260, 336 175"
                    fill="none"
                    stroke="white"
                    strokeWidth="92"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{
                      strokeDasharray: 460,
                      strokeDashoffset: infOffset,
                    }}
                  />

                  {/* Right Neural Lobe */}
                  <path
                    d="M 336 175 C 362 95, 482 90, 504 175 C 522 250, 402 260, 336 175"
                    fill="none"
                    stroke="white"
                    strokeWidth="92"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{
                      strokeDasharray: 460,
                      strokeDashoffset: infOffset,
                    }}
                  />
                </>
              )}

              {/* Neural Circuit Branches & Nodes */}
              {branchRatio > 0 && (
                <>
                  {/* Top-Right Circuit Branch */}
                  <path
                    d="M 445 115 L 472 75 L 502 75"
                    fill="none"
                    stroke="white"
                    strokeWidth="36"
                    strokeLinecap="round"
                    style={{
                      strokeDasharray: 80,
                      strokeDashoffset: branchOffset,
                    }}
                  />
                  <circle
                    cx="502"
                    cy="75"
                    r="22"
                    fill="white"
                    style={{ opacity: branchRatio }}
                  />

                  {/* Bottom-Left Circuit Branch */}
                  <path
                    d="M 215 225 L 175 265"
                    fill="none"
                    stroke="white"
                    strokeWidth="36"
                    strokeLinecap="round"
                    style={{
                      strokeDasharray: 80,
                      strokeDashoffset: branchOffset,
                    }}
                  />
                  <circle
                    cx="175"
                    cy="265"
                    r="22"
                    fill="white"
                    style={{ opacity: branchRatio }}
                  />

                  {/* Bottom-Right Circuit Branch */}
                  <path
                    d="M 390 225 L 390 275"
                    fill="none"
                    stroke="white"
                    strokeWidth="36"
                    strokeLinecap="round"
                    style={{
                      strokeDasharray: 80,
                      strokeDashoffset: branchOffset,
                    }}
                  />
                  <circle
                    cx="390"
                    cy="275"
                    r="22"
                    fill="white"
                    style={{ opacity: branchRatio }}
                  />
                </>
              )}

              {/* ─── 3. TEXT: Sequential letter-by-letter reveal (StudySync AI) ─── */}
              {LETTERS.map((letter) => {
                if (progress < letter.minP) return null;
                const letterRatio = Math.min(1, (progress - letter.minP) / (letter.maxP - letter.minP));
                const currentWidth = Math.round(letter.w * letterRatio);
                return (
                  <rect
                    key={letter.id}
                    x={letter.x}
                    y="385"
                    width={currentWidth}
                    height="92"
                    fill="white"
                  />
                );
              })}

              {/* Subtitle "INTELLIGENT LEARNING" */}
              {subWidth > 0 && (
                <rect
                  x="88"
                  y="488"
                  width={subWidth}
                  height="38"
                  fill="white"
                />
              )}

              {/* ─── 4. FULL FINAL CONSOLIDATION (95% -> 100%) ─── */}
              {progress >= 95 && (
                <rect
                  x="0"
                  y="0"
                  width="673"
                  height="540"
                  fill="white"
                  style={{ opacity: (progress - 95) / 5 }}
                />
              )}
            </mask>
          </defs>

          {/* 1. Base Layer: Pristine, Sharp Colorless Blueprint Outline */}
          <image
            href="/studysync-logo-transparent.png"
            x="0"
            y="0"
            width="673"
            height="540"
            style={{
              filter: 'grayscale(100%) opacity(0.20)',
            }}
          />

          {/* 2. Top Layer: 100% Authentic Original 2K Colors Flowing Sequentially Inside Lines */}
          <image
            href="/studysync-logo-transparent.png"
            x="0"
            y="0"
            width="673"
            height="540"
            mask="url(#seqLineFlowMask)"
          />
        </svg>
      </div>
    </div>
  );
};

export default LogoFillLoader;
