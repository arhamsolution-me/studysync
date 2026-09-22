/**
 * WhatsApp Message Formatter & Unicode LaTeX Math Converter
 *
 * Converts markdown and LaTeX mathematical equations into clean, beautiful,
 * readable Unicode math suitable for WhatsApp chat messages.
 */

const unicodeSubscripts: Record<string, string> = {
  '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄',
  '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉',
  '+': '₊', '-': '₋', '=': '₌', '(': '₍', ')': '₎',
  'a': 'ₐ', 'e': 'ₑ', 'h': 'ₕ', 'i': 'ᵢ', 'j': 'ⱼ',
  'k': 'ₖ', 'l': 'ₗ', 'm': 'ₘ', 'n': 'ₙ', 'o': 'ₒ',
  'p': 'ₚ', 'r': 'ᵣ', 's': 'ₛ', 't': 'ₜ', 'u': 'ᵤ',
  'v': 'ᵥ', 'x': 'ₓ',
};

const unicodeSuperscripts: Record<string, string> = {
  '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴',
  '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹',
  '+': '⁺', '-': '⁻', '=': '⁼', '(': '⁽', ')': '⁾',
  'a': 'ᵃ', 'b': 'ᵇ', 'c': 'ᶜ', 'd': 'ᵈ', 'e': 'ᵉ',
  'f': 'ᶠ', 'g': 'ᵍ', 'h': 'ʰ', 'i': 'ⁱ', 'j': 'ʲ',
  'k': 'ᵏ', 'l': 'ˡ', 'm': 'ᵐ', 'n': 'ⁿ', 'o': 'ᵒ',
  'p': 'ᵖ', 'r': 'ʳ', 's': 'ˢ', 't': 'ᵗ', 'u': 'ᵘ',
  'v': 'ᵛ', 'w': 'ʷ', 'x': 'ˣ', 'y': 'ʸ', 'z': 'ᶻ',
  'A': 'ᴬ', 'B': 'ᴮ', 'D': 'ᴰ', 'E': 'ᴱ', 'G': 'ᴳ',
  'H': 'ᴴ', 'I': 'ᴵ', 'J': 'ᴶ', 'K': 'ᴷ', 'L': 'ᴸ',
  'M': 'ᴹ', 'N': 'ᴺ', 'O': 'ᴼ', 'P': 'ᴾ', 'R': 'ᴿ',
  'T': 'ᵀ', 'U': 'ᵁ', 'V': 'ⱽ', 'W': 'ᵂ',
};

const greekMap: Record<string, string> = {
  alpha: 'α', beta: 'β', gamma: 'γ', Gamma: 'Γ',
  delta: 'δ', Delta: 'Δ', epsilon: 'ε', varepsilon: 'ε',
  zeta: 'ζ', eta: 'η', theta: 'θ', Theta: 'Θ', vartheta: 'θ',
  iota: 'ι', kappa: 'κ', lambda: 'λ', Lambda: 'Λ',
  mu: 'μ', nu: 'ν', xi: 'ξ', Xi: 'Ξ',
  pi: 'π', Pi: 'Π', rho: 'ρ', sigma: 'σ', Sigma: 'Σ',
  tau: 'τ', upsilon: 'υ', Upsilon: 'Υ', phi: 'φ', Phi: 'Φ', varphi: 'φ',
  chi: 'χ', psi: 'ψ', Psi: 'Ψ', omega: 'ω', Omega: 'Ω',
  nabla: '∇', partial: '∂',
};

const symbolMap: Record<string, string> = {
  pm: '±', mp: '∓', times: '×', cdot: '·', div: '÷',
  ast: '∗', star: '⋆', circ: '∘', bullet: '•',
  le: '≤', leq: '≤', ge: '≥', geq: '≥', neq: '≠', ne: '≠',
  approx: '≈', equiv: '≡', sim: '~', propto: '∝',
  infty: '∞', forall: '∀', exists: '∃', neg: '¬',
  to: '→', rightarrow: '→', leftarrow: '←', Leftarrow: '⇐',
  Rightarrow: '⇒', iff: '⇔', Leftrightarrow: '⇔',
  in: '∈', notin: '∉', subset: '⊂', subseteq: '⊆',
  cap: '∩', cup: '∪', sum: '∑', prod: '∏', int: '∫',
};

