import React, { useMemo, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import mermaid from 'mermaid';
import { repairChunkMathDelimiters } from '../utils/textSanitizer';

// Initialize mermaid once with a clean, high-contrast, modern theme
let mermaidInitialized = false;
const mermaidSvgCache = new Map<string, string>();
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

// ─── Unicode-safe btoa polyfill ──────────────────────────────────────────────
// Mermaid's internal edge/layout builder calls window.btoa() on strings
// that may contain multibyte Unicode (emojis like 👤, 📝, ⚠️, etc.).
// Native btoa() only accepts Latin-1 (U+0000–U+00FF) and throws
// InvalidCharacterError on anything outside that range.
// This polyfill encodes the string to UTF-8 bytes first, then base64-encodes.
const _originalBtoa = window.btoa;
window.btoa = function (str: string): string {
  try {
    return _originalBtoa(str);
  } catch {
    // Fallback: encode UTF-8 → percent-encoded → Latin-1 bytes → base64
    return _originalBtoa(
      encodeURIComponent(str).replace(
        /%([0-9A-F]{2})/g,
        (_match, hex) => String.fromCharCode(parseInt(hex, 16))
      )
    );
  }
};

// ─── Diagram Detection & Syntax Repair ──────────────────────────────────────────
export function isDiagramBlock(header?: string, code?: string): boolean {
  const h = (header || '').toLowerCase().trim().replace(/[^a-z0-9]/g, '');
  const diagramHeaders = [
    'mermaid', 'flowchart', 'graph', 'diagram', 'plantuml', 'uml', 'chart',
    'erdiagram', 'erd', 'entityrelationship', 'sequencediagram', 'sequence', 'seq',
    'classdiagram', 'class', 'statediagram', 'statediagramv2', 'state',
    'usecasediagram', 'usecase', 'mindmap', 'pie', 'gantt', 'gitgraph', 'timeline',
    'sankey', 'sankeybeta', 'c4context', 'c4', 'architecture', 'activitydiagram', 'activity',
    'requirementdiagram'
  ];
  if (diagramHeaders.some((d) => h === d || h.startsWith(d))) {
    return true;
  }

  const trimmed = (code || '').trim();
  if (!trimmed) return false;

  if (
    /(?:^|\n)\s*(?:graph\b|flowchart\b|sequenceDiagram\b|classDiagram\b|stateDiagram\b|stateDiagram-v2\b|erDiagram\b|mindmap\b|pie\b|gantt\b|gitGraph\b|usecaseDiagram\b|C4Context\b|timeline\b|sankey-beta\b|requirementDiagram\b)/im.test(trimmed)
  ) {
    return true;
  }
  if (/[A-Za-z0-9_]+\s*(?:\|\||}\||\}\||\{o|\|o|o\||o\{)[--=]+[A-Za-z0-9_]/i.test(trimmed)) {
    return true;
  }
  if (/[A-Za-z0-9_]+\s*(?:->>|-->>|->|-->)\s*[A-Za-z0-9_]+\s*:/i.test(trimmed)) {
    return true;
  }
  if (/(?:actor\s+[A-Za-z0-9_]+|-->\s*\([^\)]+\)|-->\s*\[[^\]]+\]|-->\s*\{[^\}]+\})/i.test(trimmed)) {
    return true;
  }
  if (/(?:^|\n)\s*class\s+[A-Za-z0-9_]+(?:\s*<\|--|\s*--|\s*\{)/im.test(trimmed)) {
    return true;
  }

  return false;
}

// Automatically convert PlantUML / LLM usecaseDiagram into valid Mermaid flowchart LR
function convertUsecaseToMermaid(code: string): string {
  const trimmed = (code || '').trim();
  const lower = trimmed.toLowerCase();
  const isUsecase =
    lower.includes('usecasediagram') ||
    (lower.includes('actor') && /-->\s*\(/i.test(trimmed)) ||
    (/^actor\s+[A-Za-z0-9_]+/im.test(trimmed) && /\([A-Za-z0-9_\s-]+\)/.test(trimmed));

  if (!isUsecase) {
    return trimmed;
  }

  const lines = trimmed.split('\n');
  const actors = new Map<string, string>();
  const relations: string[] = [];
  const usecases = new Map<string, string>();
  let ucCounter = 1;

  const getUcId = (title: string) => {
    const clean = title.replace(/[()]/g, '').trim();
    if (!usecases.has(clean)) {
      usecases.set(clean, `UC_${ucCounter++}`);
    }
    return usecases.get(clean)!;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Skip directives, comments, headers
    if (
      line.startsWith('%%') ||
      line.startsWith('@') ||
      /^(?:flowchart|graph|usecaseDiagram)\b/i.test(line)
    ) {
      continue;
    }

    // Actor definition: actor Customer or actor Customer as C
    const actorMatch = line.match(/^actor\s+([A-Za-z0-9_]+)(?:\s+as\s+([A-Za-z0-9_]+))?/i);
    if (actorMatch) {
      const name = actorMatch[1];
      const alias = actorMatch[2] || name;
      actors.set(alias, name);
      continue;
    }

    // Actor -> (Usecase) or From --> (Usecase)
    const arrowMatch = line.match(/^([A-Za-z0-9_]+)\s*(-->|->)\s*\(([^)]+)\)/);
    if (arrowMatch) {
      const from = arrowMatch[1];
      const to = arrowMatch[3].trim();
      const toId = getUcId(to);
      if (!actors.has(from)) {
        actors.set(from, from);
      }
      relations.push(`    ${from} --> ${toId}(["${to}"])`);
      continue;
    }

    // (Usecase) ..> (Usecase) : <<include>> or <<extend>>
    const inclMatch = line.match(/^\(([^)]+)\)\s*(\.\.>|-->|->)\s*\(([^)]+)\)(?:\s*:\s*<<?([^>]+)>>?)?/);
    if (inclMatch) {
      const from = getUcId(inclMatch[1].trim());
      const to = getUcId(inclMatch[3].trim());
      const label = (inclMatch[4] || '').replace(/[<>]/g, '').trim();
      relations.push(`    ${from} -.->${label ? `|${label}| ` : ''}${to}(["${inclMatch[3].trim()}"])`);
      continue;
    }
  }

  let out = 'flowchart LR\n';
  for (const [alias, name] of actors.entries()) {
    out += `    ${alias}["👤 ${name}"]\n`;
  }
  for (const r of relations) {
    out += `${r}\n`;
  }
  return out.trim();
}

