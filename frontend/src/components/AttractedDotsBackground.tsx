import { useEffect, useRef } from 'react';

export default function AttractedDotsBackground() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = 0;
    let height = 0;
    let dpr = 1;
    const GRID_SPACING = 34;

    const renderGrid = () => {
      if (!canvas) return;
      dpr = window.devicePixelRatio || 1;
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      ctx.clearRect(0, 0, width, height);

      const cx = width / 2;
      const cy = height / 2;

      // Book dimensions to keep the surface area behind the book clean
      const bookHalfW = Math.min(520, width * 0.47);
      const bookHalfH = 320;

      const cols = Math.ceil(width / GRID_SPACING) + 2;
      const rows = Math.ceil(height / GRID_SPACING) + 2;
      const offsetX = (cx % GRID_SPACING) - GRID_SPACING;
      const offsetY = (cy % GRID_SPACING) - GRID_SPACING;

      // Draw pure static geometric dot grid
      for (let r = 0; r < rows; r++) {
        const gy = offsetY + r * GRID_SPACING;

        for (let c = 0; c < cols; c++) {
          const gx = offsetX + c * GRID_SPACING;

          // Check if dot is directly behind the book
          const insideBookX = Math.abs(gx - cx) < bookHalfW - 35;
          const insideBookY = Math.abs(gy - cy) < bookHalfH - 35;
          if (insideBookX && insideBookY) {
            continue; // Keep book area clean
          }

          const dist = Math.hypot(cx - gx, cy - gy);

          // Clean, crisp grid dots
          ctx.beginPath();
          ctx.arc(gx, gy, 1.35, 0, Math.PI * 2);

          // Subtle, elegant brand coloring: slate grid with soft blue accents near book
          if (dist < 600) {
            const factor = 1 - dist / 600;
            const alpha = 0.35 + factor * 0.25;
            ctx.fillStyle = `rgba(59, 130, 246, ${alpha.toFixed(3)})`;
          } else {
            ctx.fillStyle = 'rgba(148, 163, 184, 0.38)';
          }
          ctx.fill();
        }
      }
    };

    renderGrid();
    window.addEventListener('resize', renderGrid);

    return () => {
      window.removeEventListener('resize', renderGrid);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="ss-attracted-dots-canvas"
      aria-hidden="true"
    />
  );
}
