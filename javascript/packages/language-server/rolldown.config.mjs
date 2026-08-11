// Bundle the LSP server entry point into a single CommonJS file.
// Exclude Node built-in so they remain as externals.
const external = [
  "path",
  "url",
  "fs",
  "module",
  "vscode-html-languageservice",
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

function allExternal(id) {
  if (id.includes(".")) return false

  return true
}

export default [
  // CLI entry point (CommonJS)
  {
    input: "src/herb-language-server.ts",
    output: {
      file: "dist/herb-language-server.js",
      format: "cjs",
      sourcemap: enableSourcemaps,
    },
    external: isExternal,
    platform: "node",
    resolve: { conditionNames: ["node", "import", "require", "default"] },
  },

  // Library exports (CommonJS)
  {
    input: "src/index.ts",
    output: {
      file: "dist/index.cjs",
      format: "cjs",
      sourcemap: enableSourcemaps,
    },
    external: allExternal,
  },
]