function toSubscript(str: string): string {
  let res = '';
  for (const ch of str) {
    res += unicodeSubscripts[ch] || ch;
  }
  return res;
}

function toSuperscript(str: string): string {
  let res = '';
  for (const ch of str) {
    res += unicodeSuperscripts[ch] || ch;
  }
  return res;
}

/**
 * Extracts content from balanced curly braces { ... } starting at startIdx
 */
function extractBalancedBrace(str: string, startIdx: number): { content: string; endIndex: number } | null {
  if (str[startIdx] !== '{') return null;
  let depth = 0;
  for (let i = startIdx; i < str.length; i++) {
    if (str[i] === '{') depth++;
    else if (str[i] === '}') {
      depth--;
      if (depth === 0) {
        return { content: str.slice(startIdx + 1, i), endIndex: i };
      }
    }
  }
  return null;
}

/**
 * Recursively replaces \frac{num}{den} with (num / den) preserving balanced braces
 */
function replaceFracWithBalanced(str: string): string {
  let s = str;
  let idx: number;
  while ((idx = s.indexOf('\\frac')) !== -1) {
    let cursor = idx + 5;
    while (cursor < s.length && /\s/.test(s[cursor])) cursor++;
    const numMatch = extractBalancedBrace(s, cursor);
    if (!numMatch) break;
    cursor = numMatch.endIndex + 1;
    while (cursor < s.length && /\s/.test(s[cursor])) cursor++;
    const denMatch = extractBalancedBrace(s, cursor);
    if (!denMatch) break;
    const num = replaceFracWithBalanced(numMatch.content.trim());
    const den = replaceFracWithBalanced(denMatch.content.trim());
    s = s.slice(0, idx) + `(${num} / ${den})` + s.slice(denMatch.endIndex + 1);
  }
  return s;
}

/**
 * Recursively replaces \sqrt{body} with √(body)
 */
function replaceSqrtWithBalanced(str: string): string {
  let s = str;
  let idx: number;
  while ((idx = s.indexOf('\\sqrt')) !== -1) {
    let cursor = idx + 5;
    let root = '';
    if (s[cursor] === '[') {
      const closeIdx = s.indexOf(']', cursor);
      if (closeIdx !== -1) {
        root = s.slice(cursor + 1, closeIdx) + ' ';
        cursor = closeIdx + 1;
      }
    }
    while (cursor < s.length && /\s/.test(s[cursor])) cursor++;
    const bodyMatch = extractBalancedBrace(s, cursor);
    if (!bodyMatch) break;
    const body = replaceSqrtWithBalanced(bodyMatch.content.trim());
    s = s.slice(0, idx) + `${root}√(${body})` + s.slice(bodyMatch.endIndex + 1);
  }
  return s;
}

/**
 * Formats a raw LaTeX mathematical expression into a clean Unicode string for WhatsApp
 */
