const esbuild = require("esbuild")
const { copy } = require("esbuild-plugin-copy")

const production = process.argv.includes('--production')
const watch = process.argv.includes('--watch')

/**
 * @type {import('esbuild').Plugin}
 */
const esbuildProblemMatcherPlugin = {
  name: 'esbuild-problem-matcher',

  setup(build) {
    build.onStart(() => {
      console.log('[watch] build started')
    })
    build.onEnd((result) => {
      result.errors.forEach(({ text, location }) => {
        console.error(`✘ [ERROR] ${text}`)
        console.error(`    ${location.file}:${location.line}:${location.column}:`)
      })
      console.log('[watch] build finished')
    })
  },
}

// Banner to shim import.meta.url for CJS compatibility
// This is needed because some ESM dependencies (like fdir used by tinyglobby)
// use import.meta.url with createRequire, which breaks when bundled to CJS
const importMetaBanner = `
var import_meta_url = typeof document === 'undefined' ? require('url').pathToFileURL(__filename).href : (document.currentScript && document.currentScript.src || new URL('extension.js', document.baseURI).href);
`

async function main() {
  const ctx = await esbuild.context({
    entryPoints: [
      'src/extension.ts'
    ],
    bundle: true,
    format: 'cjs',
    minify: production,
    sourcemap: !production,
    sourcesContent: false,
    platform: 'node',
    outfile: 'dist/extension.js',
    external: ['vscode'],
    logLevel: 'silent',
    banner: {
      js: importMetaBanner,
    },
    define: {
      'import.meta.url': 'import_meta_url',
    },
    plugins: [
      esbuildProblemMatcherPlugin,
      copy({
        assets: [
          { from: '../language-server/dist/herb-language-server.js', to: ['herb-language-server.js'] },
        ],
      })
    ],
  })

  const workerCtx = await esbuild.context({
    entryPoints: ['src/parse-worker.js'],
    bundle: true,
    format: 'cjs',
    minify: production,
    sourcemap: !production,
    sourcesContent: false,
    platform: 'node',
    outfile: 'dist/parse-worker.js',
    external: [],
    logLevel: 'silent',
    banner: {
      js: importMetaBanner,
    },
    define: {
      'import.meta.url': 'import_meta_url',
    },
  })

  if (watch) {
    await ctx.watch()
    await workerCtx.watch()
  } else {
    await ctx.rebuild()
    await workerCtx.rebuild()
    await ctx.dispose()
    await workerCtx.dispose()
  }
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})
