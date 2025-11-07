import dedent from "dedent"
import pc from "picocolors"

import * as fs from "fs/promises"
import * as path from "path"
import * as http from "http"

let compressToEncodedURIComponent: (string: string) => string

async function loadLZString() {
  if (!compressToEncodedURIComponent) {
    const LZString = await import("lz-string")
    compressToEncodedURIComponent = LZString.default.compressToEncodedURIComponent || LZString.compressToEncodedURIComponent
  }
}

const PLAYGROUND_BASE_URL = "https://herb-tools.dev/playground"

export class CLI {
  async run() {
    const args = process.argv.slice(2)

    if (args[0] === "playground") {
      args.shift()
    }

    const subcommand = args[0]

    if (subcommand === "start") {
      await this.startServer(args.slice(1))
      return
    }

    if (args.includes("--help") || args.includes("-h")) {
      this.showHelp()
      return
    }

    if (args.includes("--version") || args.includes("-v")) {
      console.log((await import("@herb-tools/cli/package.json")).version)
      return
    }

    const nonOptionArgs = args.filter(arg => !arg.startsWith("-"))
    const inputFile = nonOptionArgs[0]

    let input: string
    let fromStdin = false

    if (inputFile && inputFile !== "-") {
      // Read from file
      try {
        input = await fs.readFile(inputFile, "utf-8")
      } catch (error) {
        console.error(pc.red(`✗ Error reading file: ${inputFile}`))
        console.error(error instanceof Error ? error.message : String(error))
        process.exit(1)
      }
    } else if (process.stdin.isTTY) {
      console.log(pc.yellow("⚠ No input provided"))
      console.log()

      this.showHelp()

      process.exit(1)
    } else {
      fromStdin = true

      const chunks: Buffer[] = []

      for await (const chunk of process.stdin) {
        chunks.push(chunk)
      }

      input = Buffer.concat(chunks).toString("utf-8")
    }

    if (!input || input.trim().length === 0) {
      console.error(pc.red("✗ No input provided"))
      console.error(`Run ${pc.cyan("herb playground --help")} for usage information`)
      process.exit(1)
    }

    try {
      await loadLZString()

      const compressed = compressToEncodedURIComponent(input)
      const playgroundUrl = `${PLAYGROUND_BASE_URL}#${compressed}`

      if (inputFile && inputFile !== "-") {
        console.log(pc.green("✓") + " Generated playground URL from " + pc.cyan(inputFile))
      } else if (fromStdin) {
        console.log(pc.green("✓") + " Generated playground URL from stdin")
      }

      console.log()
      console.log(pc.dim("Share this URL to share your template:"))
      console.log(pc.cyan(playgroundUrl))

      if (args.includes("--open") || args.includes("-o")) {
        console.log()

        const { default: open } = await import("open")
        await open(playgroundUrl)

        console.log(pc.green("✓") + " Opened playground in your browser")
      }
    } catch (error) {
      console.error(pc.red("✗ Error creating playground URL:"))
      console.error(error instanceof Error ? error.message : String(error))
      process.exit(1)
    }
  }

