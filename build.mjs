#!/usr/bin/env node
import { build, context } from 'esbuild';
import { mkdirSync, copyFileSync } from 'node:fs';

const watch = process.argv.includes('--watch');
const outdir = 'dist';
mkdirSync(outdir, { recursive: true });

const entries = [
  { in: 'src/background/service-worker.ts', out: 'dist/background/service-worker.js' },
  { in: 'src/content/content-script.ts',   out: 'dist/content/content-script.js' },
];

const shared = {
  bundle: true,
  format: 'iife',
  target: 'es2022',
  platform: 'browser',
  sourcemap: 'inline',
  define: { __REPAINT_VERSION__: JSON.stringify(process.env.npm_package_version ?? '0.0.0') },
};

if (watch) {
  for (const e of entries) {
    const ctx = await context({ ...shared, entryPoints: [e.in], outfile: e.out });
    await ctx.watch();
  }
  console.log('[build] watching…');
} else {
  await Promise.all(entries.map(e => build({ ...shared, entryPoints: [e.in], outfile: e.out })));
  copyFileSync('manifest.json', `${outdir}/manifest.json`);
  console.log('[build] done');
}
