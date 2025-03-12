import express from "express"

import { defineConfig } from "vite"
import { Herb } from "@herb-tools/node"
import { analyze } from "./src/analyze"

import type { Request, Response } from "express"

export default defineConfig({
  server: {
    port: process.env.PORT ? parseInt(process.env.PORT) : 5173,
    allowedHosts: ["playground.herb-tools.dev"],
  },
  plugins: [
    {
      name: "api-server",
      configureServer(server) {
        const app = express()

        app.use(express.text({ type: "*/*" }))

        app.post("/api/analyze", (request: Request, response: Response) => {
          try {
            return response.json(analyze(Herb, request.body))
          } catch (e) {
            console.error("Error in API route:", e)
            return response.status(500).json({
              error: e.message || "An error occurred during parsing",
            })
          }
        })

        server.middlewares.use(app)
      },
    },
  ],
})
