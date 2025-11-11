import { Herb } from '@herb-tools/node-wasm'
import packageJson from '../package.json'

await Herb.load()

globalThis.__herb_version = packageJson.version

Bun.plugin({
  name: 'bundle-herb-apis',
  target: 'bun',
  async setup(build) {
    let bundled = {
      '@herb-tools/core': await import('@herb-tools/core'),
      '@herb-tools/linter': await import('@herb-tools/linter'),
      '@herb-tools/formatter': await import('@herb-tools/formatter'),
      '@herb-tools/printer': await import('@herb-tools/printer'),
      '@herb-tools/highlighter': await import('@herb-tools/highlighter'),
      '@herb-tools/node-wasm': await import('@herb-tools/node-wasm'),
    }

    for (let [id, exports] of Object.entries(bundled)) {
      build.module(id, () => ({
        loader: 'object',
        exports: { ...exports, __esModule: true }
      }))
    }
  }
})

await import('@herb-tools/cli/src/index.ts')
