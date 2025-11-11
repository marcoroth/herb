import dedent from "dedent"
import pc from "picocolors"

import * as fs from "fs/promises"
import { Herb } from "@herb-tools/node-wasm"

export class CLI {
  async run() {
    const args = process.argv.slice(2)

    if (args[0] === "parse") {
      args.shift()
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
      console.error(`Run ${pc.cyan("herb parse --help")} for usage information`)
      process.exit(1)
    }

    try {
      await Herb.load()

      const trackWhitespace = args.includes("--track-whitespace") || args.includes("-w")
      const json = args.includes("--json") || args.includes("-j")
      const pretty = args.includes("--pretty") || args.includes("-p")

      const parseResult = Herb.parse(input, { track_whitespace: trackWhitespace })

      if (parseResult.errors.length > 0) {
        console.error(pc.red("✗ Parse errors:"))
        for (const error of parseResult.errors) {
          console.error(`  ${error.message}`)
        }
        process.exit(1)
      }

      if (json) {
        if (pretty) {
          console.log(JSON.stringify(parseResult.value, null, 2))
        } else {
          console.log(JSON.stringify(parseResult.value))
        }
      } else {
        console.log(parseResult.value.inspect())
      }

    } catch (error) {
      console.error(pc.red("✗ Error parsing:"))
      console.error(error instanceof Error ? error.message : String(error))
      process.exit(1)
    }
  }

  private showHelp() {
    console.log(dedent`
      Usage: herb parse [file] [options]

      Parse HTML+ERB templates and output the Abstract Syntax Tree (AST).

      Arguments:
        file               File containing template to parse, or '-' for stdin (defaults to stdin)

      Options:
        -h, --help         Show this help message
        -v, --version      Show version information
        -w, --track-whitespace  Track whitespace nodes in the AST
        -j, --json         Output as JSON (default is tree inspect format)
        -p, --pretty       Pretty print JSON output (only with --json)

      Examples:
        # Parse from stdin (tree inspect format)
        echo "<div><%= @user.name %></div>" | herb parse

        # Parse from a file
        herb parse app/views/users/show.html.erb

        # Parse with whitespace tracking
        herb parse app/views/users/show.html.erb --track-whitespace

        # Output as JSON
        herb parse app/views/users/show.html.erb --json

        # Output as pretty JSON
        herb parse app/views/users/show.html.erb --json --pretty
    `)
  }
}
