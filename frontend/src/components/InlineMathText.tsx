import { useMemo } from 'react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import katex from 'katex';
import 'katex/dist/katex.min.css';

marked.setOptions({
  gfm: true,
  breaks: false,
});

export function renderMathInline(content: string): string {
  if (!content) return '';

  const codeBlocks: string[] = [];
  const mathTokens: Array<{ token: string; html: string }> = [];
  let mathCounter = 0;

  // Protect inline code
  let text = content.replace(/`[^`\n]+`/g, (match) => {
    const placeholder = `%%%MATH_CODE_${codeBlocks.length}%%%`;
    codeBlocks.push(match);
    return placeholder;
  });

  const saveMath = (equation: string): string => {
    let cleanEq = equation.trim();
    if (!cleanEq) return '';

    // Strip outer $$ or $ if present
    if (cleanEq.startsWith('$$') && cleanEq.endsWith('$$') && cleanEq.length > 4) {
      cleanEq = cleanEq.slice(2, -2).trim();
    } else if (cleanEq.startsWith('$') && cleanEq.endsWith('$') && cleanEq.length > 2) {
      cleanEq = cleanEq.slice(1, -1).trim();
    }

    // 1. Normalize escaped parentheses artifacts
    cleanEq = cleanEq.replace(/\\([()])/g, '$1');

    // 2. Escape unescaped % (TeX comment character) - e.g. \text{(16.6 %)} -> \text{(16.6\%)}
    cleanEq = cleanEq.replace(/(^|[^\\])%/g, '$1\\%');

    // 3. Normalize unicode spaces
    cleanEq = cleanEq.replace(/[\u202F\u00A0\u200B\u2009]/g, ' ');

    // 4. Collapse internal line breaks
    cleanEq = cleanEq.replace(/\r?\n+/g, ' ');

    const token = `%%%MATH_TOKEN_${mathCounter++}%%%`;
    try {
      const rendered = katex.renderToString(cleanEq, {
        displayMode: false,
        throwOnError: true,
        strict: false,
        output: 'html',
        trust: true,
      });
      mathTokens.push({ token, html: rendered });
      return token;
    } catch {
      // Pass 2: Repair double-escaped known commands
      try {
        const knownCommands = 'frac|sqrt|sum|int|prod|alpha|beta|gamma|delta|epsilon|theta|lambda|mu|pi|sigma|tau|phi|omega|nabla|partial|cdot|pm|mp|equiv|infty|mid|mathbf|mathit|mathrm|mathcal|mathbb|text|operatorname|det|lim|log|ln|sin|cos|tan|exp|begin|end';
        const repairedCommands = cleanEq.replace(new RegExp('\\\\\\\\(' + knownCommands + ')\\b', 'g'), '\\$1');
        const rendered = katex.renderToString(repairedCommands, {
          displayMode: false,
          throwOnError: true,
          strict: false,
          output: 'html',
          trust: true,
        });
        mathTokens.push({ token, html: rendered });
        return token;
      } catch {}

      // Pass 3: Repair identifiers with multiple underscores
      try {
        const repaired = cleanEq.replace(/([A-Za-z0-9]+(?:_[A-Za-z0-9]+)+)/g, '\\text{$1}');
        const fallbackRendered = katex.renderToString(repaired, {
          displayMode: false,
          throwOnError: true,
          strict: false,
          output: 'html',
          trust: true,
        });
        mathTokens.push({ token, html: fallbackRendered });
        return token;
      } catch {}

      mathTokens.push({
        token,
        html: `<code class="katex-fallback">$${cleanEq}$</code>`,
      });
    }
    return token;
  };

  // Display math inside inline
  text = text.replace(/\$\$([\s\S]+?)\$\$/g, (_, eq) => saveMath(eq));
  text = text.replace(/\\\[([\s\S]+?)\\\]/g, (_, eq) => saveMath(eq));

  // Inline math: $ ... $
  text = text.replace(/(^|[^\\])\$([^\$]+?)\$/g, (_, prefix, eq) => {
    if (/^\s*\d+([.,]\d+)?\s*$/.test(eq)) {
      return `${prefix}$${eq}$`;
    }
    return `${prefix}${saveMath(eq)}`;
  });

  // Inline math: \( ... \)
  text = text.replace(/\\\(([\s\S]+?)\\\)/g, (_, eq) => saveMath(eq));

  // Restore code blocks
  for (let i = 0; i < codeBlocks.length; i++) {
    text = text.split(`%%%MATH_CODE_${i}%%%`).join(codeBlocks[i]);
  }

  const rawHtml = marked.parseInline(text) as string;

  let sanitizedHtml = DOMPurify.sanitize(rawHtml, {
    USE_PROFILES: { html: true, mathMl: true, svg: true },
    ADD_TAGS: ['semantics', 'annotation', 'math', 'mrow', 'mi', 'mo', 'mn', 'msup', 'msub', 'mfrac', 'msqrt', 'span', 'div', 'code'],
    ADD_ATTR: ['encoding', 'aria-hidden', 'display', 'viewBox', 'path', 'd', 'style', 'class'],
  });

  for (const { token, html } of mathTokens) {
    sanitizedHtml = sanitizedHtml.split(token).join(html);
  }

  return sanitizedHtml;
}

export interface InlineMathTextProps {
  content: string;
  className?: string;
  style?: React.CSSProperties;
}

export function InlineMathText({ content, className = '', style = {} }: InlineMathTextProps) {
  const html = useMemo(() => {
    try {
      return renderMathInline(content);
    } catch {
      return DOMPurify.sanitize(marked.parseInline(content) as string);
    }
  }, [content]);

  return (
    <span
      className={`inline-math-text ${className}`}
      style={{ display: 'inline', ...style }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

export default InlineMathText;
