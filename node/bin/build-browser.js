import * as esbuild from 'esbuild';

await esbuild.build({
  entryPoints: ['./dist/browser/browser/index.js'],
  bundle: true,
  format: 'esm',
  outfile: './dist/browser/browser/index.js',
  platform: 'browser',
  minify: true,
  allowOverwrite: true
});

await esbuild.build({
  entryPoints: ['./dist/browser/browser/index.js'],
  bundle: true,
  format: 'iife',
  globalName: 'Herb',
  outfile: './dist/browser/browser/herb-tools.min.js',
  platform: 'browser',
  minify: true
});
