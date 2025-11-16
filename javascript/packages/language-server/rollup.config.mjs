import typescript from "@rollup/plugin-typescript"
import { nodeResolve } from "@rollup/plugin-node-resolve"
import json from "@rollup/plugin-json"
import commonjs from "@rollup/plugin-commonjs"

// Bundle the LSP server entry point into a single CommonJS file.
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
    plugins: [
      nodeResolve(),
      commonjs(),
      json(),
      typescript({
        tsconfig: "./tsconfig.json",
        rootDir: "src/",
        module: "esnext",
      }),
    ],
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
    plugins: [
      nodeResolve(),
      commonjs(),
      json(),
      typescript({
        tsconfig: "./tsconfig.json",
        rootDir: "src/",
        module: "esnext",
      }),
    ],
  },
]
