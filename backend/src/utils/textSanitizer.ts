/**
 * textSanitizer.ts
 * Cleans Windows-1252/ISO-8859-1 Mojibake artifacts and repairs cutoff math formulas in RAG chunks.
 */

export const MOJIBAKE_MAP: Record<string, string> = {
  'â€“': '–', // en-dash
  'â€”': '—', // em-dash
  'â€˜': "'", // left single quote
  'â€™': "'", // right single quote
  'â€œ': '"', // left double quote
  'â€\u009d': '"', // right double quote
  'â€ ': '"',
  'â€¦': '…', // horizontal ellipsis
  'â€¢': '•', // bullet
  'â‰¥': '≥', // greater than or equal
  'â‰¤': '≤', // less than or equal
  'â‰': '≠',  // not equal
  'Ã—': '×',  // multiplication
  'Ã·': '÷',  // division
  'Ã±': '±',  // plus-minus
  'Â±': '±',
  'Â°': '°',  // degree
  'Â': ' ',
  'âˆž': '∞', // infinity
  'âˆš': '√', // square root
  'âˆ‘': '∑', // sum
  'âˆ«': '∫', // integral
  'âˆ‚': '∂', // partial derivative
  'âˆ†': '∇', // nabla / gradient
  'âˆˆ': '∈', // element of
  'â†’': '→', // right arrow
  'â‡’': '⇒', // implies
  'â‡”': '⇔', // iff
};

/**
 * Replace common UTF-8 misinterpreted as Windows-1252 mojibake artifacts.
 */
export function cleanMojibake(text: string): string {
  if (!text) return '';
  let cleaned = text;
  for (const [bad, good] of Object.entries(MOJIBAKE_MAP)) {
    if (cleaned.includes(bad)) {
      cleaned = cleaned.split(bad).join(good);
    }
  }
  return cleaned;
}

/**
 * Repairs math delimiters ($$ and $) when text chunks cut through formulas.
 * Prevents inverted math matching where normal text is treated as math and formulas as text.
 */
export function repairChunkMathDelimiters(rawText: string): string {
  if (!rawText) return '';
  let cleaned = cleanMojibake(rawText);

  // 1. Detect if chunk begins with an orphan closing equation (e.g. h_{t-1}} = ... W_{hh}^T$$)
  const firstDollarIdx = cleaned.indexOf('$$');
  if (firstDollarIdx !== -1) {
    const beforeFirst = cleaned.slice(0, firstDollarIdx).trim();
    // If the text before the first $$ has math indicators (=, \prod, \frac, \text, _, ^) and no English sentence punctuation
    const isMathFormulaFragment =
      /(=|\\prod|\\frac|\\sum|\\text|_\{|\^|\\sqrt|\\alpha|\\beta|\\gamma|\\partial)/.test(beforeFirst) &&
      !/[.!?]\s+[A-Z]/.test(beforeFirst);

    if (isMathFormulaFragment) {
      // Fix unbalanced closing braces in cutoff fragment, e.g. h_{t-1}} -> h_{t-1}
      let openBraces = (beforeFirst.match(/\{/g) || []).length;
      let closeBraces = (beforeFirst.match(/\}/g) || []).length;
      let balancedBefore = beforeFirst;
      while (closeBraces > openBraces && balancedBefore.includes('}}')) {
        balancedBefore = balancedBefore.replace('}}', '}');
        closeBraces--;
      }
      cleaned = `$$\\dots ${balancedBefore}$$` + cleaned.slice(firstDollarIdx + 2);
    }
  }

  // 2. Detect if chunk ends with an orphan opening equation (e.g. ... Sim(u, v) = $$ \text{Sim}(u,)
  const lastDollarIdx = cleaned.lastIndexOf('$$');
  if (lastDollarIdx !== -1) {
    const count = (cleaned.match(/\$\$/g) || []).length;
    if (count % 2 !== 0) {
      // Odd number of $$: the last one is an opening $$ without a closing delimiter
      cleaned = cleaned.trimEnd() + ' \\dots$$';
    }
  }

  // 3. Balance single $ delimiters if an odd count exists
  const singleDollarCount = (cleaned.replace(/\$\$/g, '').match(/\$/g) || []).length;
  if (singleDollarCount % 2 !== 0) {
    if (cleaned.endsWith('$')) {
      cleaned = cleaned.slice(0, -1);
    } else if (cleaned.startsWith('$')) {
      cleaned = cleaned.slice(1);
    } else {
      const lastSingle = cleaned.lastIndexOf('$');
      if (lastSingle > cleaned.length - 25) {
        cleaned = cleaned.slice(0, lastSingle) + cleaned.slice(lastSingle + 1);
      }
    }
  }

  return cleaned;
}
