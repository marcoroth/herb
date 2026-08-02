import dedent from "dedent"

import { availableParallelism } from "node:os"
import { parseArgs } from "util"
import { Herb } from "@herb-tools/node-wasm"

import { THEME_NAMES, DEFAULT_THEME } from "@herb-tools/highlighter"
import { DIAGNOSTIC_SEVERITIES, isDiagnosticSeverity } from "@herb-tools/core"

import type { ThemeInput } from "@herb-tools/highlighter"
import type { DiagnosticSeverity } from "@herb-tools/core"

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
  fixUnsafe: boolean
  ignoreDisableComments: boolean
  force: boolean
  init: boolean
  upgrade: boolean
  disableFailing: boolean
  loadCustomRules: boolean
  failLevel?: DiagnosticSeverity
  logLevel?: DiagnosticSeverity
  jobs: number
  only?: string[]
  allRules: boolean
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
      --upgrade                     update .herb.yml version and disable all newly introduced rules
      --disable-failing             lint the codebase and disable all rules that have offenses in .herb.yml
      -c, --config-file <path>      explicitly specify path to .herb.yml config file
      --force                       force linting even if disabled in .herb.yml
      --only <rules>                only run the given rules, ignoring the rule configuration in .herb.yml
                                    accepts a comma-separated list and can be passed multiple times
                                    (e.g., herb-lint --only html-img-require-alt,html-tag-name-lowercase)
      --all-rules                   run every rule, ignoring the rule configuration in .herb.yml
                                    including rules that are disabled, not enabled by default,
                                    or introduced after the version in .herb.yml
      --fix                         automatically fix auto-correctable offenses
      --fix-unsafely                also apply unsafe auto-fixes (implies --fix)
      --ignore-disable-comments     report offenses even when suppressed with <%# herb:disable %> comments
      --fail-level <severity>       exit with error code when diagnostics of this severity or higher are present (error|warning|info|hint) [default: error]
      --log-level <severity>        only report diagnostics of this severity or higher (error|warning|info|hint) [default: hint]
                                    lower-severity offenses are still counted in the summary, but aren't
                                    printed or annotated in CI
      --format                      output format (simple|detailed|json) [default: detailed]
      --simple                      use simple output format (shortcut for --format simple)
      --json                        use JSON output format (shortcut for --format json)
      --github                      enable GitHub Actions annotations (combines with --format)
      --no-github                   disable GitHub Actions annotations (even in GitHub Actions environment)
      --no-custom-rules             disable loading custom rules from project (custom rules are loaded by default from .herb/rules/**/*.{mjs,js})
      -j, --jobs <n>                number of parallel workers for linting files [default: auto]
                                    use "auto" to detect based on available CPU cores
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
        upgrade: { type: "boolean" },
        "disable-failing": { type: "boolean" },
        "config-file": { type: "string", short: "c" },
        force: { type: "boolean" },
        only: { type: "string", multiple: true },
        "all-rules": { type: "boolean" },
        fix: { type: "boolean" },
        "fix-unsafely": { type: "boolean" },
        "ignore-disable-comments": { type: "boolean" },
        "fail-level": { type: "string" },
        "log-level": { type: "string" },
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
        "no-custom-rules": { type: "boolean" },
        jobs: { type: "string", short: "j" }
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
    const fixUnsafe = values["fix-unsafely"] || false
    const fix = values.fix || fixUnsafe  // --fix-unsafely implies --fix
    const force = !!values.force
    const ignoreDisableComments = values["ignore-disable-comments"] || false
    const configFile = values["config-file"]
    const init = values.init || false
    const upgrade = values.upgrade || false
    const disableFailing = values["disable-failing"] || false
    const loadCustomRules = !values["no-custom-rules"]

    const allRules = values["all-rules"] || false

    let only: string[] | undefined

    if (values.only) {
      only = [...new Set(values.only.flatMap(value => value.split(",")).map(ruleName => ruleName.trim()).filter(Boolean))]

      if (only.length === 0) {
        console.error(`Error: --only requires at least one rule name.`)
        process.exit(1)
      }

      if (allRules) {
        console.error(`Error: --only and --all-rules can't be combined.`)
        process.exit(1)
      }
    }

    const failLevel = this.parseSeverity(values["fail-level"], "--fail-level")
    const logLevel = this.parseSeverity(values["log-level"], "--log-level")

    let jobs = availableParallelism()

    if (values.jobs && values.jobs !== "auto") {
      const parsed = parseInt(values.jobs, 10)

      if (isNaN(parsed) || parsed < 1) {
        console.error(`Error: Invalid --jobs value "${values.jobs}". Must be a positive integer or "auto".`)
        process.exit(1)
      }

      jobs = parsed
    }

    return { patterns, configFile, formatOption, showTiming, theme, wrapLines, truncateLines, useGitHubActions, fix, fixUnsafe, ignoreDisableComments, force, init, upgrade, disableFailing, loadCustomRules, failLevel, logLevel, jobs, only, allRules }
  }

  private parseSeverity(value: string | undefined, flag: string): DiagnosticSeverity | undefined {
    if (!value) return undefined

    if (!isDiagnosticSeverity(value)) {
      console.error(`Error: Invalid ${flag} value "${value}". Must be one of: ${DIAGNOSTIC_SEVERITIES.join(", ")}`)
      process.exit(1)
    }

    return value
  }

  private getFilePatterns(positionals: string[]): string[] {
    return positionals
  }
}
