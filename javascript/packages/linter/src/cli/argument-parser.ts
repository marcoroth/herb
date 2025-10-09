import dedent from "dedent"

import { parseArgs } from "util"
import { Herb } from "@herb-tools/node-wasm"

import { THEME_NAMES, DEFAULT_THEME } from "@herb-tools/highlighter"
import type { ThemeInput } from "@herb-tools/highlighter"

import { name, version, dependencies } from "../../package.json"

export type FormatOption = "simple" | "detailed" | "json"

export interface ParsedArguments {
  patterns: string[]
  configFile?: string
  formatOption: FormatOption
  showTiming: boolean
  theme: ThemeInput
  wrapLines: boolean
  truncateLines: boolean
  useGitHubActions: boolean
  fix: boolean
  ignoreDisableComments: boolean
  force: boolean
  init: boolean
  loadCustomRules: boolean
}

export class ArgumentParser {
  private readonly usage = dedent`
    Usage: herb-lint [files|directories|glob-patterns...] [options]

    Arguments:
      files            Files, directories, or glob patterns to lint (defaults to configured extensions in .herb.yml)
                       Multiple arguments are supported (e.g., herb-lint file1.erb file2.erb dir/ "**/*.erb")

    Options:
      -h, --help                    show help
      -v, --version                 show version
      --init                        create a .herb.yml configuration file in the current directory
      -c, --config-file <path>      explicitly specify path to .herb.yml config file
      --force                       force linting even if disabled in .herb.yml
      --fix                         automatically fix auto-correctable offenses
      --ignore-disable-comments     report offenses even when suppressed with <%# herb:disable %> comments
      --format                      output format (simple|detailed|json) [default: detailed]
      --simple                      use simple output format (shortcut for --format simple)
      --json                        use JSON output format (shortcut for --format json)
      --github                      enable GitHub Actions annotations (combines with --format)
      --no-github                   disable GitHub Actions annotations (even in GitHub Actions environment)
      --no-custom-rules             disable loading custom rules from project (custom rules are loaded by default from .herb/rules/**/*.{mjs,js})
      --theme                       syntax highlighting theme (${THEME_NAMES.join("|")}) or path to custom theme file [default: ${DEFAULT_THEME}]
      --no-color                    disable colored output
      --no-timing                   hide timing information
      --no-wrap-lines               disable line wrapping
      --truncate-lines              enable line truncation (mutually exclusive with line wrapping)
  `

  parse(argv: string[]): ParsedArguments {
    const { values, positionals } = parseArgs({
      args: argv.slice(2),
      options: {
        help: { type: "boolean", short: "h" },
        version: { type: "boolean", short: "v" },
        init: { type: "boolean" },
        "config-file": { type: "string", short: "c" },
        force: { type: "boolean" },
        fix: { type: "boolean" },
        "ignore-disable-comments": { type: "boolean" },
        format: { type: "string" },
        simple: { type: "boolean" },
        json: { type: "boolean" },
        github: { type: "boolean" },
        "no-github": { type: "boolean" },
        theme: { type: "string" },
        "no-color": { type: "boolean" },
        "no-timing": { type: "boolean" },
        "no-wrap-lines": { type: "boolean" },
        "truncate-lines": { type: "boolean" },
        "no-custom-rules": { type: "boolean" }
      },
      allowPositionals: true
    })

    if (values.help) {
      console.log(this.usage)
      process.exit(0)
    }

    if (values.version) {
      console.log("Versions:")
      console.log(`  ${name}@${version}`)
      console.log(`  @herb-tools/printer@${dependencies["@herb-tools/printer"]}`)
      console.log(`  ${Herb.version}`.split(", ").join("\n  "))
      process.exit(0)
    }

    const isGitHubActions = process.env.GITHUB_ACTIONS === "true"

    let formatOption: FormatOption = "detailed"
    if (values.format && (values.format === "detailed" || values.format === "simple" || values.format === "json")) {
      formatOption = values.format
    }

    if (values.simple) {
      formatOption = "simple"
    }

    if (values.json) {
      formatOption = "json"
    }

    const useGitHubActions = (values.github || isGitHubActions) && !values["no-github"]

    if (useGitHubActions && formatOption === "json") {
      console.error("Error: --github cannot be used with --json format. JSON format is already structured for programmatic consumption.")
      process.exit(1)
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
    const patterns = this.getFilePatterns(positionals)
    const fix = values.fix || false
    const force = !!values.force
    const ignoreDisableComments = values["ignore-disable-comments"] || false
    const configFile = values["config-file"]
    const init = values.init || false
    const loadCustomRules = !values["no-custom-rules"]

    return { patterns, configFile, formatOption, showTiming, theme, wrapLines, truncateLines, useGitHubActions, fix, ignoreDisableComments, force, init, loadCustomRules }
  }

  private getFilePatterns(positionals: string[]): string[] {
    return positionals
  }
}
