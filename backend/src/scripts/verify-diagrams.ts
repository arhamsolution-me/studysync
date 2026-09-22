import { DIAGRAM_CATALOG, DiagramTemplate } from '../modules/vector/diagram.catalog';
import { diagramVdb } from '../modules/vector/diagram.vdb';

interface ValidationResult {
  id: string;
  title: string;
  category: string;
  validHeader: boolean;
  noUnicodeArrows: boolean;
  noSingleArrows: boolean;
  properQuoting: boolean;
  passed: boolean;
  errors: string[];
}

export function validateDiagramTemplate(tpl: DiagramTemplate): ValidationResult {
  const errors: string[] = [];
  const code = tpl.diagramCode.trim();

  // 1. Header validation
  const validHeaders = ['flowchart', 'graph', 'erdiagram', 'sequencediagram', 'statediagram', 'classdiagram'];
  const firstLine = code.split('\n')[0].trim().toLowerCase();
  const validHeader = validHeaders.some((h) => firstLine.startsWith(h));
  if (!validHeader) {
    errors.push(`Invalid header: "${firstLine}". Must start with one of: ${validHeaders.join(', ')}`);
  }

  // 2. Unicode arrow check
  const hasUnicodeArrow = /[\u2192\u2794\u279C\u27A1\u21D2\u21E2\u2942\u2190\u21D0\u2194\u21D4]/.test(code);
  if (hasUnicodeArrow) {
    errors.push('Contains forbidden Unicode arrows (e.g. →, ⇒). Use standard Mermaid ASCII arrows (-->).');
  }

  // 3. Single dash arrow check (e.g. A -> B or Server -> Validate)
  const lines = code.split('\n');
  let hasSingleArrow = false;
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (l.trim().startsWith('%%') || l.trim().startsWith('style') || l.trim().startsWith('classDef')) continue;
    if (/(?:[^-=]|^)\s*->\s*/.test(l) && !l.includes('-->') && !l.includes('-.->') && !l.includes('==>')) {
      hasSingleArrow = true;
      errors.push(`Line ${i + 1} has single-dash arrow "->": "${l.trim()}". Must use double-dash "-->".`);
    }
  }

  // 4. Quotation check for complex labels
  let properQuoting = true;
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (l.trim().startsWith('style') || l.trim().startsWith('classDef') || l.trim().startsWith('subgraph')) continue;
    // Check unquoted emoji inside simple brackets
    if (/\[[^\n"']*[👤📱🖥️⚙️📝🆕📂🗄️📋🛒👨‍💼💾📤⚡🧠📚📄✂️🔬🏋️🔍🎯🤖📦🏷️📊🚀📈🖼️🔄🟦🟨🟩🔲🟧📉🚪📬🔑🔐🎫🛡️🚫✅🛑][^\n"']*\]/.test(l)) {
      properQuoting = false;
      errors.push(`Line ${i + 1} has unquoted emoji label: "${l.trim()}". Must be quoted e.g. ["👤 User"].`);
    }
  }

  const passed = errors.length === 0;

  return {
    id: tpl.id,
    title: tpl.title,
    category: tpl.category,
    validHeader,
    noUnicodeArrows: !hasUnicodeArrow,
    noSingleArrows: !hasSingleArrow,
    properQuoting,
    passed,
    errors,
  };
}

export function runDiagramTestSuite(): { total: number; passed: number; failed: number; results: ValidationResult[] } {
  console.log('═══════════════════════════════════════════════════════════════════════════');
  console.log('   DIAGRAM VECTOR DATABASE (VDB) — AUTOMATED VERIFICATION SUITE');
  console.log('═══════════════════════════════════════════════════════════════════════════\n');

  const templates = diagramVdb.getAllTemplates();
  const results: ValidationResult[] = [];

  for (const tpl of templates) {
    const res = validateDiagramTemplate(tpl);
    results.push(res);
    const badge = res.passed ? '✅ PASS' : '❌ FAIL';
    console.log(`${badge} [${tpl.category}] ${tpl.title} (${tpl.id})`);
    if (!res.passed) {
      for (const err of res.errors) {
        console.log(`      ⚠️  ${err}`);
      }
    }
  }

  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;

  console.log('\n───────────────────────────────────────────────────────────────────────────');
  console.log(`TOTAL TEMPLATES TESTED : ${templates.length}`);
  console.log(`PASSED (100% READY)    : ${passed}`);
  console.log(`FAILED                 : ${failed}`);
  console.log('───────────────────────────────────────────────────────────────────────────\n');

  return {
    total: templates.length,
    passed,
    failed,
    results,
  };
}

// If executed directly via ts-node
if (require.main === module) {
  const summary = runDiagramTestSuite();
  if (summary.failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}
