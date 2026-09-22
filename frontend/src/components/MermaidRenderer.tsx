import React, { useEffect, useRef, useState } from 'react';
import mermaid from 'mermaid';
import { repairMermaidSyntax } from './MarkdownView';

// Initialize mermaid once with a clean, high-contrast, modern theme
let mermaidInitialized = false;
function initMermaid() {
  if (mermaidInitialized) return;
  mermaid.initialize({
    startOnLoad: false,
    theme: 'neutral',
    securityLevel: 'loose',
    fontFamily: 'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    fontSize: 13,
    logLevel: 'error',
    flowchart: {
      htmlLabels: true,
      curve: 'basis',
      useMaxWidth: true,
      nodeSpacing: 35,
      rankSpacing: 35,
    },
    sequence: {
      useMaxWidth: true,
      mirrorActors: false,
    },
    er: {
      useMaxWidth: true,
      fontSize: 12,
    },
    state: {
      useMaxWidth: true,
    },
    mindmap: {
      useMaxWidth: true,
    },
  });
  mermaidInitialized = true;
}

interface MermaidRendererProps {
  chart: string;
  title?: string;
  className?: string;
}

export const MermaidRenderer: React.FC<MermaidRendererProps> = ({
  chart,
  title: _title,
  className = '',
}) => {
  const [svgContent, setSvgContent] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [isRendering, setIsRendering] = useState<boolean>(true);
  const containerRef = useRef<HTMLDivElement>(null);

  const cleanChartCode = React.useMemo(() => {
    if (!chart) return '';
    return repairMermaidSyntax(chart.trim());
  }, [chart]);

  useEffect(() => {
    let isMounted = true;
    initMermaid();

    const renderDiagram = async () => {
      if (!cleanChartCode) {
        setSvgContent('');
        setIsRendering(false);
        return;
      }

      setIsRendering(true);
      setError(null);

      const renderId = `m-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

      try {
        const { svg } = await mermaid.render(renderId, cleanChartCode);

        if (isMounted) {
          let tunedSvg = svg;
          if (!tunedSvg.includes('viewBox') && tunedSvg.includes('height=') && tunedSvg.includes('width=')) {
            const widthMatch = tunedSvg.match(/width="([^"]+)"/);
            const heightMatch = tunedSvg.match(/height="([^"]+)"/);
            if (widthMatch && heightMatch) {
              tunedSvg = tunedSvg.replace(
                '<svg ',
                `<svg viewBox="0 0 ${parseFloat(widthMatch[1])} ${parseFloat(heightMatch[1])}" `
              );
            }
          }
          setSvgContent(tunedSvg);
          setError(null);
          setIsRendering(false);
        }
      } catch (err: any) {
        console.warn('Mermaid rendering edge case, trying fallback:', err);
        const strayEl = document.getElementById(renderId) || document.getElementById(`d${renderId}`);
        if (strayEl && strayEl.parentNode) {
          strayEl.parentNode.removeChild(strayEl);
        }

        try {
          const fallbackRenderId = `m-fb-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
          const aggressiveCode = cleanChartCode
            .replace(/^flowchart\s+[A-Za-z]+/i, 'graph TD')
            .replace(/([A-Za-z0-9_]+)\[([^\]]+)\]/g, '$1["$2"]')
            .replace(/([A-Za-z0-9_]+)\{([^\}]+)\}/g, '$1{"$2"}');
          const { svg } = await mermaid.render(fallbackRenderId, aggressiveCode);
          if (isMounted) {
            setSvgContent(svg);
            setError(null);
            setIsRendering(false);
            return;
          }
        } catch (err2) {
          console.warn('Mermaid fallback error:', err2);
        }

        if (isMounted) {
          setError(err?.message || 'Could not render diagram syntax');
          setIsRendering(false);
        }
      }
    };

    renderDiagram();

    return () => {
      isMounted = false;
    };
  }, [cleanChartCode]);

  return (
    <div className={`mermaid-diagram-clean ${className}`} ref={containerRef}>
      {isRendering ? (
        <div className="mermaid-loading-state">
          <div className="mermaid-spinner" />
          <span>Rendering diagram...</span>
        </div>
      ) : error ? (
        <pre className="mermaid-raw-code-box">
          <code>{cleanChartCode}</code>
        </pre>
      ) : (
        <div
          className="mermaid-svg-wrapper"
          dangerouslySetInnerHTML={{ __html: svgContent }}
        />
      )}
    </div>
  );
};

export default MermaidRenderer;
