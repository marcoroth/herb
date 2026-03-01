import { defineConfig } from "vite"
import { execSync } from "child_process"

function getCommitInfo() {
  let hash = "unknown"
  let tag = "unknown"
  let ahead = 0
  let prNumber = null

  const isGitHubActions = process.env.GITHUB_ACTIONS === 'true'

  if (isGitHubActions) {
    if (process.env.GITHUB_EVENT_NAME === 'pull_request' && process.env.GITHUB_PR_HEAD_SHA) {
      hash = process.env.GITHUB_PR_HEAD_SHA.substring(0, 8)
      prNumber = process.env.GITHUB_PR_NUMBER
      tag = `PR #${prNumber}`
      ahead = 0
      console.log(`GitHub Actions PR build: hash=${hash}, PR=${prNumber}`)
    } else {
      hash = process.env.GITHUB_SHA?.substring(0, 8) || "unknown"
    }

    if (process.env.GITHUB_REF?.startsWith('refs/tags/')) {
      tag = process.env.GITHUB_REF.replace('refs/tags/', '')
      ahead = 0
      console.log(`GitHub Actions tag build: hash=${hash}, tag=${tag}`)
    } else {
      tag = process.env.GITHUB_REF_NAME || "unknown"
      ahead = 0
      console.log(`GitHub Actions branch build: hash=${hash}, ref=${tag}`)
    }

    return { hash, tag, ahead, prNumber }
  }

  try {
    hash = execSync("git rev-parse --short=8 HEAD", { encoding: "utf8" }).trim()

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
      tag = "dev"
    }

    console.log(`Local build: hash=${hash}, tag=${tag}, ahead=${ahead}`)
  } catch (error) {
    console.warn("Could not get git commit info:", error.message)
    hash = "unknown"
    tag = "unknown"
  }

  return { hash, tag, ahead, prNumber }
}

export default defineConfig({
  define: {
    __COMMIT_INFO__: JSON.stringify(getCommitInfo()),
  },
  server: {
    port: process.env.PORT ? parseInt(process.env.PORT) : 5173
  },
  plugins: [],
})
