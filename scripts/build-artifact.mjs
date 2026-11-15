// Build a self-contained page for hosting as a claude.ai Artifact (or any static host with a strict CSP):
// one HTML fragment with inlined CSS + JS, plus the sample structures as separate files.
// usage: node scripts/build-artifact.mjs  → dist-artifact/molart.html, dist-artifact/samples/*
import { build } from 'vite';
import { cpSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'dist-artifact');
const TMP = join(OUT, '.vite');
rmSync(OUT, { recursive: true, force: true });
await build({
  root: ROOT,
  logLevel: 'error',
  base: './',
  publicDir: false,
  build: {
    outDir: TMP,
    target: 'es2022',
    cssCodeSplit: false,
    assetsInlineLimit: 1e8,
    rollupOptions: { output: { inlineDynamicImports: true, entryFileNames: 'molart.js', assetFileNames: 'molart[extname]' } },
  },
});
const js = readFileSync(join(TMP, 'molart.js'), 'utf8');
const css = readFileSync(join(TMP, 'molart.css'), 'utf8');
if (/<\/script/i.test(js)) throw new Error('bundle contains </script>; cannot inline safely');
const html = `<title>molart</title>
<meta name="description" content="Artist-inspired renderings of real protein structures">
<style>
${css}
</style>
<div id="app"></div>
<script type="module">
${js}
</script>
`;
mkdirSync(join(OUT, 'samples'), { recursive: true });
writeFileSync(join(OUT, 'molart.html'), html);
for (const f of readdirSync(join(ROOT, 'public/samples'))) if (f.endsWith('.cif')) cpSync(join(ROOT, 'public/samples', f), join(OUT, 'samples', f));
rmSync(TMP, { recursive: true, force: true });
console.log(`dist-artifact/molart.html ${(html.length / 1024).toFixed(0)} KB + ${readdirSync(join(OUT, 'samples')).length} samples`);
