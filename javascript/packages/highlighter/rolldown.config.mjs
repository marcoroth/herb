import { createRequire } from "module"

// Bundle the CLI entry point into a single CommonJS file.
// Exclude Node built-in so they remain as externals.
const external = ["path", "url", "fs", "module"]

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
    input: "src/herb-highlight.ts",
    output: {
      file: "dist/herb-highlight.js",
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
]
