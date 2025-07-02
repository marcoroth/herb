#!/usr/bin/env node

import { readFileSync, writeFileSync } from "fs"
import { resolve } from "path"
import { Herb } from "@herb-tools/node-wasm"
import { Minifier, MinifierOptions } from "./index.js"

interface CLIOptions extends MinifierOptions {
  input?: string
  output?: string
  stats?: boolean
  help?: boolean
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
      case '--no-collapse-whitespace':
        options.collapseWhitespace = false
        break
      case '--no-collapse-spaces':
        options.collapseMultipleSpaces = false
        break
      case '--no-collapse-newlines':
        options.collapseMultipleNewlines = false
        break
      case '--preserve-line-breaks':
        options.preserveLineBreaks = true
        break
      case '--no-trim':
        options.trimTextNodes = false
        break
      case '--preserve-tags':
        options.preserveTags = args[++i].split(',')
        break
      case '--stats':
        options.stats = true
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
herb-minify - Minify HTML+ERB templates

Usage:
  herb-minify [options] <input-file>
  herb-minify -i <input-file> -o <output-file>

Options:
  -i, --input <file>           Input file path
  -o, --output <file>          Output file path (defaults to stdout)
  --no-collapse-whitespace     Don't collapse whitespace
  --no-collapse-spaces         Don't collapse multiple spaces
  --no-collapse-newlines       Don't collapse multiple newlines
  --preserve-line-breaks       Preserve line breaks (collapses to single newline)
  --no-trim                    Don't trim empty text nodes
  --preserve-tags <tags>       Comma-separated list of tags to preserve whitespace in
                              (default: pre,code,script,style,textarea)
  --stats                      Show minification statistics
  -h, --help                   Show this help message

Examples:
  herb-minify input.html.erb > output.html.erb
  herb-minify -i input.html.erb -o output.html.erb --stats
  herb-minify input.html.erb --preserve-tags pre,code,custom
`)
}

async function main() {
  const options = parseArgs(process.argv)

  if (options.help || !options.input) {
    showHelp()
    process.exit(options.help ? 0 : 1)
  }

  try {
    // Load WASM
    await Herb.load()

    // Read input file
    const inputPath = resolve(options.input)
    const input = readFileSync(inputPath, 'utf-8')

    // Create minifier with options
    const minifier = new Minifier({
      collapseWhitespace: options.collapseWhitespace,
      collapseMultipleSpaces: options.collapseMultipleSpaces,
      collapseMultipleNewlines: options.collapseMultipleNewlines,
      preserveLineBreaks: options.preserveLineBreaks,
      preserveTags: options.preserveTags,
      trimTextNodes: options.trimTextNodes
    })

    // Parse the input first
    const parseResult = Herb.parse(input)
    if (!parseResult.value) {
      throw new Error("Failed to parse input HTML+ERB")
    }

    // Minify
    const result = minifier.minify(parseResult)

    // Write output
    if (options.output) {
      const outputPath = resolve(options.output)
      writeFileSync(outputPath, result.output)
      if (options.stats) {
        console.error(`✓ Minified ${options.input} → ${options.output}`)
      }
    } else {
      process.stdout.write(result.output)
    }

    // Show stats if requested
    if (options.stats) {
      console.error(`
Minification Statistics:
  Original size:  ${result.originalSize} bytes
  Minified size:  ${result.minifiedSize} bytes
  Reduction:      ${result.reduction} bytes (${result.reductionPercentage}%)
`)
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