export function formatEquationForWhatsApp(equation: string): string {
  let eq = equation.trim();
  if (!eq) return '';

  // Strip outer $$ or $ if present
  if (eq.startsWith('$$') && eq.endsWith('$$')) eq = eq.slice(2, -2).trim();
  else if (eq.startsWith('$') && eq.endsWith('$')) eq = eq.slice(1, -1).trim();
  else if (eq.startsWith('\\[') && eq.endsWith('\\]')) eq = eq.slice(2, -2).trim();
  else if (eq.startsWith('\\(') && eq.endsWith('\\)')) eq = eq.slice(2, -2).trim();

  // Clean escaped parentheses artifacts and internal line breaks
  eq = eq.replace(/\\([()])/g, '$1');
  eq = eq.replace(/\r?\n+/g, ' ');

  // 1. Text wrappers: \text{...}, \mathrm{...}, \mathbf{...}, \operatorname{...}
  eq = eq.replace(/\\(?:text|mathrm|mathbf|mathit|mathcal|mathbb|operatorname)\{([^}]+)\}/g, '$1');

  // 2. Delimiters: \left and \right
  eq = eq.replace(/\\left\s*([(\[{|])/g, '$1');
  eq = eq.replace(/\\right\s*([)\]}|])/g, '$1');
  eq = eq.replace(/\\left\./g, '');
  eq = eq.replace(/\\right\./g, '');

  // 3. Accents: \hat{x} -> x̂, \bar{x} -> x̄, \vec{x} -> x⃗
  eq = eq.replace(/\\hat\{([a-zA-Z])\}/g, '$1̂');
  eq = eq.replace(/\\hat\s+([a-zA-Z])/g, '$1̂');
  eq = eq.replace(/\\bar\{([a-zA-Z])\}/g, '$1̄');
  eq = eq.replace(/\\vec\{([a-zA-Z])\}/g, '$1⃗');

  // 4. Fractions & Square Roots
  eq = replaceFracWithBalanced(eq);
  eq = replaceSqrtWithBalanced(eq);

  // 5. Greek letters (sorted by name length descending so \theta is matched before \eta)
  // Use (?![a-zA-Z]) instead of \b because in LaTeX an underscore e.g. \theta_t is not a \b boundary!
  const sortedGreek = Object.entries(greekMap).sort((a, b) => b[0].length - a[0].length);
  for (const [name, sym] of sortedGreek) {
    const reg = new RegExp('\\\\' + name + '(?![a-zA-Z])', 'g');
    eq = eq.replace(reg, sym);
  }

  // 6. Math symbols & operators
  const sortedSymbols = Object.entries(symbolMap).sort((a, b) => b[0].length - a[0].length);
  for (const [name, sym] of sortedSymbols) {
    const reg = new RegExp('\\\\' + name + '(?![a-zA-Z])', 'g');
    eq = eq.replace(reg, sym);
  }

  // 7. Subscripts: _{t-1} -> ₜ₋₁, _t -> ₜ
  eq = eq.replace(/_\{([^{}]+)\}/g, (_, sub) => toSubscript(sub));
  eq = eq.replace(/_([0-9a-zA-Z])/g, (_, sub) => toSubscript(sub));

  // 8. Superscripts: ^{T} -> ᵀ, ^T -> ᵀ, ^2 -> ²
  eq = eq.replace(/\^\{([^{}]+)\}/g, (_, sup) => toSuperscript(sup));
  eq = eq.replace(/\^([0-9a-zA-Z+-])/g, (_, sup) => toSuperscript(sup));

  // 9. Clean spacing and punctuation
  eq = eq.replace(/\\,/g, ' ')
         .replace(/\\;/g, ' ')
         .replace(/\\quad/g, '  ')
         .replace(/\\qquad/g, '   ')
         .replace(/\\!/g, '')
         .replace(/\\{/g, '{')
         .replace(/\\}/g, '}');

  // 10. Strip remaining unrecognized backslash commands
  eq = eq.replace(/\\([a-zA-Z]+)/g, '$1');

  // 11. Normalize excessive whitespace
  eq = eq.replace(/\s{2,}/g, ' ').trim();

  return eq;
}

/**
 * Formats a full message body (containing Markdown & LaTeX) into WhatsApp-friendly formatting:
 * - Converts LaTeX math into clean Unicode math presented in WhatsApp monospace codeblocks
 * - Formats programming code blocks with clean language headers
 * - Formats Mermaid flowcharts and diagrams into WhatsApp-friendly codeblocks
 * - Converts Markdown headers (### ...) to WhatsApp *Bold*
 * - Converts Markdown bold (**...**) to WhatsApp *...*
 */
