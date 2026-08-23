import { createRequire } from "module"

// Bundle the CLI entry point into a single CommonJS file.
// Exclude Node built-in so they remain as externals.
const external = [
  "path",
  "url",
  "fs",
  "module",
  "os",
  "worker_threads",
  "node:path",
  "node:url",
  "node:fs",
  "node:os",
  "node:worker_threads",
]

const { dependencies } = createRequire(import.meta.url)("./package.json")
const runtimeDependencies = Object.keys(dependencies ?? {})

function isExternal(id) {
  return [...external, ...runtimeDependencies].some(
    (pkg) => id === pkg || id.startsWith(pkg + "/")
  )
}

export default [
  // CLI entry point (CommonJS)
  {
    input: "src/herb-lint.ts",
    output: {
      file: "dist/herb-lint.js",
      format: "cjs",
      sourcemap: true,
    },
    external: isExternal,
  },

  // Lint worker entry point (CommonJS - used by worker_threads)
  {
    input: "src/cli/lint-worker.ts",
    output: {
      file: "dist/lint-worker.js",
      format: "cjs",
      sourcemap: true,
    },
    external: isExternal,
  },

  // Library exports (ESM)
  {
    input: "src/index.ts",
    output: {
      file: "dist/index.js",
      format: "esm",
      sourcemap: true,
    },
    external: isExternal,
  },

  // Library exports (CommonJS)
  {
    input: "src/index.ts",
    output: {
      file: "dist/index.cjs",
      format: "cjs",
      sourcemap: true,
    },
    external: isExternal,
  },

  // CLI library exports (ESM)
  {
    input: "src/cli.ts",
    output: {
      file: "dist/cli.js",
      format: "esm",
      sourcemap: true,
    },
    external: isExternal,
  },

  // Loader entry point (includes custom rule loader)
  {
    input: "src/loader.ts",
    output: {
      file: "dist/loader.js",
      format: "esm",
      sourcemap: true,
    },
    external: isExternal,
  },
  {
    input: "src/loader.ts",
    output: {
      file: "dist/loader.cjs",
      format: "cjs",
      sourcemap: true,
    },
    external: isExternal,
  },
]