// Auto-repair common LLM Mermaid syntax flaws safely without breaking specialized diagrams
export function repairMermaidSyntax(code: string, baseLang: string = ''): string {
  let text = (code || '').trim();
  if (text.startsWith('```')) {
    text = text.replace(/^```[a-zA-Z0-9_\-]*\n?/, '').replace(/\n?```$/, '').trim();
  }

  // 1. Convert usecase diagrams if detected
  text = convertUsecaseToMermaid(text);

  // 2. Prepend missing headers if baseLang specifies diagram type
  const lowerBase = (baseLang || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const trimmedLower = text.toLowerCase();

  if ((lowerBase === 'erdiagram' || lowerBase === 'erd' || lowerBase === 'entityrelationship') && !trimmedLower.startsWith('erdiagram')) {
    text = `erDiagram\n${text}`;
  } else if ((lowerBase === 'sequencediagram' || lowerBase === 'sequence' || lowerBase === 'seq') && !trimmedLower.startsWith('sequencediagram')) {
    text = `sequenceDiagram\n${text}`;
  } else if ((lowerBase === 'classdiagram' || lowerBase === 'class') && !trimmedLower.startsWith('classdiagram')) {
    text = `classDiagram\n${text}`;
  } else if ((lowerBase === 'statediagram' || lowerBase === 'state' || lowerBase === 'statediagramv2') && !trimmedLower.startsWith('statediagram')) {
    text = `stateDiagram-v2\n${text}`;
  } else if (lowerBase === 'mindmap' && !trimmedLower.startsWith('mindmap')) {
    text = `mindmap\n${text}`;
  } else if (lowerBase === 'pie' && !trimmedLower.startsWith('pie')) {
    text = `pie\n${text}`;
  } else if (lowerBase === 'gantt' && !trimmedLower.startsWith('gantt')) {
    text = `gantt\n${text}`;
  }

  // Detect diagram type
  const isErDiagram = /^erDiagram\b/im.test(text);
  const isSequence = /^sequenceDiagram\b/im.test(text);
  const isClassDiagram = /^classDiagram\b/im.test(text);
  const isStateDiagram = /^stateDiagram(?:-v2)?\b/im.test(text);
  const isSpecializedDiagram =
    isErDiagram ||
    isSequence ||
    isClassDiagram ||
    isStateDiagram ||
    /^mindmap\b/im.test(text) ||
    /^pie\b/im.test(text) ||
    /^gantt\b/im.test(text) ||
    /^gitGraph\b/im.test(text) ||
    /^timeline\b/im.test(text);

  // If no header at all and has flowchart syntax, prepend flowchart TD
  if (!isSpecializedDiagram && !/^(?:flowchart\b|graph\b)/im.test(text)) {
    if (/-->|--\s+>\s+|\[.*\]|\(.*\)|\{.*\}/.test(text)) {
      text = `flowchart TD\n${text}`;
    }
  }

  // ONLY perform flowchart node label sanitization if it is actually a flowchart/graph
  if (isSpecializedDiagram) {
    return text;
  }

  const lines = text.split('\n');
  const repairedLines = lines.map((line) => {
    let l = line;
    const trimmed = l.trim();

    // Skip comment lines or diagram definition headers
    if (trimmed.startsWith('%%') || /^(flowchart|graph)\b/i.test(trimmed)) {
      return l;
    }

    // 1. Repair unquoted square bracket node labels:
    // e.g. A[Start: Install Python] -> A["Start: Install Python"]
    // e.g. B --> C[Connect to (or create) .db file] -> B --> C["Connect to (or create) .db file"]
    l = l.replace(/(\b[A-Za-z0-9_]+)\[(?![\"\'])((?:[^\[\]]|\([^\)]*\))+)\]/g, (_match, id, label) => {
      const cleanLabel = label.replace(/"/g, "'").trim();
      return `${id}["${cleanLabel}"]`;
    });

    // 2. Repair unquoted decision/rhombus labels:
    // e.g. G --> H{Insert initial data?} -> G --> H{"Insert initial data?"}
    l = l.replace(/(\b[A-Za-z0-9_]+)\{(?![\"\'])([^\{\}]+)\}/g, (_match, id, label) => {
      const cleanLabel = label.replace(/"/g, "'").trim();
      return `${id}{"${cleanLabel}"}`;
    });

    // 3. Repair unquoted stadium labels: ID([label]) -> ID(["label"])
    l = l.replace(/(\b[A-Za-z0-9_]+)\(\[(?![\"\'])([^\[\]]+)\]\)/g, (_match, id, label) => {
      const cleanLabel = label.replace(/"/g, "'").trim();
      return `${id}(["${cleanLabel}"])`;
    });

    // 4. Repair unquoted circle labels: ID((label)) -> ID(("label"))
    l = l.replace(/(\b[A-Za-z0-9_]+)\(\((?![\"\'])([^\(\)]+)\)\)/g, (_match, id, label) => {
      const cleanLabel = label.replace(/"/g, "'").trim();
      return `${id}(("${cleanLabel}"))`;
    });

    // 5. Repair unquoted rounded node labels: ID(label) -> ID("label")
    l = l.replace(/(\b[A-Za-z0-9_]+)\((?![\"\'\(\[])([^\(\)]+)\)/g, (_match, id, label) => {
      const cleanLabel = label.replace(/"/g, "'").trim();
      return `${id}("${cleanLabel}")`;
    });

    // 6. Repair unquoted / non-standard edge labels:
    // e.g. H -- Yes --> I -> H -->|Yes| I
    l = l.replace(/--\s+([^-\>\n]+?)\s+-->/g, (_match, edgeText) => {
      return `-->|${edgeText.trim()}|`;
    });

    // 7. Fix standalone Unicode arrows if any
    l = l.replace(/[→➔➜]/g, '-->');

    return l;
  });

  return repairedLines.join('\n');
}

interface MarkdownViewProps {
  content: string;
  className?: string;
  style?: React.CSSProperties;
  isStreaming?: boolean;
}

function getCodeMeta(lang: string, customTitle?: string) {
  const cleanLang = (lang || '').toLowerCase().trim();
  const titleMap: Record<string, { label: string; ext: string }> = {
    sql: { label: 'query.sql', ext: 'sql' },
    python: { label: 'script.py', ext: 'py' },
    py: { label: 'script.py', ext: 'py' },
    javascript: { label: 'script.js', ext: 'js' },
    js: { label: 'script.js', ext: 'js' },
    typescript: { label: 'index.ts', ext: 'ts' },
    ts: { label: 'index.ts', ext: 'ts' },
    tsx: { label: 'Component.tsx', ext: 'tsx' },
    jsx: { label: 'Component.jsx', ext: 'jsx' },
    html: { label: 'index.html', ext: 'html' },
    css: { label: 'styles.css', ext: 'css' },
    json: { label: 'data.json', ext: 'json' },
    cpp: { label: 'main.cpp', ext: 'cpp' },
    c: { label: 'main.c', ext: 'c' },
    java: { label: 'Main.java', ext: 'java' },
    bash: { label: 'script.sh', ext: 'sh' },
    sh: { label: 'script.sh', ext: 'sh' },
    yaml: { label: 'config.yaml', ext: 'yaml' },
    yml: { label: 'config.yaml', ext: 'yaml' },
    markdown: { label: 'notes.md', ext: 'md' },
    md: { label: 'notes.md', ext: 'md' },
  };

  const meta = titleMap[cleanLang] || {
    label: cleanLang ? `file.${cleanLang}` : 'file.txt',
    ext: cleanLang || 'txt',
  };

  const fileName = customTitle || meta.label;
  const langUpper = (cleanLang || 'CODE').toUpperCase();

  return { fileName, langUpper, ext: meta.ext };
}

marked.setOptions({
  gfm: true,
  breaks: true,
});

marked.use({
  renderer: {
    code({ text, lang }: { text: string; lang?: string }) {
      const fullLang = (lang || 'code').trim();
      const langParts = fullLang.split(/\s+/);
      const baseLang = langParts[0].toLowerCase();
      const titleMatch = fullLang.match(/(?:title=["']([^"']+)["']|([a-zA-Z0-9_\-\.]+\.[a-zA-Z0-9]+))/i);
      const extractedTitle = titleMatch ? (titleMatch[1] || titleMatch[2]) : '';

      // ─── 1. Mermaid Diagrams (Flowcharts, ERDs, Sequence, Mindmaps, etc.) ─
      // Pure seamless diagram: NO canvas borders, NO buttons, directly in chat flow
      const isDiagram = isDiagramBlock(baseLang, text);

      if (isDiagram) {
        let cleanCode = text.trim();
        cleanCode = repairMermaidSyntax(cleanCode, baseLang);

        // Deterministic stable ID so React preserves the DOM node across streaming chunks without blinking!
        let chartHash = 0;
        for (let i = 0; i < cleanCode.length; i++) {
          chartHash = ((chartHash << 5) - chartHash) + cleanCode.charCodeAt(i);
          chartHash |= 0;
        }
        const uniqueDiagramId = `m-${Math.abs(chartHash).toString(36)}`;
        const encodedContent = encodeURIComponent(cleanCode);
        const cachedSvg = mermaidSvgCache.get(cleanCode);

        if (cachedSvg) {
          return `<div class="mermaid-diagram-clean" data-diagram-id="${uniqueDiagramId}">
            <div class="mermaid-svg-container" data-diagram-id="${uniqueDiagramId}" data-chart="${encodedContent}" data-rendered="true">
              <div class="mermaid-svg-inner" title="Click to view large diagram" style="width: 100%; display: flex; justify-content: center; margin: 10px 0; cursor: zoom-in; position: relative;">
                ${cachedSvg}
                <div class="mermaid-zoom-hint" title="Enlarge diagram">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 3 21 3 21 9"></polyline><polyline points="9 21 3 21 3 15"></polyline><line x1="21" y1="3" x2="14" y2="10"></line><line x1="3" y1="21" x2="10" y2="14"></line></svg>
                </div>
              </div>
            </div>
          </div>`;
        }

        return `<div class="mermaid-diagram-clean" data-diagram-id="${uniqueDiagramId}">
          <div class="mermaid-svg-container" data-diagram-id="${uniqueDiagramId}" data-chart="${encodedContent}">
            <div class="mermaid-loading-state">
              <div class="mermaid-spinner"></div>
              <span>Rendering diagram...</span>
            </div>
          </div>
        </div>`;
      }

      // ─── 2. Standard Code Blocks rendered as formal minimal artifact pill ──
      const { fileName, langUpper } = getCodeMeta(baseLang, extractedTitle);
      const lineCount = text.split('\n').length;
      const encodedContent = encodeURIComponent(text);
      const encodedTitle = encodeURIComponent(fileName);

      return `<div class="formal-code-card" data-code="${encodedContent}" data-lang="${baseLang}" data-title="${encodedTitle}" role="button" tabindex="0" title="Open ${fileName} in side window">
        <div class="formal-code-left">
          <div class="formal-code-icon">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="16 18 22 12 16 6"></polyline>
              <polyline points="8 6 2 12 8 18"></polyline>
            </svg>
          </div>
          <span class="formal-code-name">${fileName}</span>
          <span class="formal-code-badge">${langUpper}</span>
          <span class="formal-code-dot">•</span>
          <span class="formal-code-lines">${lineCount} ${lineCount === 1 ? 'line' : 'lines'}</span>
        </div>
        <div class="formal-code-actions">
          <button type="button" class="code-copy-btn formal-code-copy-btn" data-code="${encodedContent}" title="Copy code">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
            <span>Copy</span>
          </button>
          <button type="button" class="formal-code-open-btn" title="Open in side window">
            <span>Open</span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
              <polyline points="15 3 21 3 21 9"></polyline>
              <line x1="10" y1="14" x2="21" y2="3"></line>
            </svg>
          </button>
        </div>
      </div>`;
    },
  },
});
/**
 * Pre-processes raw AI text and notes to ensure that lists, numbered items,
 * and sections are formatted as proper, standard Markdown while safeguarding tables.
 */
function normalizeMarkdownLists(raw: string): string {
  if (!raw) return '';
  let text = raw;

  // Protect Markdown tables before list processing
  const tables: string[] = [];
  text = text.replace(/(^|\n)(\|[^\n]+\|\r?\n\|[-: |]+\|\r?\n(?:\|[^\n]+\|\r?\n?)*)/g, (match) => {
    const placeholder = `\n\n%%%STUDYSYNC_TABLE_${tables.length}%%%\n\n`;
    tables.push(match.trim());
    return placeholder;
  });

  const tableLines: string[] = [];
  text = text.replace(/(^|\n)(\|[^\n]+\|)(?=\n|$)/g, (match) => {
    const placeholder = `\n%%%STUDYSYNC_TABLELINE_${tableLines.length}%%%\n`;
    tableLines.push(match.trim());
    return placeholder;
  });

  // 1. Split Module / Chapter headers that are glued to preceding text
  text = text.replace(/([^\n])\s+(MODULE\s+\d+:\s*[^.\n]+)/gi, '$1\n\n### $2\n\n');

  // 2. Split section headings like "2.2 Section (Foo, Bar)" or "2.3 Section: Implementation"
  text = text.replace(/([.!?\)]|\b)\s+(\d+\.\d+\s+[A-Z][A-Za-z0-9\s:/*\-_(),']{3,80}?\))\s+(?=[A-Z])/g, (_m, p, h) => `${p}\n\n### ${h.trim()}\n\n`);
  text = text.replace(/([.!?\)]|\b)\s+(\d+\.\d+\s+[A-Z][A-Za-z0-9\s:/*\-_,']{3,70}?Implementation)\s+(?=[A-Z])/g, (_m, p, h) => `${p}\n\n### ${h.trim()}\n\n`);

  // 3. Sub-headers like "Mathematical Properties for Optimality:" or "Key Historical Milestones:"
  text = text.replace(/([.!?])\s+([A-Z][A-Za-z0-9\s/\\-_]{3,50}:)\s+(?=[1-9]\d?[.)]\s+|[-*•]\s+)/g, '$1\n\n**$2**\n\n');

  // 4. Split inline numbered items (1. , 2. , 3. ) after sentence endings (. , ! , ? , :)
  // Restrict to 1-2 digit numbers (1-99) so years like "In 2026. IBM announced..." are never split!
  text = text.replace(/([.!?:]|\$\$)\s+([1-9]\d?[.)]\s+)(?=[A-Z])/g, '$1\n\n$2');

  // 5. Bold the title/keyword of list items: "1. Breadth-First Search (BFS): Exploration..." -> "1. **Breadth-First Search (BFS):** Exploration..."
  text = text.replace(/(^|\n)([1-9]\d?[.)]\s+)([A-Za-z0-9\s()/*\-_']{2,60}):\s+/g, '$1$2**$3:** ');

  // 6. Split inline bullet items: "• foo • bar" or "- foo - bar"
  const lines = text.split('\n');
  const result: string[] = [];
  for (const line of lines) {
    const inlineBullet = /^[-•]\s+.+?(?:\s+[-•]\s+.+){1,}/.test(line.trim());
    if (inlineBullet) {
      const parts = line.trim().split(/(?=[-•]\s)/);
      for (const part of parts) {
        const trimmed = part.trim();
        if (trimmed) result.push(trimmed);
      }
      result.push('');
      continue;
    }
    result.push(line);
  }
  text = result.join('\n');

  // 7. Ensure blank lines before and after lists for marked.js parsing
  text = text.replace(/([^\n])\n([1-9]\d?[.)]\s)/g, '$1\n\n$2');
  text = text.replace(/([^\n])\n([-*•]\s)/g, '$1\n\n$2');

  // 8. Collapse excessive blank lines
  text = text.replace(/\n{4,}/g, '\n\n');

  // 9. Restore table lines and tables
  for (let i = 0; i < tableLines.length; i++) {
    text = text.replace(`%%%STUDYSYNC_TABLELINE_${i}%%%`, tableLines[i]);
  }
  for (let i = 0; i < tables.length; i++) {
    text = text.replace(`%%%STUDYSYNC_TABLE_${i}%%%`, tables[i]);
  }

  return text;
}

function renderMathAndMarkdown(content: string, inlineOnly: boolean = false): string {
  if (!content) return '';

  // 0. Pre-clean mojibake and repair cutoff chunk math delimiters ($$ and $)
  let prepared = repairChunkMathDelimiters(content);
  // Ensure $$ display blocks are cleanly surrounded by newlines
  prepared = prepared.replace(/([^\n])\s*\$\$/g, '$1\n\n$$').replace(/\$\$\s*([^\n])/g, '$$\n\n$1');

  const codeBlocks: string[] = [];
  const mathTokens: Array<{ token: string; html: string }> = [];
  let mathCounter = 0;

  // 1. Protect Fenced Code Blocks (```...```) FIRST to keep code and mermaid untouched
  let text = prepared.replace(/(^|\n)```[\s\S]*?```(\n|$)/g, (match) => {
    const placeholder = `\n%%%STUDYSYNC_CODEBLOCK_${codeBlocks.length}%%%\n`;
    codeBlocks.push(match);
    return placeholder;
  });

  // 2. Protect Inline Code (`...`)
  text = text.replace(/`[^`\n]+`/g, (match) => {
    const placeholder = `%%%STUDYSYNC_CODEBLOCK_${codeBlocks.length}%%%`;
    codeBlocks.push(match);
    return placeholder;
  });

  // 3. Helper to store rendered KaTeX with multi-tier fallback
  const saveMath = (equation: string, displayMode: boolean): string => {
    let cleanEq = equation.trim();
    if (!cleanEq) return '';

    // Strip outer $$ or $ if present
    if (cleanEq.startsWith('$$') && cleanEq.endsWith('$$') && cleanEq.length > 4) {
      cleanEq = cleanEq.slice(2, -2).trim();
    } else if (cleanEq.startsWith('$') && cleanEq.endsWith('$') && cleanEq.length > 2) {
      cleanEq = cleanEq.slice(1, -1).trim();
    }

    // Safety: If cleanEq starts with markdown headers, bullets, or contains multiple paragraphs, abort
    if (/^(?:#{1,6}\s|[-*•]\s|\d{1,2}[.)]\s)|\n\s*\n/.test(cleanEq)) {
      return displayMode ? `\n\n${cleanEq}\n\n` : cleanEq;
    }

    // Harmless baseline cleanups:
    // 1. Normalize escaped parentheses artifacts \( -> (, \) -> )
    cleanEq = cleanEq.replace(/\\([()])/g, '$1');

    // 2. Escape unescaped % (TeX comment character) - e.g. \text{(16.6 %)} -> \text{(16.6\%)}
    cleanEq = cleanEq.replace(/(^|[^\\])%/g, '$1\\%');

    // 3. Normalize unicode spaces
    cleanEq = cleanEq.replace(/[\u202F\u00A0\u200B\u2009]/g, ' ');

    // 4. For inline math, collapse internal line breaks into single spaces (preserves \\ matrix breaks)
    if (!displayMode) {
      cleanEq = cleanEq.replace(/\r?\n+/g, ' ');
    }

    const token = `%%%STUDYSYNC_MATH_${mathCounter++}%%%`;

    // Attempt KaTeX render with cascading repairs:
    // Pass 1: Parse directly!
    try {
      const rendered = katex.renderToString(cleanEq, {
        displayMode: inlineOnly ? false : displayMode,
        throwOnError: true,
        strict: false,
        output: 'html',
        trust: true,
      });
      mathTokens.push({
        token,
        html: displayMode && !inlineOnly
          ? `<div class="katex-display-wrapper">${rendered}</div>`
          : rendered,
      });
      return token;
    } catch {
      // Pass 2: Repair double-escaped commands only for known LaTeX command words
      try {
        const knownCommands = 'frac|sqrt|sum|int|prod|alpha|beta|gamma|delta|epsilon|theta|lambda|mu|pi|sigma|tau|phi|omega|nabla|partial|cdot|pm|mp|equiv|infty|mid|mathbf|mathit|mathrm|mathcal|mathbb|text|operatorname|det|lim|log|ln|sin|cos|tan|exp|begin|end|softmax|Concat|diag';
        const repairedCommands = cleanEq.replace(new RegExp('\\\\\\\\(' + knownCommands + ')\\b', 'g'), '\\$1');
        const rendered = katex.renderToString(repairedCommands, {
          displayMode: inlineOnly ? false : displayMode,
          throwOnError: true,
          strict: false,
          output: 'html',
          trust: true,
        });
        mathTokens.push({
          token,
          html: displayMode && !inlineOnly
            ? `<div class="katex-display-wrapper">${rendered}</div>`
            : rendered,
        });
        return token;
      } catch {}

      // Pass 3: Auto-repair attempt for multiple underscores like Dept_ID_FK or item_order_id
      try {
        const repaired = cleanEq.replace(/([A-Za-z0-9]+(?:_[A-Za-z0-9]+)+)/g, '\\text{$1}');
        const fallbackRendered = katex.renderToString(repaired, {
          displayMode: inlineOnly ? false : displayMode,
          throwOnError: true,
          strict: false,
          output: 'html',
          trust: true,
        });
        mathTokens.push({
          token,
          html: displayMode && !inlineOnly
            ? `<div class="katex-display-wrapper">${fallbackRendered}</div>`
            : fallbackRendered,
        });
        return token;
      } catch {}

      // Clean fallback: Never render normal English prose in gray code badges!
      const hasMathCmd = /\\[a-zA-Z]+/.test(cleanEq) || /[_^]/.test(cleanEq);
      const isMultiWordProse = cleanEq.split(/\s+/).length > 6 || /[.!?]\s+[A-Z]/.test(cleanEq);

      if (hasMathCmd && !isMultiWordProse) {
        mathTokens.push({
          token,
          html: displayMode && !inlineOnly
            ? `<div class="katex-display-wrapper math-fallback"><span class="math-fallback-text">${cleanEq.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</span></div>`
            : `<span class="katex-inline-fallback">${cleanEq.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</span>`,
        });
      } else {
        mathTokens.push({
          token,
          html: cleanEq.replace(/</g, '&lt;').replace(/>/g, '&gt;'),
        });
      }
    }
    return token;
  };

  // 4. Extract Display Math: $$ ... $$ (do not match across empty paragraph lines \n\s*\n)
  text = text.replace(/\$\$((?:(?!\n\s*\n)[\s\S])+?)\$\$/g, (match, eq) => {
    if (/\n\s*(#{1,6}\s|[-*•]\s|\d{1,2}[.)]\s)/.test(eq)) {
      return match;
    }
    // Check if swallowed prose: if >12 regular English words and lacking math symbols
    const nonMathWords = (eq.replace(/\\(text|mathbf|mathrm|operatorname)\{[^}]+\}/g, '').match(/[a-zA-Z]{3,}/g) || []).length;
    if (nonMathWords > 12 && !/\\(frac|sqrt|sum|int|prod|alpha|beta|gamma|delta|epsilon|theta|lambda|mu|pi|sigma|pmatrix|bmatrix|begin)/.test(eq)) {
      return match;
    }
    return saveMath(eq, true);
  });

  // 5. Extract Display Math: \[ ... \]
  text = text.replace(/\\\[((?:(?!\n\s*\n)[\s\S])+?)\\\]/g, (match, eq) => {
    if (/\n\s*(#{1,6}\s|[-*•]\s|\d{1,2}[.)]\s)/.test(eq)) {
      return match;
    }
    return saveMath(eq, true);
  });

  // 6. Extract Inline Math: $ ... $
  // Matches $ ... $ where content does not cross empty paragraph breaks.
  // Supports leading/trailing spaces inside $ ... $ gracefully (e.g. $ Dept_ID \ (PK) $).
  // Safely distinguishes math and variable attributes from currency ($5, $21 billion).
  text = text.replace(/(^|[^\\])\$([^\$]+?)\$/g, (match, prefix, eq) => {
    const trimmed = eq.trim();
    if (!trimmed) return match;
    // Prevent matching across multiple empty paragraphs
    if (/\n\s*\n/.test(trimmed)) {
      return match;
    }
    // Check if financial / currency:
    if (/^\d+([.,]\d+)?(\s*(billion|million|trillion|thousand|hundred|k|m|b|-fold|fold))?$/i.test(trimmed)) {
      return match;
    }
    // Check if markdown code block or header markers inside:
    if (/[#`~]/.test(trimmed)) {
      return match;
    }
    return `${prefix}${saveMath(trimmed, false)}`;
  });

  // 7. Extract Inline Math: \( ... \)
  text = text.replace(/\\\(([\s\S]+?)\\\)/g, (_, eq) => saveMath(eq, false));

  // 8. Auto-detect unwrapped math formulas / equations that contain LaTeX math commands
  const lines = text.split('\n');
  const processedLines = lines.map((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('%%%STUDYSYNC_') || trimmed.startsWith('#') || trimmed.startsWith('```')) {
      return line;
    }

    // Check if line contains LaTeX math indicators
    const hasMathCmd = /\\(frac|sqrt|sum|int|prod|alpha|beta|gamma|delta|epsilon|theta|lambda|mu|pi|sigma|tau|phi|omega|nabla|partial|cdot|pm|mp|equiv|infty|mid|mathbf|det|begin|pmatrix|bmatrix|vmatrix|matrix|cases|aligned|operatorname|text|times|div|vec|hat|bar|lim|sin|cos|tan|log|ln|exp|softmax|Concat|diag)\b/.test(trimmed);
    if (!hasMathCmd) return line;

    // A: Check for prefix like "Key Formula:", "Formula:", "Equation:"
    const prefixMatch = line.match(/^(\s*(?:Key\s+(?:Formula|Equation)|Formula|Equation|Rule):\s*)(.+)$/i);
    if (prefixMatch) {
      const prefix = prefixMatch[1];
      const eq = prefixMatch[2].trim();
      return prefix + saveMath(eq, true);
    }

    // B: If line is predominantly a standalone formula (NOT normal English text or a list item)
    const isListItem = /^(\d+[.)]|[-*•])\s+/.test(trimmed);
    const nonMathWords = (trimmed.replace(/\\(text|mathbf|mathrm|operatorname)\{[^}]+\}/g, '').replace(/\\(softmax|Concat|diag|left|right|cdot|times|quad|dots)\b/g, '').match(/[a-zA-Z]{3,}/g) || []).length;
    if (!isListItem && nonMathWords <= 4 && (/[=≠≈≤≥]|\\(le|ge|neq|equiv)/.test(trimmed) || /\\begin\{(pmatrix|bmatrix|vmatrix|matrix|cases|aligned)\}/.test(trimmed))) {
      return saveMath(trimmed, true);
    }

    return line;
  });
  text = processedLines.join('\n');

  // 9. Pre-process lists AFTER math is safely tokenized so equations are never split by bullets or minus signs!
  text = inlineOnly ? text : normalizeMarkdownLists(text);

  // 10. Normalize stray LLM LaTeX commands outside math and code (with word boundaries to avoid corrupting LaTeX commands)
  text = text
    .replace(/\\sim\b/g, '~ ')
    .replace(/\\times\b/g, '× ')
    .replace(/\\approx\b/g, '≈ ')
    .replace(/\\pm\b/g, '± ')
    .replace(/\\le\b/g, '≤ ')
    .replace(/\\ge\b/g, '≥ ')
    .replace(/\\neq\b/g, '≠ ')
    .replace(/\\cdot\b/g, '· ')
    .replace(/\\infty\b/g, '∞ ')
    .replace(/\*\*\\(\d+)/g, '**$1');

  // 8. Restore all code blocks before marked runs
  for (let i = 0; i < codeBlocks.length; i++) {
    text = text.split(`%%%STUDYSYNC_CODEBLOCK_${i}%%%`).join(codeBlocks[i]);
  }

  // 8. Parse markdown with marked (parseInline if inlineOnly)
  const rawHtml = inlineOnly
    ? (marked.parseInline(text) as string)
    : (marked.parse(text) as string);

  // 9. Sanitize with DOMPurify while allowing KaTeX MathML, SVGs, and clickable links
  const API_ORIGIN = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace(/\/api\/?$/, '');
  DOMPurify.addHook('afterSanitizeAttributes', (node) => {
    if (node.tagName === 'A') {
      node.setAttribute('target', '_blank');
      node.setAttribute('rel', 'noopener noreferrer');

      // Fix AI-hallucinated download URLs: rewrite any href containing /api/courses/ to actual backend
      const href = node.getAttribute('href') || '';
      if (href.includes('/api/courses/')) {
        // Extract the /api/courses/... path portion
        const apiPathMatch = href.match(/(\/api\/courses\/.*)/);
        if (apiPathMatch) {
          node.setAttribute('href', `${API_ORIGIN}${apiPathMatch[1]}`);
        }
      }
    }
  });
  let sanitizedHtml = DOMPurify.sanitize(rawHtml, {
    USE_PROFILES: { html: true, mathMl: true, svg: true },
    ALLOW_DATA_ATTR: true,
    ADD_TAGS: [
      'semantics', 'annotation', 'math', 'mrow', 'mi', 'mo', 'mn', 'msup', 'msub', 'mfrac', 'msqrt',
      'span', 'div', 'code', 'pre', 'a', 'button', 'svg', 'rect', 'path', 'polyline', 'line',
      'g', 'marker', 'circle', 'text', 'tspan', 'foreignObject', 'style', 'polygon', 'ellipse', 'defs'
    ],
    ADD_ATTR: [
      'encoding', 'aria-hidden', 'display', 'viewBox', 'path', 'd', 'style', 'class', 'href', 'target', 'rel', 'title',
      'id', 'width', 'height', 'fill', 'stroke', 'stroke-width', 'transform', 'marker-end', 'marker-start',
      'data-hash', 'data-code', 'data-diagram-id', 'data-lang', 'data-title', 'data-code-id', 'data-scale', 'role', 'tabindex',
      'x', 'y', 'x1', 'y1', 'x2', 'y2', 'r', 'rx', 'ry', 'points'
    ],
  });
  DOMPurify.removeHook('afterSanitizeAttributes');

  // 10. Re-inject rendered KaTeX HTML
  for (const { token, html } of mathTokens) {
    sanitizedHtml = sanitizedHtml.split(token).join(html);
  }

  return sanitizedHtml;
}

interface DiagramLightboxModalProps {
  svgHtml: string;
  onClose: () => void;
}

const DiagramLightboxModal: React.FC<DiagramLightboxModalProps> = ({ svgHtml, onClose }) => {
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  const handleDownload = () => {
    try {
      const blob = new Blob([svgHtml], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `diagram-${Date.now()}.svg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
    }
  };

  return createPortal(
    <div
      className="diagram-lightbox-overlay"
      onClick={onClose}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.85)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        zIndex: 99999,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}
    >
      {/* Top Floating Controls Bar */}
      <div
        className="diagram-lightbox-toolbar"
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'absolute',
          top: '18px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          background: 'rgba(30, 41, 59, 0.95)',
          border: '1px solid rgba(255, 255, 255, 0.15)',
          borderRadius: '9999px',
          padding: '6px 14px',
          boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)',
          zIndex: 10,
        }}
      >
        <button
          type="button"
          onClick={() => setZoom((z) => Math.max(0.4, Number((z - 0.2).toFixed(1))))}
          disabled={zoom <= 0.4}
          title="Zoom Out (-20%)"
          style={{
            background: 'transparent',
            border: 'none',
            color: '#F1F5F9',
            fontSize: '16px',
            fontWeight: 700,
            cursor: zoom <= 0.4 ? 'not-allowed' : 'pointer',
            padding: '2px 8px',
            borderRadius: '6px',
            opacity: zoom <= 0.4 ? 0.35 : 1,
            lineHeight: 1,
          }}
        >
          −
        </button>
        <button
          type="button"
          onClick={() => setZoom(1)}
          title="Reset Zoom (100%)"
          style={{
            background: 'transparent',
            border: 'none',
            color: '#94A3B8',
            fontSize: '12px',
            fontWeight: 600,
            cursor: 'pointer',
            minWidth: '42px',
            textAlign: 'center',
            userSelect: 'none',
          }}
        >
          {Math.round(zoom * 100)}%
        </button>
        <button
          type="button"
          onClick={() => setZoom((z) => Math.min(3, Number((z + 0.2).toFixed(1))))}
          disabled={zoom >= 3}
          title="Zoom In (+20%)"
          style={{
            background: 'transparent',
            border: 'none',
            color: '#F1F5F9',
            fontSize: '16px',
            fontWeight: 700,
            cursor: zoom >= 3 ? 'not-allowed' : 'pointer',
            padding: '2px 8px',
            borderRadius: '6px',
            opacity: zoom >= 3 ? 0.35 : 1,
            lineHeight: 1,
          }}
        >
          +
        </button>
        <div style={{ width: '1px', height: '16px', background: 'rgba(255, 255, 255, 0.2)', margin: '0 4px' }} />
        <button
          type="button"
          onClick={handleDownload}
          title="Download as SVG"
          style={{
            background: 'rgba(59, 130, 246, 0.25)',
            border: '1px solid rgba(59, 130, 246, 0.45)',
            color: '#60A5FA',
            fontSize: '12px',
            fontWeight: 500,
            cursor: 'pointer',
            padding: '4px 10px',
            borderRadius: '9999px',
          }}
        >
          <span>Download SVG</span>
        </button>
        <button
          type="button"
          onClick={onClose}
          title="Close (Esc)"
          style={{
            background: 'rgba(239, 68, 68, 0.25)',
            border: '1px solid rgba(239, 68, 68, 0.45)',
            color: '#F87171',
            fontSize: '13px',
            fontWeight: 700,
            cursor: 'pointer',
            padding: '3px 8px',
            borderRadius: '9999px',
            marginLeft: '4px',
            lineHeight: 1,
          }}
        >
          ✕
        </button>
      </div>

      {/* Large Pop-up Viewport Card */}
      <div
        className="diagram-lightbox-content"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '92vw',
          maxWidth: '1260px',
          height: '82vh',
          background: '#FFFFFF',
          borderRadius: '16px',
          padding: '28px',
          overflow: 'auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.6)',
          position: 'relative',
        }}
      >
        <div
          className="diagram-lightbox-svg"
          style={{
            transform: `scale(${zoom})`,
            transformOrigin: 'center center',
            transition: 'transform 0.15s ease-out',
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          dangerouslySetInnerHTML={{ __html: svgHtml }}
        />
      </div>
    </div>,
    document.body
  );
};

const DiagramLightboxManager: React.FC = () => {
  const [svgHtml, setSvgHtml] = useState<string | null>(null);

  useEffect(() => {
    const handleOpen = (e: Event) => {
      const customEvent = e as CustomEvent<{ svgHtml: string }>;
      if (customEvent.detail?.svgHtml) {
        setSvgHtml(customEvent.detail.svgHtml);
      }
    };
    window.addEventListener('studysync:open-diagram-lightbox', handleOpen);
    return () => {
      window.removeEventListener('studysync:open-diagram-lightbox', handleOpen);
    };
  }, []);

  if (!svgHtml) return null;
  return <DiagramLightboxModal svgHtml={svgHtml} onClose={() => setSvgHtml(null)} />;
};

const MarkdownView = React.memo(
  function MarkdownView({ content, className = '', style = {}, isStreaming = false }: MarkdownViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const prevBlockCountRef = useRef(0);

  const html = useMemo(() => {
    try {
      return renderMathAndMarkdown(content);
    } catch {
      return DOMPurify.sanitize(marked.parse(content) as string);
    }
  }, [content]);

  // ─── Paragraph Slow-Mo Flash Blur & Word-by-Word Animation during streaming ───
  useEffect(() => {
    if (!isStreaming || !containerRef.current) {
      prevBlockCountRef.current = 0;
      return;
    }
    const container = containerRef.current;

    // 1. Cinematic Paragraph / Block Entrance
    try {
      const blocks = container.querySelectorAll<HTMLElement>(
        ':scope > p, :scope > ul, :scope > ol, :scope > h1, :scope > h2, :scope > h3, :scope > h4, :scope > blockquote, :scope > pre'
      );
      const blockCount = blocks.length;

      // Keep previously completed blocks static and crisp
      for (let i = 0; i < blockCount - 1; i++) {
        const b = blocks[i];
        if (!b.classList.contains('streaming-paragraph-completed')) {
          b.classList.remove('streaming-paragraph-enter-slowmo');
          b.classList.add('streaming-paragraph-completed');
        }
      }

      // Animate active or new paragraph
      if (blockCount > 0) {
        const activeBlock = blocks[blockCount - 1];
        if (blockCount > prevBlockCountRef.current) {
          activeBlock.classList.add('streaming-paragraph-enter-slowmo');
          prevBlockCountRef.current = blockCount;
        }
      }
    } catch {
      // Safe fallback
    }

    // 2. Trailing Word Blur & Flash Glow
    function getLastTextNode(node: Node): Text | null {
      if (node.nodeType === Node.TEXT_NODE) {
        if ((node.textContent || '').trim().length > 0) {
          return node as Text;
        }
        return null;
      }
      for (let i = node.childNodes.length - 1; i >= 0; i--) {
        const found = getLastTextNode(node.childNodes[i]);
        if (found) return found;
      }
      return null;
    }

    try {
      const lastText = getLastTextNode(container);
      if (!lastText || !lastText.parentElement) return;
      if (lastText.parentElement.classList.contains('streaming-word-flash')) return;

      const fullText = lastText.textContent || '';
      const match = fullText.match(/^(.*?)((\S+\s*){1,2})$/s);
      if (match && match[2]) {
        const before = match[1];
        const lastWords = match[2];

        const span = document.createElement('span');
        span.className = 'streaming-word-flash';
        span.textContent = lastWords;

        const parent = lastText.parentElement;
        if (before) {
          const beforeNode = document.createTextNode(before);
          parent.insertBefore(beforeNode, lastText);
        }
        parent.insertBefore(span, lastText);
        parent.removeChild(lastText);
      }
    } catch {
      // Safe fallback
    }
  }, [html, isStreaming]);

  useEffect(() => {
    if (isStreaming) return;
    const container = containerRef.current;
    if (!container) return;

    // ─── Render any pending Mermaid diagrams asynchronously ─────────────
    initMermaid();
    const mermaidContainers = container.querySelectorAll<HTMLElement>(
      '.mermaid-svg-container:not([data-rendered="true"])'
    );
    mermaidContainers.forEach(async (el) => {
      const encoded = el.getAttribute('data-chart');
      if (!encoded) return;

      el.setAttribute('data-rendered', 'true');
      let rawCode = decodeURIComponent(encoded).trim();
      rawCode = repairMermaidSyntax(rawCode);

      if (mermaidSvgCache.has(rawCode)) {
        const cached = mermaidSvgCache.get(rawCode)!;
        el.innerHTML = `<div class="mermaid-svg-inner" title="Click to view large diagram" style="width: 100%; display: flex; justify-content: center; margin: 10px 0; cursor: zoom-in; position: relative;">
          ${cached}
          <div class="mermaid-zoom-hint" title="Enlarge diagram">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 3 21 3 21 9"></polyline><polyline points="9 21 3 21 3 15"></polyline><line x1="21" y1="3" x2="14" y2="10"></line><line x1="3" y1="21" x2="10" y2="14"></line></svg>
          </div>
        </div>`;
        return;
      }

      const renderId = `m-svg-${Math.random().toString(36).slice(2, 9)}`;

      try {
        const { svg } = await mermaid.render(renderId, rawCode);
        mermaidSvgCache.set(rawCode, svg);
        el.innerHTML = `<div class="mermaid-svg-inner" title="Click to view large diagram" style="width: 100%; display: flex; justify-content: center; margin: 10px 0; cursor: zoom-in; position: relative;">
          ${svg}
          <div class="mermaid-zoom-hint" title="Enlarge diagram">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 3 21 3 21 9"></polyline><polyline points="9 21 3 21 3 15"></polyline><line x1="21" y1="3" x2="14" y2="10"></line><line x1="3" y1="21" x2="10" y2="14"></line></svg>
          </div>
        </div>`;
      } catch (err: any) {
        console.warn('Mermaid rendering first pass syntax notice:', err);
        const strayEl = document.getElementById(renderId) || document.getElementById(`d${renderId}`);
        if (strayEl && strayEl.parentNode) {
          strayEl.parentNode.removeChild(strayEl);
        }

        // Secondary fallback pass: convert to standard graph TD and aggressively quote all node labels
        try {
          const fallbackRenderId = `m-svg-fb-${Math.random().toString(36).slice(2, 9)}`;
          const aggressiveCode = rawCode
            .replace(/^flowchart\s+[A-Za-z]+/i, 'graph TD')
            .replace(/([A-Za-z0-9_]+)\[([^\]]+)\]/g, '$1["$2"]')
            .replace(/([A-Za-z0-9_]+)\{([^\}]+)\}/g, '$1{"$2"}');
          const { svg } = await mermaid.render(fallbackRenderId, aggressiveCode);
          mermaidSvgCache.set(rawCode, svg);
          el.innerHTML = `<div class="mermaid-svg-inner" title="Click to view large diagram" style="width: 100%; display: flex; justify-content: center; margin: 10px 0; cursor: zoom-in; position: relative;">
            ${svg}
            <div class="mermaid-zoom-hint" title="Enlarge diagram">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 3 21 3 21 9"></polyline><polyline points="9 21 3 21 3 15"></polyline><line x1="21" y1="3" x2="14" y2="10"></line><line x1="3" y1="21" x2="10" y2="14"></line></svg>
            </div>
          </div>`;
          return;
        } catch (err2) {
          console.warn('Mermaid fallback failed:', err2);
        }

        // Seamless clean code block (no yellow alert, no canvas box)
        el.innerHTML = `<pre class="mermaid-raw-code-box" style="margin: 10px 0;"><code>${rawCode.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</code></pre>`;
      }
    });

    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;

      // Click on Mermaid diagram opens large lightbox pop-up without causing MarkdownView to re-render
      const diagramContainer = target.closest('.mermaid-svg-inner') as HTMLElement | null;
      if (diagramContainer) {
        const svgEl = diagramContainer.querySelector('svg');
        if (svgEl) {
          window.dispatchEvent(
            new CustomEvent('studysync:open-diagram-lightbox', {
              detail: { svgHtml: svgEl.outerHTML },
            })
          );
          return;
        }
      }

      const copyBtn = target.closest('.code-copy-btn') as HTMLElement | null;
      if (copyBtn) {
        const encoded = copyBtn.getAttribute('data-code');
        if (encoded) {
          const code = decodeURIComponent(encoded);
          navigator.clipboard.writeText(code);
          const span = copyBtn.querySelector('span');
          if (span) {
            const orig = span.textContent;
            span.textContent = 'Copied!';
            copyBtn.classList.add('is-copied');
            setTimeout(() => {
              span.textContent = orig;
              copyBtn.style.color = '';
              copyBtn.classList.remove('is-copied');
            }, 1800);
          }
        }
        return;
      }

      const openBtn = (target.closest('.formal-code-card') || target.closest('.code-open-window-btn')) as HTMLElement | null;
      if (openBtn) {
        const encoded = openBtn.getAttribute('data-code');
        const lang = (openBtn.getAttribute('data-lang') || 'code').toLowerCase();
        const rawTitle = openBtn.getAttribute('data-title');
        const decodedTitle = rawTitle ? decodeURIComponent(rawTitle) : '';
        if (encoded) {
          const code = decodeURIComponent(encoded);
          const extMap: Record<string, string> = {
            python: 'py', py: 'py', javascript: 'js', js: 'js',
            typescript: 'ts', ts: 'ts', tsx: 'tsx', jsx: 'jsx',
            cpp: 'cpp', c: 'c', java: 'java', html: 'html',
            css: 'css', sql: 'sql', json: 'json', markdown: 'md', md: 'md',
            document: 'docx', docx: 'docx', mermaid: 'mermaid',
          };
          const ext = extMap[lang] || 'txt';
          const finalTitle = decodedTitle || `solution.${ext}`;
          const isDoc =
            lang === 'document' ||
            finalTitle.endsWith('.docx') ||
            finalTitle.toLowerCase().includes('leave') ||
            finalTitle.toLowerCase().includes('letter');

          window.dispatchEvent(
            new CustomEvent('studysync:open-artifact', {
              detail: {
                id: `art-${Date.now()}`,
                title: finalTitle,
                language: lang,
                content: code,
                type: isDoc ? 'document' : 'code',
              },
            })
          );
        }
      }
    };

    container.addEventListener('click', handleClick);
    return () => {
      container.removeEventListener('click', handleClick);
    };
  }, [html, isStreaming]);

  return (
    <>
      <div
        ref={containerRef}
        className={`markdown-content ${className}`}
        style={{
          lineHeight: 1.75,
          fontSize: '0.95rem',
          overflowWrap: 'break-word',
          wordBreak: 'break-word',
          maxWidth: '100%',
          color: '#1a1a1a',
          ...style,
        }}
        dangerouslySetInnerHTML={{ __html: html }}
      />
      <DiagramLightboxManager />
    </>
  );
}, (prev, next) => prev.content === next.content && prev.className === next.className && prev.isStreaming === next.isStreaming);

export default MarkdownView;
