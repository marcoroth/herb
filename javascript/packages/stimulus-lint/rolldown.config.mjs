import { createRequire } from "module"

const { dependencies } = createRequire(import.meta.url)("./package.json")

const external = [
  "path",
  "url",
  "fs",
  "module",
  ...Object.keys(dependencies ?? {}),
]

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
    external: isExternal,
  },

  // Library exports (CommonJS)
  {
    input: "src/index.ts",
    external: isExternal,
    output: {
      file: "dist/index.cjs",
      format: "cjs",
      sourcemap: enableSourcemaps,
    },
  },
]
