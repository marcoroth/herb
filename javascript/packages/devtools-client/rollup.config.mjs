import typescript from '@rollup/plugin-typescript';

export default [
  // CommonJS build
  {
    input: 'src/index.ts',
    output: {
      file: 'dist/index.js',
      format: 'cjs',
      sourcemap: true,
      exports: 'named'
    },
    plugins: [
      typescript({
        tsconfig: './tsconfig.json',
        declaration: true,
        declarationDir: './dist',
        rootDir: './src'
      })
    ]
  },
  // ESM build
  {
    input: 'src/index.ts',
    output: {
      file: 'dist/index.esm.js',
      format: 'esm',
      sourcemap: true
    },
    plugins: [
      typescript({
        tsconfig: './tsconfig.json',
        declaration: false
      })
    ]
  },
  // UMD build for direct browser inclusion
  {
    input: 'src/index.ts',
    output: {
      file: 'dist/herb-devtools-client.js',
      format: 'umd',
      name: 'HerbDevToolsClient',
      sourcemap: true
    },
    plugins: [
      typescript({
        tsconfig: './tsconfig.json',
        declaration: false
      })
    ]
  }
];
