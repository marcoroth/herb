import dedent from "dedent"

import { readFileSync } from "fs"
import { parseArgs } from "util"
import { resolve } from "path"

import { Herb } from "@herb-tools/node-wasm"
import { Highlighter } from "./highlighter.js"
import { THEME_NAMES, DEFAULT_THEME } from "./themes.js"

import { name, version } from "../package.json"

import type { Diagnostic } from "@herb-tools/core"

export class CLI {
  private usage = dedent`
    Usage: herb-highlight [file] [options]

    Arguments:
      file             File to highlight (required)

    Options:
      -h, --help       show help
      -v, --version    show version
      --theme          color theme (${THEME_NAMES.join('|')}) or path to custom theme file [default: ${DEFAULT_THEME}]
      --focus          line number to focus on (shows only that line with context)
      --context-lines  number of context lines around focus line [default: 2]
      --no-line-numbers hide line numbers and file path header
      --wrap-lines     enable line wrapping [default: true]
      --no-wrap-lines  disable line wrapping
      --truncate-lines enable line truncation (mutually exclusive with --wrap-lines)
      --max-width      maximum width for line wrapping/truncation [default: terminal width]
      --diagnostics    JSON string or file path containing diagnostics to render
      --split-diagnostics  render each diagnostic individually (requires --diagnostics)
      `

  private parseArguments() {
    const { values, positionals } = parseArgs({
      args: process.argv.slice(2),
      options: {
        help: { type: "boolean", short: "h" },
        version: { type: "boolean", short: "v" },
        theme: { type: "string" },
        focus: { type: "string" },
        "context-lines": { type: "string" },
        "no-line-numbers": { type: "boolean" },
        "wrap-lines": { type: "boolean" },
        "no-wrap-lines": { type: "boolean" },
        "truncate-lines": { type: "boolean" },
        "max-width": { type: "string" },
        "diagnostics": { type: "string" },
        "split-diagnostics": { type: "boolean" },
      },
      allowPositionals: true,
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

    const theme = values.theme || DEFAULT_THEME

    let focusLine: number | undefined

    if (values.focus) {
      const parsed = parseInt(values.focus, 10)

      if (isNaN(parsed) || parsed < 1) {
        console.error(
          `Invalid focus line: ${values.focus}. Must be a positive integer.`,
        )
        process.exit(1)
      }

      focusLine = parsed
    }

    let contextLines = 2

    if (values["context-lines"]) {
      const parsed = parseInt(values["context-lines"], 10)
      if (isNaN(parsed) || parsed < 0) {
        console.error(
          `Invalid context-lines: ${values["context-lines"]}. Must be a non-negative integer.`,
        )
        process.exit(1)
      }
      contextLines = parsed
    }

    const showLineNumbers = !values["no-line-numbers"]

    let wrapLines = true
    let truncateLines = false

    if (values["truncate-lines"]) {
      truncateLines = true
      wrapLines = false
    } else if (values["no-wrap-lines"]) {
      wrapLines = false
    } else if (values["wrap-lines"] !== undefined) {
      wrapLines = !!values["wrap-lines"]
    }

    if (values["wrap-lines"] && values["truncate-lines"]) {
      console.error("Error: --wrap-lines and --truncate-lines cannot be used together.")
      process.exit(1)
    }

    let maxWidth: number | undefined

    if (values["max-width"]) {
      const parsed = parseInt(values["max-width"], 10)
      if (isNaN(parsed) || parsed < 1) {
        console.error(
          `Invalid max-width: ${values["max-width"]}. Must be a positive integer.`,
        )
        process.exit(1)
      }
      maxWidth = parsed
    }

    let diagnostics: Diagnostic[] = []
    let splitDiagnostics = false

    if (values["diagnostics"]) {
      try {
        let diagnosticsData: string

        if (values["diagnostics"].startsWith("{") || values["diagnostics"].startsWith("[")) {
          diagnosticsData = values["diagnostics"]
        } else {
          diagnosticsData = readFileSync(resolve(values["diagnostics"]), "utf-8")
        }

        const parsed = JSON.parse(diagnosticsData)
        diagnostics = Array.isArray(parsed) ? parsed : [parsed]

        for (const diagnostic of diagnostics) {
          if (!diagnostic.message || !diagnostic.location || !diagnostic.severity) {
            throw new Error("Invalid diagnostic format: each diagnostic must have message, location, and severity")
          }
        }

      } catch (error) {
        console.error(`Error parsing diagnostics: ${error instanceof Error ? error.message : error}`)
        process.exit(1)
      }
    }

    if (values["split-diagnostics"]) {
      if (diagnostics.length === 0) {
        console.error("Error: --split-diagnostics requires --diagnostics to be specified")

        process.exit(1)
      }

      splitDiagnostics = true
    }

    return {
      values,
      positionals,
      theme,
      focusLine,
      contextLines,
      showLineNumbers,
      wrapLines,
      truncateLines,
      maxWidth,
      diagnostics,
      splitDiagnostics,
    }
  }

  async run() {
    const { positionals, theme, focusLine, contextLines, showLineNumbers, wrapLines, truncateLines, maxWidth, diagnostics, splitDiagnostics } =
      this.parseArguments()

    if (positionals.length === 0) {
      console.error("Please specify an input file.")
      process.exit(1)
    }

    const filename = positionals[0]

    try {
      const filePath = resolve(filename)
      const content = readFileSync(filePath, "utf-8")

      const highlighter = new Highlighter(theme)
      await highlighter.initialize()

      const highlighted = highlighter.highlight(filePath, content, {
        focusLine,
        contextLines: focusLine ? contextLines : (diagnostics.length > 0 ? contextLines : 0),
        showLineNumbers,
        wrapLines,
        truncateLines,
        maxWidth,
        diagnostics,
        splitDiagnostics,
      })

      console.log(highlighted)
    } catch (error) {
      if (error instanceof Error && error.message.includes("ENOENT")) {
        console.error(`File not found: ${filename}`)
      } else {
        console.error(`Error:`, error)
      }

      process.exit(1)
    }
  }
}
