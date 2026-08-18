// Bundle the CLI entry point into a single CommonJS file.
// Exclude Node built-in so they remain as externals.
const external = [
  "path",
  "url",
  "fs",
  "module",
]

// Enable sourcemaps for local builds and release builds
// Disable for CI non-release builds (PR previews, etc.)
const isCI = process.env.CI === "true"
const isReleaseBuild = process.env.RELEASE_BUILD === "true"
const enableSourcemaps = !isCI || isReleaseBuild

function isExternal(id) {
  return (
    external.includes(id) ||
    external.some((pkg) => id === pkg || id.startsWith(pkg + "/"))
  )
}

export default [
  // CLI entry point (CommonJS)
  {
    input: "src/stimulus-lint.ts",
    output: {
      file: "dist/stimulus-lint.js",
      format: "cjs",
      sourcemap: enableSourcemaps,
    },
    external: isExternal,
  },

  // Library exports (ESM)
  {
    input: "src/index.ts",
    output: {
      file: "dist/index.js",
      format: "esm",
      sourcemap: enableSourcemaps,
    },
    external: ["@herb-tools/core", "@herb-tools/highlighter", "@herb-tools/linter", "@herb-tools/node-wasm", "stimulus-parser"],
  },

  // Library exports (CommonJS)
  {
    input: "src/index.ts",
    external: ["@herb-tools/core", "@herb-tools/highlighter", "@herb-tools/linter", "@herb-tools/node-wasm", "stimulus-parser"],
    output: {
      file: "dist/index.cjs",
      format: "cjs",
      sourcemap: enableSourcemaps,
    },
  },
]