  private async startServer(args: string[]) {
    try {
      const cwd = process.cwd()
      const moduleDir = path.dirname(new URL(import.meta.url).pathname)

      const possiblePaths = [
        path.join(moduleDir, "../../playground"),
        path.resolve(moduleDir, "../../playground"),
        path.join(cwd, "playground/dist"),
        path.join(cwd, "../playground/dist"),
        path.join(cwd, "../../playground/dist"),
        path.join(cwd, "../../../playground/dist"),
      ]

      let playgroundDistPath: string | null = null

      for (const tryPath of possiblePaths) {
        try {
          await fs.access(tryPath)
          playgroundDistPath = tryPath
          break
        } catch {
          // Continue
        }
      }

      if (!playgroundDistPath) {
        console.error(pc.red("✗ Playground build not found"))
        console.error(`Searched in the following locations:`)

        for (const tryPath of possiblePaths) {
          console.error(`  - ${tryPath}`)
        }

        console.error()
        console.error(`The playground needs to be built first.`)
        console.error(`Run: ${pc.cyan("cd playground && yarn build")}`)
        process.exit(1)
      }

      const portArg = args.find(arg => arg.startsWith("--port="))
      const port = portArg ? parseInt(portArg.split("=")[1]) : 5173

      const hostArg = args.find(arg => arg.startsWith("--host="))
      const host = hostArg ? hostArg.split("=")[1] : "localhost"

      const server = http.createServer(async (req, res) => {
        try {
          let filePath = req.url === "/" ? "/index.html" : req.url

          const queryIndex = filePath.indexOf("?")

          if (queryIndex !== -1) {
            filePath = filePath.substring(0, queryIndex)
          }

          const hashIndex = filePath.indexOf("#")

          if (hashIndex !== -1) {
            filePath = filePath.substring(0, hashIndex)
          }

          const fullPath = path.join(playgroundDistPath, filePath)
          const normalizedPath = path.normalize(fullPath)

          if (!normalizedPath.startsWith(playgroundDistPath)) {
            res.writeHead(403, { "Content-Type": "text/plain" })
            res.end("Forbidden")
            return
          }

          try {
            const stats = await fs.stat(normalizedPath)

            if (stats.isDirectory()) {
              const indexPath = path.join(normalizedPath, "index.html")
              const content = await fs.readFile(indexPath)

              res.writeHead(200, { "Content-Type": "text/html" })
              res.end(content)

              return
            }

            const content = await fs.readFile(normalizedPath)

            const ext = path.extname(normalizedPath).toLowerCase()
            const contentTypes: Record<string, string> = {
              ".html": "text/html",
              ".js": "application/javascript",
              ".css": "text/css",
              ".json": "application/json",
              ".png": "image/png",
              ".jpg": "image/jpeg",
              ".jpeg": "image/jpeg",
              ".gif": "image/gif",
              ".svg": "image/svg+xml",
              ".ico": "image/x-icon",
              ".ttf": "font/ttf",
              ".woff": "font/woff",
              ".woff2": "font/woff2",
            }

            const contentType = contentTypes[ext] || "application/octet-stream"
            res.writeHead(200, { "Content-Type": contentType })
            res.end(content)
          } catch (error) {
            try {
              const indexPath = path.join(playgroundDistPath, "index.html")
              const content = await fs.readFile(indexPath)
              res.writeHead(200, { "Content-Type": "text/html" })
              res.end(content)
            } catch {
              res.writeHead(404, { "Content-Type": "text/plain" })
              res.end("Not found")
            }
          }
        } catch (error) {
          console.error(pc.red("✗ Error serving file:"), error)
          res.writeHead(500, { "Content-Type": "text/plain" })
          res.end("Internal server error")
        }
      })

      server.listen(port, host, () => {
        console.log(pc.green("✓") + " Playground server started")
        console.log()
        console.log(`  ${pc.dim("Local:")}   ${pc.cyan(`http://${host}:${port}`)}`)

        if (host === "localhost" || host === "127.0.0.1") {
          try {
            const os = require("os")
            const networkInterfaces = os.networkInterfaces()
            const addresses: string[] = []

            for (const name of Object.keys(networkInterfaces)) {
              for (const net of networkInterfaces[name]) {
                if (net.family === "IPv4" && !net.internal) {
                  addresses.push(net.address)
                }
              }
            }

            if (addresses.length > 0) {
              console.log(`  ${pc.dim("Network:")} ${pc.cyan(`http://${addresses[0]}:${port}`)}`)
            }
          } catch (error) {
            // Ignore
          }
        }

        console.log()
        console.log(pc.dim("Press Ctrl+C to stop the server"))
      })

      process.on("SIGINT", () => {
        console.log()
        console.log(pc.yellow("⚠ Shutting down server..."))
        server.close(() => {
          console.log(pc.green("✓") + " Server stopped")
          process.exit(0)
        })
      })

      process.on("SIGTERM", () => {
        server.close(() => {
          process.exit(0)
        })
      })

    } catch (error) {
      console.error(pc.red("✗ Error starting server:"))
      console.error(error instanceof Error ? error.message : String(error))
      process.exit(1)
    }
  }

  private showHelp() {
    console.log(dedent`
      Usage: herb playground [command] [file] [options]

      Commands:
        start              Start a local playground server

      Generate a shareable Herb playground URL with your template content.

      Arguments:
        file               File containing template to open in playground, or '-' for stdin (defaults to stdin)

      Options:
        -h, --help         Show this help message
        -v, --version      Show version information
        -o, --open         Open the playground URL in your browser
        --port=<port>      Port to run server on (default: 5173) [start command only]
        --host=<host>      Host to bind server to (default: localhost) [start command only]

      Examples:
        # Start local playground server
        herb playground start

        # Start on custom port
        herb playground start --port=8080

        # Create playground URL from stdin
        echo "<div><%= @user.name %></div>" | herb playground

        # Create playground URL from a file
        herb playground app/views/users/show.html.erb

        # Create and open in browser
        herb playground app/views/users/show.html.erb --open
    `)
  }
}
