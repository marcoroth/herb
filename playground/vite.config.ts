import { defineConfig } from "vite"
import { execSync } from "child_process"

function getCommitInfo() {
  try {
    const hash = execSync("git rev-parse --short HEAD", { encoding: "utf8" }).trim()
    const tag = execSync("git describe --tags --abbrev=0", { encoding: "utf8" }).trim()
    const commitsAhead = execSync(`git rev-list --count ${tag}..HEAD`, { encoding: "utf8" }).trim()

    return {
      hash,
      tag,
      ahead: parseInt(commitsAhead, 10)
    }
  } catch (error) {
    console.warn("Could not get git commit info:", error)
    return {
      hash: "unknown",
      tag: "unknown",
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
  plugins: [
    // {
    //   name: "api-server",
    //   configureServer(server) {
    //     const app = express()
    //
    //     app.use(express.text({ type: "*/*" }))
    //
    //     app.post("/api/analyze", (request: Request, response: Response) => {
    //       try {
    //         // return response.json(analyze(Herb, request.body))
    //         return response.json({})
    //       } catch (e) {
    //         console.error("Error in API route:", e)
    //         return response.status(500).json({
    //           error: e.message || "An error occurred during parsing",
    //         })
    //       }
    //     })
    //
    //     server.middlewares.use(app)
    //   },
    // },
  ],
})
