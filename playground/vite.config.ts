import { defineConfig } from "vite"
import { execSync } from "child_process"

function getCommitInfo() {
  let hash = "unknown"
  let tag = "unknown"
  let ahead = 0

  try {
    try {
      hash = execSync("git rev-parse --short HEAD", { encoding: "utf8" }).trim()
    } catch (hashError) {
      if (process.env.GITHUB_SHA) {
        hash = process.env.GITHUB_SHA.substring(0, 7)
      }
    }

    try {
      execSync("git fetch --tags --force", { stdio: 'ignore' })
      tag = execSync("git describe --tags --abbrev=0", { encoding: "utf8" }).trim()

      try {
        const aheadOutput = execSync(`git rev-list --count ${tag}..HEAD`, { encoding: "utf8" }).trim()
        ahead = parseInt(aheadOutput, 10) || 0
      } catch (countError) {
        console.warn("Could not count commits ahead:", countError.message)
      }
    } catch (tagError) {
      console.warn("Could not get git tag info:", tagError.message)

      if (process.env.GITHUB_REF) {
        if (process.env.GITHUB_REF.startsWith('refs/tags/')) {
          tag = process.env.GITHUB_REF.replace('refs/tags/', '')
          ahead = 0
        } else if (process.env.GITHUB_REF_NAME) {
          tag = process.env.GITHUB_REF_NAME
        }
      }
    }

    console.log(`Git info: hash=${hash}, tag=${tag}, ahead=${ahead}`)
    return { hash, tag, ahead }
  } catch (error) {
    console.warn("Could not get git commit info:", error.message)
    return {
      hash: process.env.GITHUB_SHA?.substring(0, 7) || "unknown",
      tag: process.env.GITHUB_REF_NAME || "unknown",
      ahead: 0
    }
  }
}

export default defineConfig({
  define: {
    __COMMIT_INFO__: JSON.stringify(getCommitInfo()),
  },
  server: {
    port: process.env.PORT ? parseInt(process.env.PORT) : 5173,
    allowedHosts: ["playground.herb-tools.dev"],
  },
  plugins: [],
})
