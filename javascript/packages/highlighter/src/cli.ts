import dedent from "dedent"

import { readFileSync, existsSync } from "fs"
import { parseArgs } from "util"
import { resolve } from "path"

import { Herb } from "@herb-tools/node-wasm"
import { Highlighter } from "./highlighter.js"
import { THEME_NAMES, DEFAULT_THEME, resolveTheme } from "./themes.js"
import { generateStylesheet } from "./stylesheet.js"

import { name, version } from "../package.json"
import { parseUnifiedDiff } from "./unified-diff.js"

import type { DiffHunk } from "./diff-computer.js"
import type { ThemeInput } from "./themes.js"

import type { Diagnostic } from "@herb-tools/core"

export class CLI {
  private usage = dedent`
    Usage: herb-highlight [file] [options]

    Arguments:
      file                   File to highlight (required)

    Options:
      -h, --help             how help
      -v, --version          show version
      --theme                color theme (${THEME_NAMES.join('|')}) or path to custom theme file [default: ${DEFAULT_THEME}]
      --format               output format (ansi|html) [default: ansi]
      --emit-css             print CSS for a theme or dark:light theme pair (e.g. onedark:github-light) and exit
      --focus                line number to focus on (shows only that line with context)
      --context-lines        number of context lines around focus line [default: 2]
      --no-line-numbers      hide line numbers and file path header
      --wrap-lines           enable line wrapping [default: true]
      --no-wrap-lines        disable line wrapping
      --truncate-lines       enable line truncation (mutually exclusive with --wrap-lines)
      --max-width            maximum width for line wrapping/truncation [default: terminal width]
      --diagnostics          JSON string or file path containing diagnostics to render
      --split-diagnostics    render each diagnostic individually (requires --diagnostics)
      --diff                 render a diff instead of a file

    Diff two files, which can also be spelled as the \`diff\` subcommand:

      herb-highlight diff before.html.erb after.html.erb
      herb-highlight --diff before.html.erb after.html.erb

    Or render a diff that was made elsewhere, taken from the argument or from stdin:

      git diff -- app/views | herb-highlight diff
      herb-highlight diff fix.json

    That accepts unified diff text as produced by \`git diff\`, or JSON as
    {"original": "...", "modified": "..."} or {"hunks": [...]}
      `

