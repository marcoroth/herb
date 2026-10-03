import { execSync } from "node:child_process"

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
const isDevBuild = !isCI && !isReleaseBuild

function git(command) {
  try {
    const output = execSync(`git ${command}`, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim()

    return output === "" ? null : output
  } catch {
    return null
  }
}

function buildRef() {
  const branch = git("rev-parse --abbrev-ref HEAD")

  if (branch && branch !== "HEAD") return branch

  return git("rev-parse --short HEAD")
}

function buildTimestamp() {
  const now = new Date()
  const pad = (value) => String(value).padStart(2, "0")

  const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
  const time = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`

  return `${date} ${time}`
}

function buildMetadata() {
  if (!isDevBuild) return null

  return [buildRef(), buildTimestamp()].filter(Boolean).join(", ")
}

const transform = {
  define: {
    __HERB_BUILD_METADATA__: JSON.stringify(buildMetadata()),
  },
}

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
    transform,
    external: isExternal,
    platform: "node",
    resolve: { conditionNames: ["node", "import", "require", "default"] },
  },

  // Library exports (ESM)
  {
    input: "src/index.ts",
    output: {
      file: "dist/index.js",
      format: "esm",
      sourcemap: enableSourcemaps,
    },
    transform,
    external: allExternal,
  },

  // Library exports (CommonJS)
  {
    input: "src/index.ts",
    output: {
      file: "dist/index.cjs",
      format: "cjs",
      sourcemap: enableSourcemaps,
    },
    transform,
    external: allExternal,
  },
]
