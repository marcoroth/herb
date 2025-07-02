#!/usr/bin/env node

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

function parseArgs(args: string[]): CLIOptions {
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

function showHelp() {
  console.log(`
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

async function main() {
  const options = parseArgs(process.argv)

  if (options.help || (!options.input && !options.glob)) {
    showHelp()
    process.exit(options.help ? 0 : 1)
  }

  try {
    // Load WASM
    await Herb.load()

    if (options.glob) {
      // Glob mode - process multiple files
      let pattern = options.input || "**/*.html.erb"
      
      // If input looks like a directory path, append the default pattern
      if (options.input && !options.input.includes('*') && !options.input.includes('?')) {
        const { statSync } = await import('fs')
        try {
          const stats = statSync(options.input)
          if (stats.isDirectory()) {
            pattern = `${options.input.replace(/\/$/, '')}/**/*.html.erb`
          }
        } catch {
          // If stat fails, assume it's already a pattern
        }
      }
      
      const files = await glob(pattern)
      
      if (files.length === 0) {
        console.error(`No files found matching pattern: ${pattern}`)
        process.exit(1)
      }

      let totalFiles = 0
      let passedFiles = 0
      let failedFiles = 0
      let totalBytes = 0

      console.error(`Processing ${files.length} files matching "${pattern}"...\n`)

      for (const file of files) {
        try {
          const input = readFileSync(file, 'utf-8')
          const parseResult = Herb.parse(input)
          
          if (!parseResult.value) {
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
              console.error(`\x1b[32m✓\x1b[0m \x1b[1m${file}\x1b[0m: Round-trip verification \x1b[1m\x1b[32mpassed\x1b[0m`)
              passedFiles++
            } else {
              console.error(`\x1b[31m✗\x1b[0m \x1b[1m${file}\x1b[0m: Round-trip verification \x1b[1m\x1b[31mfailed\x1b[0m`)
              failedFiles++
            }
          } else {
            // Just processing, no verification
            console.error(`\x1b[32m✓\x1b[0m \x1b[1m${file}\x1b[0m: Processed \x1b[1m\x1b[32msuccessfully\x1b[0m`)
            passedFiles++
          }

          if (options.stats) {
            const errors = parseResult.errors?.length || 0
            const warnings = parseResult.warnings?.length || 0
            if (errors > 0 || warnings > 0) {
              console.error(`  Parse errors: ${errors}, warnings: ${warnings}`)
            }
          }

        } catch (error) {
          console.error(`\x1b[31m✗\x1b[0m \x1b[1m${file}\x1b[0m: \x1b[1m\x1b[31m${error instanceof Error ? error.message : error}\x1b[0m`)
          failedFiles++
        }
      }

      // Summary
      console.error(`\n\x1b[1mSummary:\x1b[0m`)
      console.error(`  \x1b[1mTotal files:\x1b[0m    ${totalFiles}`)
      console.error(`  \x1b[1m\x1b[32mPassed:\x1b[0m         ${passedFiles}`)
      console.error(`  \x1b[1m\x1b[31mFailed:\x1b[0m         ${failedFiles}`)
      console.error(`  \x1b[1mTotal bytes:\x1b[0m    ${totalBytes}`)
      
      if (failedFiles > 0) {
        process.exit(1)
      }

    } else {
      // Single file mode
      if (!options.input) {
        showHelp()
        process.exit(1)
      }

      const inputPath = resolve(options.input)
      const input = readFileSync(inputPath, 'utf-8')

      // Parse the input
      const parseResult = Herb.parse(input)
      if (!parseResult.value) {
        throw new Error("Failed to parse input HTML+ERB")
      }

      // Create identity printer for lossless reconstruction
      const printer = new IdentityPrinter()

      // Print back to source
      const output = printer.print(parseResult.value)

      // Write output first
      if (options.output) {
        const outputPath = resolve(options.output)
        writeFileSync(outputPath, output)
        if (options.stats || options.verify) {
          console.error(`\x1b[32m✓\x1b[0m Printed ${options.input} → ${options.output}`)
        }
      } else {
        process.stdout.write(output)
      }

      // Verify accuracy if requested (after output)
      if (options.verify) {
        if (input === output) {
          console.error(`\n\x1b[32m✓\x1b[0m Round-trip verification \x1b[1m\x1b[32mpassed\x1b[0m: input === output`)
        } else {
          console.error(`\n\x1b[31m✗\x1b[0m Round-trip verification \x1b[1m\x1b[31mfailed\x1b[0m: output differs from input`)
          console.error(`Input length: ${input.length}, Output length: ${output.length}`)

          // Show first difference
          for (let i = 0; i < Math.min(input.length, output.length); i++) {
            if (input[i] !== output[i]) {
              console.error(`First difference at position ${i}:`)
              console.error(`  Input:  ${JSON.stringify(input.slice(i, i + 20))}`)
              console.error(`  Output: ${JSON.stringify(output.slice(i, i + 20))}`)
              break
            }
          }
          process.exit(1)
        }
      }


      // Show stats if requested
      if (options.stats) {
        const errors = parseResult.errors?.length || 0
        const warnings = parseResult.warnings?.length || 0

        console.error(`
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

main().catch(error => {
  console.error('Fatal error:', error)
  process.exit(1)
})
