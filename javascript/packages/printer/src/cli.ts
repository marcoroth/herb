#!/usr/bin/env node

import dedent from "dedent"

import { readFileSync, writeFileSync } from "fs"
import { resolve } from "path"
import { glob } from "glob"

import { Herb } from "@herb-tools/node-wasm"
import { IdentityPrinter } from "./index.js"

interface CLIOptions {
  input?: string
  output?: string
  verify?: boolean
  stats?: boolean
  help?: boolean
  glob?: boolean
}

export class CLI {
  private parseArgs(args: string[]): CLIOptions {
    const options: CLIOptions = {}

    for (let i = 2; i < args.length; i++) {
      const arg = args[i]

      switch (arg) {
        case '-i':
        case '--input':
          options.input = args[++i]
          break
        case '-o':
        case '--output':
          options.output = args[++i]
          break
        case '--verify':
          options.verify = true
          break
        case '--stats':
          options.stats = true
          break
        case '--glob':
          options.glob = true
          break
        case '-h':
        case '--help':
          options.help = true
          break
        default:
          if (!arg.startsWith('-') && !options.input) {
            options.input = arg
          }
      }
    }

    return options
  }

  private showHelp() {
    console.log(dedent`
      herb-print - Print HTML+ERB AST back to source code

      This tool parses HTML+ERB templates and prints them back, preserving the original
      formatting as closely as possible. Useful for testing parser accuracy and as a
      baseline for other transformations.

      Usage:
        herb-print [options] <input-file-or-pattern>
        herb-print -i <input-file> -o <output-file>

      Options:
        -i, --input <file>           Input file path
        -o, --output <file>          Output file path (defaults to stdout)
        --verify                     Verify that output matches input exactly
        --stats                      Show parsing and printing statistics
        --glob                       Treat input as glob pattern (default: **/*.html.erb)
        -h, --help                   Show this help message

      Examples:
        # Single file
        herb-print input.html.erb > output.html.erb
        herb-print -i input.html.erb -o output.html.erb --verify
        herb-print input.html.erb --stats

        # Glob patterns (batch verification)
        herb-print --glob --verify                    # All .html.erb files
        herb-print "app/views/**/*.html.erb" --glob --verify --stats
        herb-print "*.erb" --glob --verify
        herb-print "/path/to/templates" --glob --verify    # Directory (auto-appends /**/*.html.erb)
        herb-print "/path/to/templates/**/*.html.erb" --glob --verify

        # The --verify flag is useful to test parser fidelity:
        herb-print input.html.erb --verify
        # Checks if parsing and printing results in identical content
    `)
  }

  async run() {
    const options = this.parseArgs(process.argv)

    if (options.help || (!options.input && !options.glob)) {
      this.showHelp()
      process.exit(0)
    }

    try {
      await Herb.load()

      if (options.glob) {
        const pattern = options.input || "**/*.html.erb"
        const files = await glob(pattern)

        if (files.length === 0) {
          console.error(`No files found matching pattern: ${pattern}`)
          process.exit(1)
        }

        let totalFiles = 0
        let failedFiles = 0
        let verificationFailures = 0
        let totalBytes = 0

        console.log(`Processing ${files.length} files...\n`)

        for (const file of files) {
          try {
            const input = readFileSync(file, 'utf-8')
            const parseResult = Herb.parse(input, { track_whitespace: true })

            if (parseResult.errors.length > 0) {
              console.error(`\x1b[31m✗\x1b[0m \x1b[1m${file}\x1b[0m: \x1b[1m\x1b[31mFailed\x1b[0m to parse`)
              failedFiles++
              continue
            }

            const printer = new IdentityPrinter()
            const output = printer.print(parseResult.value)

            totalFiles++
            totalBytes += input.length

            if (options.verify) {
              if (input === output) {
                console.log(`\x1b[32m✓\x1b[0m \x1b[1m${file}\x1b[0m: \x1b[32mPerfect match\x1b[0m`)
              } else {
                console.error(`\x1b[31m✗\x1b[0m \x1b[1m${file}\x1b[0m: \x1b[1m\x1b[31mVerification failed\x1b[0m - differences detected`)
                verificationFailures++
              }
            } else {
              console.log(`\x1b[32m✓\x1b[0m \x1b[1m${file}\x1b[0m: \x1b[32mProcessed\x1b[0m`)
            }

          } catch (error) {
            console.error(`\x1b[31m✗\x1b[0m \x1b[1m${file}\x1b[0m: \x1b[1m\x1b[31mError\x1b[0m - ${error}`)
            failedFiles++
          }
        }

        console.log(`\nSummary:`)
        console.log(`  Files processed: ${totalFiles}`)
        console.log(`  Files failed:    ${failedFiles}`)

        if (options.verify) {
          console.log(`  Verifications:    ${totalFiles - verificationFailures} passed, ${verificationFailures} failed`)
        }

        if (options.stats) {
          console.log(`  Total bytes:      ${totalBytes}`)
        }

        process.exit(failedFiles > 0 || verificationFailures > 0 ? 1 : 0)

      } else {
        const inputPath = resolve(options.input!)
        const input = readFileSync(inputPath, 'utf-8')

        const parseResult = Herb.parse(input, { track_whitespace: true })

        if (parseResult.errors.length > 0) {
          console.error('Parse errors:', parseResult.errors.map(e => e.message).join(', '))
          process.exit(1)
        }

        const printer = new IdentityPrinter()
        const output = printer.print(parseResult.value)

        if (options.output) {
          const outputPath = resolve(options.output)
          writeFileSync(outputPath, output, 'utf-8')

          console.log(`Output written to: ${outputPath}`)
        } else {
          console.log(output)
        }

        if (options.verify) {
          if (input === output) {
            console.error('\x1b[32m✓ Verification passed\x1b[0m - output matches input exactly')
          } else {
            console.error('\x1b[31m✗ Verification failed\x1b[0m - output differs from input')
            process.exit(1)
          }
        }

        if (options.stats) {
          const errors = parseResult.errors?.length || 0
          const warnings = parseResult.warnings?.length || 0

          console.error(dedent`
            Printing Statistics:
              Input size:     ${input.length} bytes
              Output size:    ${output.length} bytes
              Parse errors:   ${errors}
              Parse warnings: ${warnings}
              Round-trip:     ${input === output ? 'Perfect' : 'Differences detected'}
          `)
        }
      }

    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error)
      process.exit(1)
    }
  }
}
