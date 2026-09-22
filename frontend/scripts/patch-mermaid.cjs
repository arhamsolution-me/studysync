const fs = require('fs');
const path = require('path');

const targetFiles = [
  'node_modules/.vite/deps/chunk-75Z2AOVW-DW4oQnpZ.js',
  'node_modules/mermaid/dist/mermaid.js',
  'node_modules/mermaid/dist/mermaid.min.js',
  'node_modules/mermaid/dist/chunks/mermaid.core/chunk-75Z2AOVW.mjs',
  'node_modules/mermaid/dist/chunks/mermaid.esm/chunk-TYR5776D.mjs',
  'node_modules/mermaid/dist/chunks/mermaid.esm.min/chunk-VY2OSTJR.mjs',
];

const frontendDir = path.resolve(__dirname, '..');

let totalPatched = 0;

for (const relPath of targetFiles) {
  const fullPath = path.join(frontendDir, relPath);
  if (!fs.existsSync(fullPath)) {
    console.log(`Skipping (not found): ${relPath}`);
    continue;
  }

  let content = fs.readFileSync(fullPath, 'utf8');

  // Search for the error throw
  const errorNeedle = 'throw new Error("Could not find a suitable point for the given distance")';
  const fallbackSafe = 'return prevPoint || (points && points.length ? points[points.length - 1] : { x: 0, y: 0 })';

  // Also handle minified variations where variables might be named differently (e.g. t, r, o, e, i)
  // In chunk-VY2OSTJR.mjs:
  // o=i}throw new Error("Could not find a suitable point for the given distance")}
  // -> o=i}return o || (t && t.length ? t[t.length - 1] : { x: 0, y: 0 })}
  if (content.includes(errorNeedle)) {
    // Check if this is chunk-VY2OSTJR or chunk-75Z2AOVW where variable names differ:
    if (relPath.includes('chunk-VY2OSTJR.mjs')) {
      content = content.replace(
        'o=i}throw new Error("Could not find a suitable point for the given distance")',
        'o=i}return o || (t && t.length ? t[t.length - 1] : { x: 0, y: 0 })'
      );
    } else if (relPath.includes('mermaid.min.js')) {
      content = content.replace(
        'r=i}throw new Error("Could not find a suitable point for the given distance")',
        'r=i}return r || (e && e.length ? e[e.length - 1] : { x: 0, y: 0 })'
      );
    } else {
      content = content.replaceAll(errorNeedle, fallbackSafe);
    }

    fs.writeFileSync(fullPath, content, 'utf8');
    console.log(`Successfully patched: ${relPath}`);
    totalPatched++;
  } else {
    console.log(`Already patched or needle not found: ${relPath}`);
  }
}

// Also scan any other chunk in .vite/deps that might contain it
const viteDepsDir = path.join(frontendDir, 'node_modules/.vite/deps');
if (fs.existsSync(viteDepsDir)) {
  const files = fs.readdirSync(viteDepsDir);
  for (const f of files) {
    if (f.endsWith('.js')) {
      const p = path.join(viteDepsDir, f);
      let c = fs.readFileSync(p, 'utf8');
      if (c.includes('throw new Error("Could not find a suitable point for the given distance")')) {
        c = c.replaceAll(
          'throw new Error("Could not find a suitable point for the given distance")',
          'return prevPoint || (points && points.length ? points[points.length - 1] : { x: 0, y: 0 })'
        );
        fs.writeFileSync(p, c, 'utf8');
        console.log(`Patched extra vite chunk: ${f}`);
        totalPatched++;
      }
    }
  }
}

console.log(`Done! Patched ${totalPatched} files.`);
