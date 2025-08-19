import { defineConfig } from 'rollup';
import typescript from '@rollup/plugin-typescript';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';

const commonPlugins = [
  resolve({
    browser: true,
    preferBuiltins: false
  }),
  commonjs(),
  json(),
  typescript({
    declaration: false,
    declarationDir: undefined,
    sourceMap: true,
    inlineSources: false
  })
];

export default defineConfig([
  // Background service worker
  {
    input: 'src/background.ts',
    output: {
      file: 'dist/background.js',
      format: 'iife',
      sourcemap: true
    },
    plugins: commonPlugins
  },
  // Content script
  {
    input: 'src/content-script.ts',
    output: {
      file: 'dist/content-script.js',
      format: 'iife',
      sourcemap: true
    },
    plugins: commonPlugins
  },
  // Injected script (runs in page context)
  {
    input: 'src/injected-script.ts',
    output: {
      file: 'dist/injected-script.js',
      format: 'iife',
      sourcemap: true
    },
    plugins: commonPlugins
  },
  // DevTools main page
  {
    input: 'src/devtools/devtools.ts',
    output: {
      file: 'dist/devtools/devtools.js',
      format: 'iife',
      sourcemap: true
    },
    plugins: commonPlugins
  },
  // DevTools panel
  {
    input: 'src/devtools/panel.ts',
    output: {
      file: 'dist/devtools/panel.js',
      format: 'iife',
      sourcemap: true
    },
    plugins: commonPlugins
  }
]);