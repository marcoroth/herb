import dedent from "dedent"

import { parseArgs } from "util"
import { statSync } from "fs"
import { join } from "path"

import { Herb } from "@herb-tools/node-wasm"

import { THEME_NAMES, DEFAULT_THEME } from "@herb-tools/highlighter"
import type { ThemeInput } from "@herb-tools/highlighter"

import { name, version } from "../../package.json"

export interface ParsedArguments {
  pattern: string
  formatOption: 'simple' | 'detailed'
  showTiming: boolean
  theme: ThemeInput
  wrapLines: boolean
}

export class ArgumentParser {
  private readonly usage = dedent`
    Usage: herb-lint [file|glob-pattern|directory] [options]

    Arguments:
      file             Single file to lint
      glob-pattern     Files to lint (defaults to **/*.html.erb)
      directory        Directory to lint (automatically appends **/*.html.erb)

    Options:
      -h, --help       show help
      -v, --version    show version
      --format         output format (simple|detailed) [default: detailed]
      --simple         use simple output format (shortcut for --format simple)
      --theme          syntax highlighting theme (${THEME_NAMES.join('|')}) or path to custom theme file [default: ${DEFAULT_THEME}]
      --no-color       disable colored output
      --no-timing      hide timing information
      --no-wrap-lines  disable line wrapping
  `

  parse(argv: string[]): ParsedArguments {
    const { values, positionals } = parseArgs({
      args: argv.slice(2),
      options: {
        help: { type: 'boolean', short: 'h' },
        version: { type: 'boolean', short: 'v' },
        format: { type: 'string' },
        simple: { type: 'boolean' },
        theme: { type: 'string' },
        'no-color': { type: 'boolean' },
        'no-timing': { type: 'boolean' },
        'no-wrap-lines': { type: 'boolean' }
      },
      allowPositionals: true
    })

    if (values.help) {
      console.log(this.usage)
      process.exit(0)
    }

    if (values.version) {
      console.log("Versions:")
      console.log(`  ${name}@${version}, ${Herb.version}`.split(", ").join("\n  "))
      process.exit(0)
    }

    let formatOption: 'simple' | 'detailed' = 'detailed'
    if (values.format && (values.format === "detailed" || values.format === "simple")) {
      formatOption = values.format
    }

    if (values.simple) {
      formatOption = "simple"
    }

    if (values['no-color']) {
      process.env.NO_COLOR = "1"
    }

    const showTiming = !values['no-timing']
    const wrapLines = !values['no-wrap-lines']
    const theme = values.theme || DEFAULT_THEME
    const pattern = this.getFilePattern(positionals)

    if (positionals.length === 0) {
      console.error("Please specify input file.")
      process.exit(1)
    }

    return { pattern, formatOption, showTiming, theme, wrapLines }
  }

  private getFilePattern(positionals: string[]): string {
    let pattern = positionals.length > 0 ? positionals[0] : "**/*.html.erb"

    try {
      const stat = statSync(pattern)
      if (stat.isDirectory()) {
        pattern = join(pattern, "**/*.html.erb")
      }
    } catch {
      // Not a file/directory, treat as glob pattern
    }

    return pattern
  }
}