  private parseRawArguments() {
    const args = process.argv.slice(2)
    const last = args[args.length - 1]

    if (last === "--emit-css") {
      console.error("Error: --emit-css requires a theme name.")
      process.exit(1)
    }

    if (["--theme", "--format", "--focus", "--context-lines", "--max-width", "--diagnostics"].includes(last)) {
      args.pop()
    }

    try {
      return parseArgs({
        args,
        options: {
          help: { type: "boolean", short: "h" },
          version: { type: "boolean", short: "v" },
          theme: { type: "string" },
          format: { type: "string" },
          "emit-css": { type: "string" },
          focus: { type: "string" },
          "context-lines": { type: "string" },
          "no-line-numbers": { type: "boolean" },
          "wrap-lines": { type: "boolean" },
          "no-wrap-lines": { type: "boolean" },
          "truncate-lines": { type: "boolean" },
          "max-width": { type: "string" },
          "diagnostics": { type: "string" },
          "split-diagnostics": { type: "boolean" },
          "diff": { type: "boolean" },
        },
        allowPositionals: true,
      })
    } catch (error) {
      if (error instanceof Error && error.message.includes("--emit-css")) {
        console.error("Error: --emit-css requires a theme name.")
        process.exit(1)
      }

      if (error instanceof Error && (error as NodeJS.ErrnoException).code === "ERR_PARSE_ARGS_UNKNOWN_OPTION") {
        const option = error.message.match(/'([^']+)'/)?.[1]

        console.error(`Unknown option: ${option ?? error.message}`)
        process.exit(1)
      }

      if (error instanceof Error && String((error as NodeJS.ErrnoException).code).startsWith("ERR_PARSE_ARGS")) {
        console.error(`Error: ${error.message}`)
        process.exit(1)
      }

      throw error
    }
  }

  private emitCss(value: string): never {
    if (value === "") {
      console.error("Error: --emit-css requires a theme name.")
      process.exit(1)
    }

    const separatorIndex = value.indexOf(":")
    const darkLabel = separatorIndex === -1 ? value : value.slice(0, separatorIndex)
    const lightLabel = separatorIndex === -1 ? undefined : value.slice(separatorIndex + 1)

    try {
      const dark = resolveTheme(darkLabel)
      const light = lightLabel === undefined ? undefined : { scheme: resolveTheme(lightLabel), label: lightLabel }

      process.stdout.write(generateStylesheet(dark, value, light))
      process.exit(0)
    } catch (error) {
      console.error(`Error: ${error instanceof Error ? error.message : error}`)
      process.exit(1)
    }
  }

  private async parseArguments() {
    const { values, positionals } = this.parseRawArguments()

    if (values.help) {
      console.log(this.usage)
      process.exit(0)
    }

    if (values.version) {
      await Herb.load()

      console.log("Versions:")
      console.log(`  ${name}@${version}, ${Herb.version}`.split(", ").join("\n  "))
      process.exit(0)
    }

    if (values["emit-css"] !== undefined) {
      this.emitCss(values["emit-css"])
    }

    const theme = values.theme || DEFAULT_THEME

    const format = values.format || "ansi"

    if (format !== "ansi" && format !== "html") {
      console.error(`Invalid format: ${format}. Valid formats: ansi, html.`)
      process.exit(1)
    }

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
      diffMode: values["diff"] === true,
      theme,
      format,
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

  private readDiffInput(input: string | undefined): string {
    if (input === undefined || input === "-") {
      if (input === undefined && process.stdin.isTTY) {
        console.error("Error: --diff needs a JSON string, a file path, or input piped in on stdin.")
        process.exit(1)
      }

      return readFileSync(0, "utf-8")
    }

    if (input.trimStart().startsWith("{") || input.trimStart().startsWith("[")) return input

    return readFileSync(resolve(input), "utf-8")
  }

  private diffsFrom(parsed: any): { path: string, hunks?: DiffHunk[], original?: string, modified?: string }[] {
    if (Array.isArray(parsed?.hunks)) {
      return [{ path: parsed.filename ?? "", hunks: parsed.hunks }]
    }

    if (typeof parsed?.original === "string" && typeof parsed?.modified === "string") {
      return [{ path: parsed.filename ?? "", original: parsed.original, modified: parsed.modified }]
    }

    throw new Error(`Expected {"original", "modified"} or {"hunks"}`)
  }

  private diffOfFiles(first: string, second: string): { path: string, original: string, modified: string } {
    for (const file of [first, second]) {
      if (!existsSync(resolve(file))) {
        console.error(`File not found: ${file}`)
        process.exit(1)
      }
    }

    return {
      path: `${first} → ${second}`,
      original: readFileSync(resolve(first), "utf-8"),
      modified: readFileSync(resolve(second), "utf-8"),
    }
  }

  private async runDiff(inputs: string[], options: { theme: ThemeInput, contextLines: number, showLineNumbers: boolean, wrapLines: boolean, truncateLines: boolean, maxWidth?: number }): Promise<void> {
    const { theme, contextLines, showLineNumbers, wrapLines, truncateLines, maxWidth } = options

    let diffs: { path: string, hunks?: DiffHunk[], original?: string, modified?: string }[]

    if (inputs.length > 2) {
      console.error("Error: --diff takes at most two files.")
      process.exit(1)
    }

    try {
      if (inputs.length === 2) {
        diffs = [this.diffOfFiles(inputs[0], inputs[1])]
      } else {
        const text = this.readDiffInput(inputs[0])
        const trimmed = text.trimStart()

        diffs = trimmed.startsWith("{") || trimmed.startsWith("[")
          ? this.diffsFrom(JSON.parse(text))
          : parseUnifiedDiff(text)
      }

      if (diffs.length === 0) throw new Error(`Found no hunks. Expected two files, JSON, or unified diff text as produced by \`git diff\``)
    } catch (error) {
      console.error(`Error parsing diff: ${error instanceof Error ? error.message : error}`)
      process.exit(1)
    }

    const highlighter = new Highlighter(theme)
    await highlighter.initialize()

    const renderOptions = { contextLines, showLineNumbers, wrapLines, truncateLines, maxWidth }

    const rendered = diffs
      .map(diff => diff.hunks
        ? highlighter.highlightDiffHunks(diff.path, diff.hunks, renderOptions)
        : highlighter.highlightDiff(diff.path, diff.original!, diff.modified!, renderOptions))
      .filter(diff => diff !== "")

    if (rendered.length === 0) {
      console.error("No differences to render.")
      process.exit(1)
    }

    console.log(rendered.join("\n\n"))
  }

  async run() {
    const { positionals, diffMode, theme, format, focusLine, contextLines, showLineNumbers, wrapLines, truncateLines, maxWidth, diagnostics, splitDiagnostics } =
      await this.parseArguments()

    const isDiffSubcommand = positionals[0] === "diff"

    if (format === "html" && diagnostics.length > 0) {
      console.error("Error: --format html cannot render diagnostics yet.")
      process.exit(1)
    }

    if (format === "html" && (diffMode || isDiffSubcommand)) {
      console.error("Error: --format html cannot render diffs yet.")
      process.exit(1)
    }

    if (diffMode || isDiffSubcommand) {
      const inputs = isDiffSubcommand ? positionals.slice(1) : positionals

      await this.runDiff(inputs, { theme, contextLines, showLineNumbers, wrapLines, truncateLines, maxWidth })

      return
    }

    if (positionals.length === 0) {
      console.error("Please specify an input file.")
      process.exit(1)
    }

    const filename = positionals[0]
    const filePath = resolve(filename)

    let content: string

    try {
      content = readFileSync(filePath, "utf-8")
    } catch (error) {
      if (error instanceof Error && (error as NodeJS.ErrnoException).code === "ENOENT") {
        console.error(`File not found: ${filename}`)
      } else {
        console.error(`Error: ${error instanceof Error ? error.message : error}`)
      }

      process.exit(1)
    }

    try {
      const highlighter = new Highlighter(theme)
      await highlighter.initialize()

      const highlighted = format === "html"
        ? highlighter.highlightHTML(filePath, content, {
            focusLine,
            contextLines,
            showLineNumbers,
            themeLabel: theme,
          })
        : highlighter.highlight(filePath, content, {
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
      console.error(`Error: ${error instanceof Error ? error.message : error}`)
      process.exit(1)
    }
  }
}