export function formatForWhatsApp(text: string): string {
  if (!text) return '';

  let res = text;

  // 1. Process Code Blocks and Diagrams FIRST
  const codeBlocks: string[] = [];
  res = res.replace(/(^|\n)```([a-zA-Z0-9_-]*)\s*([\s\S]*?)```(\n|$)/g, (_match, before, lang, codeContent, after) => {
    const trimmedCode = codeContent.trim();
    const l = (lang || '').toLowerCase().trim();
    let formattedBlock = '';
    if (l === 'mermaid') {
      formattedBlock = `${before}📊 *Diagram / Flowchart:*\n\`\`\`\n${trimmedCode}\n\`\`\`${after}`;
    } else if (l) {
      formattedBlock = `${before}💻 *Code (${l}):*\n\`\`\`\n${trimmedCode}\n\`\`\`${after}`;
    } else {
      formattedBlock = `${before}\`\`\`\n${trimmedCode}\n\`\`\`${after}`;
    }
    const placeholder = `\n%%%WA_CODE_${codeBlocks.length}%%%\n`;
    codeBlocks.push(formattedBlock.trim());
    return placeholder;
  });

  // 2. Protect existing Inline Code
  const inlineCodes: string[] = [];
  res = res.replace(/`[^`\n]+`/g, (match) => {
    const placeholder = `%%%WA_INLINE_CODE_${inlineCodes.length}%%%`;
    inlineCodes.push(match);
    return placeholder;
  });

  // 3. Convert Display Math: $$ ... $$ and \[ ... \] -> WhatsApp Codeblocks!
  res = res.replace(/\$\$([\s\S]+?)\$\$/g, (_, eq) => {
    const formatted = formatEquationForWhatsApp(eq);
    return `\n\`\`\`\n${formatted}\n\`\`\`\n`;
  });
  res = res.replace(/\\\[([\s\S]+?)\\\]/g, (_, eq) => {
    const formatted = formatEquationForWhatsApp(eq);
    return `\n\`\`\`\n${formatted}\n\`\`\`\n`;
  });

  // 4. Convert equations inside parentheses or preceded by colon:
  // e.g. "Adam ($\theta_t = ...$)" -> "Adam:\n```\nθₜ = ...\n```"
  res = res.replace(/\(\s*\$([^\$]+?)\$\s*\)/g, (_, eq) => {
    const formatted = formatEquationForWhatsApp(eq);
    if (/[=≠≈≤≥]/.test(eq) || /\\(?:frac|sqrt|sum|int)/.test(eq) || formatted.length > 20) {
      return `:\n\`\`\`\n${formatted}\n\`\`\``;
    }
    return `(\`${formatted}\`)`;
  });

  // 5. Convert Inline Math: $ ... $ and \( ... \)
  // Full equations or formulas with fractions/roots/equals -> wrap in dedicated codeblock!
  res = res.replace(/(^|[^\\])\$([^\$]+?)\$/g, (match, prefix, eq) => {
    // Keep financial / currency ($5, $10 billion)
    if (/^\s*\d+([.,]\d+)?(\s*(billion|million|k|m|b))?\s*$/i.test(eq)) {
      return match;
    }
    if (/\n\s*\n/.test(eq)) {
      return match;
    }

    const trimmed = eq.trim();
    const formatted = formatEquationForWhatsApp(trimmed);
    if (!formatted) return prefix;

    const isFullFormula = /[=≠≈≤≥]/.test(trimmed) ||
                          /\\(?:frac|sqrt|sum|prod|int|begin)/.test(trimmed) ||
                          formatted.length > 20;

    if (isFullFormula) {
      return `${prefix}\n\`\`\`\n${formatted}\n\`\`\`\n`;
    } else {
      return `${prefix}\`${formatted}\``;
    }
  });

  res = res.replace(/\\\(([\s\S]+?)\\\)/g, (_, eq) => {
    const formatted = formatEquationForWhatsApp(eq);
    if (/[=≠≈≤≥]/.test(eq) || formatted.length > 20) {
      return `\n\`\`\`\n${formatted}\n\`\`\`\n`;
    }
    return `\`${formatted}\``;
  });

  // 6. Convert Markdown headers to WhatsApp *Bold*
  res = res.replace(/^#{1,6}\s+(.+)$/gm, '*$1*');

  // 7. Convert **bold** to *bold* (WhatsApp uses single asterisk)
  res = res.replace(/\*\*(.*?)\*\*/g, '*$1*');

  // 8. Standardize list bullets
  res = res.replace(/^\*\s+/gm, '• ');

  // 9. Restore code blocks and inline code
  for (let i = 0; i < codeBlocks.length; i++) {
    res = res.replace(`%%%WA_CODE_${i}%%%`, codeBlocks[i]);
  }
  for (let i = 0; i < inlineCodes.length; i++) {
    res = res.replace(`%%%WA_INLINE_CODE_${i}%%%`, inlineCodes[i]);
  }

  // 10. Clean excessive blank lines (collapse 3+ newlines to 2)
  res = res.replace(/\n{3,}/g, '\n\n');

  return res.trim();
}
