#!/usr/bin/env node

import dedent from "dedent"

import { readFileSync, writeFileSync } from "fs"
import { glob } from "tinyglobby"

import { Herb } from "@herb-tools/node-wasm"
import { Config } from "@herb-tools/config"

import { Minifier } from "./index.js"
import { version } from "../package.json"

interface CLIOptions {
  input?: string
  output?: string
  configFile?: string
  stats?: boolean
  help?: boolean
  version?: boolean
  glob?: boolean
  write?: boolean
  verbose?: boolean
}

function percentage(before: number, after: number): string {
  if (before === 0) return "0.0%"

  return `${(((before - after) / before) * 100).toFixed(1)}%`
}

export class CLI {
  private parseArgs(args: string[]): CLIOptions {
    const options: CLIOptions = {}

    for (let index = 2; index < args.length; index++) {
      const argument = args[index]

      switch (argument) {
        case "-i":
        case "--input":
          options.input = args[++index]
          break
        case "-o":
        case "--output":
          options.output = args[++index]
          break
        case "--config-file":
          options.configFile = args[++index]
          break
        case "--stats":
          options.stats = true
          break
        case "--glob":
          options.glob = true
          break
        case "-w":
        case "--write":
          options.write = true
          break
        case "--verbose":
          options.verbose = true
          break
        case "-v":
        case "--version":
          options.version = true
          break
        case "-h":
        case "--help":
          options.help = true
          break
        default:
          if (!argument.startsWith("-") && !options.input) {
            options.input = argument
          }
      }
    }

    return options
  }

  private showHelp() {
    console.log(dedent`
      herb-minify - Minify HTML+ERB templates

      Removes the whitespace that does not survive rendering and the comments that
      carry no markup. The content of whitespace preserving elements, conditional
      comments and Herb directives are left alone.

      Usage:
        herb-minify [options] <input-file-or-pattern>
        herb-minify -i <input-file> -o <output-file>

      Options:
        -i, --input <file>           Input file path
        -o, --output <file>          Output file path (defaults to stdout)
        -w, --write                  Overwrite each input file with its minified output
        --config-file <path>         Explicitly specify path to .herb.yml config file
        --stats                      Show how many bytes were saved
        --glob                       Treat input as a glob pattern
        --verbose                    Print a line for every file, not just failures
        -v, --version                Show the version
        -h, --help                   Show this help message

      Examples:
        herb-minify input.html.erb
        herb-minify -i input.html.erb -o output.html.erb
        herb-minify input.html.erb --stats

        herb-minify --glob --stats
        herb-minify "app/views/**/*.html.erb" --glob --write
    `)
  }

  private minifyFile(minifier: Minifier, file: string, options: CLIOptions): { before: number, after: number, output: string } | null {
    const input = readFileSync(file, "utf-8")
    const parseResult = Herb.parse(input, { track_whitespace: true })

    if (parseResult.failed) {
      console.error(`\x1b[31m✗\x1b[0m \x1b[1m${file}\x1b[0m: \x1b[1m\x1b[31mFailed\x1b[0m to parse`)

      return null
    }

    const output = minifier.minifyString(input)

    if (options.write) {
      writeFileSync(file, output, "utf-8")
    }

    if (options.verbose) {
      console.log(`\x1b[32m✓\x1b[0m \x1b[1m${file}\x1b[0m: ${input.length} → ${output.length} bytes (${percentage(input.length, output.length)})`)
    }

    return { before: input.length, after: output.length, output }
  }

  async run() {
    const options = this.parseArgs(process.argv)

    if (options.version) {
      console.log(version)
      process.exit(0)
    }

    if (options.help || (!options.input && !options.glob)) {
      this.showHelp()
      process.exit(0)
    }

    await Herb.load()

    const minifier = new Minifier(Herb)
    await minifier.initialize()

    if (!options.glob) {
      const result = this.minifyFile(minifier, options.input!, { ...options, verbose: false })

      if (!result) process.exit(1)

      if (options.output) {
        writeFileSync(options.output, result.output, "utf-8")
      } else if (!options.write) {
        console.log(result.output)
      }

      if (options.stats) {
        console.error(`${result.before} → ${result.after} bytes (${percentage(result.before, result.after)} smaller)`)
      }

      process.exit(0)
    }

    const startPath = options.input || process.cwd()
    const config = await Config.loadForCLI(options.configFile || startPath, version)
    const filesConfig = config.getFilesConfigForTool("linter")

    const files = options.input
      ? await glob(options.input, { ignore: filesConfig.exclude || [] })
      : await config.findFilesForTool("linter", startPath)

    if (files.length === 0) {
      console.error(`No files found matching: ${options.input || "configured patterns"}`)
      process.exit(1)
    }

    let before = 0
    let after = 0
    let minified = 0
    let failed = 0

    for (const file of files) {
      const result = this.minifyFile(minifier, file, options)

      if (!result) {
        failed++
        continue
      }

      minified++
      before += result.before
      after += result.after
    }

    if (options.stats || options.verbose) {
      console.log(`\nMinified ${minified} file(s): ${before} → ${after} bytes (${percentage(before, after)} smaller)`)
    }

    if (failed > 0) {
      console.error(`${failed} file(s) failed to parse`)
      process.exit(1)
    }
  }
}
