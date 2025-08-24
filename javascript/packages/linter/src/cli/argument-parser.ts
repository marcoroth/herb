import dedent from "dedent"

import { parseArgs } from "util"
import { statSync } from "fs"
import { join } from "path"

import { Herb } from "@herb-tools/node-wasm"

import { THEME_NAMES, DEFAULT_THEME } from "@herb-tools/highlighter"
import type { ThemeInput } from "@herb-tools/highlighter"

import { name, version } from "../../package.json"

export type FormatOption = "simple" | "detailed" | "json" | "github"

export interface ParsedArguments {
  pattern: string
  formatOption: FormatOption
  showTiming: boolean
  theme: ThemeInput
  wrapLines: boolean
  truncateLines: boolean
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
      --format         output format (simple|detailed|json|github) [default: detailed]
      --simple         use simple output format (shortcut for --format simple)
      --json           use JSON output format (shortcut for --format json)
      --github         use GitHub Actions output format (shortcut for --format github)
      --theme          syntax highlighting theme (${THEME_NAMES.join("|")}) or path to custom theme file [default: ${DEFAULT_THEME}]
      --no-color       disable colored output
      --no-timing      hide timing information
      --no-wrap-lines  disable line wrapping
      --truncate-lines enable line truncation (mutually exclusive with line wrapping)
  `

  parse(argv: string[]): ParsedArguments {
    const { values, positionals } = parseArgs({
      args: argv.slice(2),
      options: {
        help: { type: "boolean", short: "h" },
        version: { type: "boolean", short: "v" },
        format: { type: "string" },
        simple: { type: "boolean" },
        json: { type: "boolean" },
        github: { type: "boolean" },
        theme: { type: "string" },
        "no-color": { type: "boolean" },
        "no-timing": { type: "boolean" },
        "no-wrap-lines": { type: "boolean" },
        "truncate-lines": { type: "boolean" }
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

    let formatOption: FormatOption = "detailed"
    if (values.format && (values.format === "detailed" || values.format === "simple" || values.format === "json" || values.format === "github")) {
      formatOption = values.format
    }

    if (values.simple) {
      formatOption = "simple"
    }

    if (values.json) {
      formatOption = "json"
    }

    if (values.github) {
      formatOption = "github"
    }

    if (values["no-color"]) {
      process.env.NO_COLOR = "1"
    }

    const showTiming = !values["no-timing"]

    let wrapLines = !values["no-wrap-lines"]
    let truncateLines = false

    if (values["truncate-lines"]) {
      truncateLines = true
      wrapLines = false
    }

    if (!values["no-wrap-lines"] && values["truncate-lines"]) {
      console.error("Error: Line wrapping and --truncate-lines cannot be used together. Use --no-wrap-lines with --truncate-lines.")
      process.exit(1)
    }

    const theme = values.theme || DEFAULT_THEME
    const pattern = this.getFilePattern(positionals)

    return { pattern, formatOption, showTiming, theme, wrapLines, truncateLines }
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
