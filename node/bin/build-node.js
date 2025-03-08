import * as esbuild from 'esbuild';

await esbuild.build({
  entryPoints: ['./dist/node/node/index.js'],
  bundle: true,
  format: 'esm',
  outfile: './dist/node/node/index.js',
  platform: 'node',
  external: ['node-addon-api', 'fs', 'path', 'url'],
  conditions: ['import'],
  target: ['es2020'],
  allowOverwrite: true
});

await esbuild.build({
  entryPoints: ['./dist/node/node/index.js'],
  bundle: true,
  format: 'cjs',
  outfile: './dist/node/node/index.cjs',
  platform: 'node',
  external: ['node-addon-api', 'fs', 'path']
});
