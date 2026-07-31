import { colorize } from "@herb-tools/highlighter"

import { version } from "../package.json"

import type { LintOffense } from "./types.js"

export interface NormalizedOffense {
  rule: string
  message: string
  severity: string
  line: number
  column: number
}

export interface BackendMismatch {
  filename: string
  jsOffenseCount: number
  rustOffenseCount: number
  jsOnly: NormalizedOffense[]
  rustOnly: NormalizedOffense[]
}

export function normalizeOffenses(offenses: LintOffense[]): NormalizedOffense[] {
  return offenses
    .map(o => ({
      rule: o.rule,
      message: o.message,
      severity: o.severity,
      line: o.location.start.line,
      column: o.location.start.column,
    }))
    .sort((a, b) =>
      a.line - b.line ||
      a.column - b.column ||
      a.rule.localeCompare(b.rule) ||
      a.message.localeCompare(b.message)
    )
}

export function compareBackendOffenses(
  filename: string,
  jsOffenses: LintOffense[],
  rustOffenses: LintOffense[]
): BackendMismatch | null {
  const jsNormalized = normalizeOffenses(jsOffenses)
  const rustNormalized = normalizeOffenses(rustOffenses)

  const jsJson = jsNormalized.map(o => JSON.stringify(o))
  const rustJson = rustNormalized.map(o => JSON.stringify(o))

  const rustSet = new Set(rustJson)
  const jsSet = new Set(jsJson)

  const jsOnly = jsNormalized.filter((_, i) => !rustSet.has(jsJson[i]))
  const rustOnly = rustNormalized.filter((_, i) => !jsSet.has(rustJson[i]))

  if (jsOnly.length === 0 && rustOnly.length === 0) {
    return null
  }

  return {
    filename,
    jsOffenseCount: jsOffenses.length,
    rustOffenseCount: rustOffenses.length,
    jsOnly,
    rustOnly,
  }
}

function pluralize(count: number, singular: string, plural?: string): string {
  return count === 1 ? singular : (plural || `${singular}s`)
}

export function formatMismatchReport(mismatches: BackendMismatch[], totalFiles: number): string {
  const lines: string[] = []
  const labelWidth = 12
  const pad = (label: string) => label.padEnd(labelWidth)

  if (mismatches.length === 0) {
    lines.push("\n")
    lines.push(` ${colorize("Backend comparison:", "bold")} ${colorize(`herb v${version}`, "gray")}`)
    lines.push(`  ${colorize(pad("Checked"), "gray")} ${colorize(`${totalFiles} ${pluralize(totalFiles, "file")}`, "cyan")}`)
    lines.push(`  ${colorize(pad("Result"), "gray")} ${colorize(colorize("\u2713 all files matched", "brightGreen"), "bold")}`)

    return lines.join("\n")
  }

  const matchedFiles = totalFiles - mismatches.length

  lines.push("\n")
  lines.push(` ${colorize("Backend comparison:", "bold")} ${colorize(`herb v${version}`, "gray")}`)
  lines.push(`  ${colorize(pad("Checked"), "gray")} ${colorize(`${totalFiles} ${pluralize(totalFiles, "file")}`, "cyan")}`)
  lines.push(`  ${colorize(pad("Result"), "gray")} ${colorize(colorize(`\u2717 ${mismatches.length} ${pluralize(mismatches.length, "file")} with differences`, "brightRed"), "bold")} | ${colorize(colorize(`${matchedFiles} matched`, "green"), "bold")} ${colorize(`(${totalFiles} total)`, "gray")}`)

  lines.push("")
  lines.push(` ${colorize("Differences:", "bold")}`)

  for (const mismatch of mismatches) {
    lines.push(`  ${colorize(mismatch.filename, "cyan")} ${colorize(`(JS: ${mismatch.jsOffenseCount}, Rust: ${mismatch.rustOffenseCount})`, "gray")}`)

    for (const offense of mismatch.jsOnly) {
      lines.push(`    ${colorize("- JS only:", "brightYellow")} ${colorize(`[${offense.severity}]`, "gray")} ${offense.rule}: "${offense.message}" ${colorize(`at ${offense.line}:${offense.column}`, "gray")}`)
    }

    for (const offense of mismatch.rustOnly) {
      lines.push(`    ${colorize("- Rust only:", "brightYellow")} ${colorize(`[${offense.severity}]`, "gray")} ${offense.rule}: "${offense.message}" ${colorize(`at ${offense.line}:${offense.column}`, "gray")}`)
    }
  }

  lines.push("")
  lines.push(` ${colorize("Reproduce:", "bold")}`)
  lines.push(`  ${colorize("Re-check only the files above, without linting the whole project again:", "gray")}`)
  lines.push("")
  lines.push(`    ${colorize(reproduceCommand(mismatches), "cyan")}`)

  lines.push("")
  lines.push(`  ${colorize("Please report this bug at https://github.com/marcoroth/herb/issues", "gray")}`)

  return lines.join("\n")
}

export function reproduceCommand(mismatches: BackendMismatch[]): string {
  const filenames = mismatches.map(mismatch => shellQuote(mismatch.filename))

  return `herb-lint ${filenames.join(" ")} --jobs 1 --fail-on-backend-mismatch --no-timing`
}

function shellQuote(value: string): string {
  return /^[A-Za-z0-9._\/-]+$/.test(value) ? value : `'${value.replace(/'/g, `'\\''`)}'`
}

const SPINNER_FRAMES = ["\u280b", "\u2819", "\u2839", "\u2838", "\u283c", "\u2834", "\u2826", "\u2827", "\u2807", "\u280f"]
const RENDER_INTERVAL_MS = 80
const HERB = "\ud83c\udf3f"

export class ComparisonProgress {
  private processed = 0
  private lastPercent = -1
  private lastRenderedAt = 0
  private frame = 0
  private readonly startedAt = Date.now()
  private readonly interactive: boolean

  constructor(
    private readonly total: number,
    private readonly write: (text: string) => void = text => process.stderr.write(text),
    interactive: boolean = Boolean(process.stderr.isTTY)
  ) {
    this.interactive = interactive
  }

  advance(count: number = 1): void {
    this.processed += count

    if (this.total <= 0) return

    if (this.interactive) {
      this.renderInteractive()
      return
    }

    const percent = this.percent()

    if (percent <= this.lastPercent) return

    this.lastPercent = percent
    this.write(`  [${this.processed}/${this.total} (${percent}%)] comparing backends\n`)
  }

  finish(): void {
    if (!this.interactive) return

    this.write("\r\u001b[K")
  }

  private percent(): number {
    return Math.min(100, Math.floor((this.processed / this.total) * 100))
  }

  private renderInteractive(): void {
    const now = Date.now()
    const percent = this.percent()
    const done = this.processed >= this.total
    const advancedAPercent = percent > this.lastPercent

    if (!done && !advancedAPercent && now - this.lastRenderedAt < RENDER_INTERVAL_MS) return

    this.lastRenderedAt = now
    this.lastPercent = percent
    const spinner = SPINNER_FRAMES[this.frame++ % SPINNER_FRAMES.length]
    const label = `${HERB} @herb-tools/linter v${version}`
    const summary = `${percent}% ${this.processed}/${this.total} ${this.formatDuration(now - this.startedAt)}`
    const columns = process.stderr.columns || 80
    const barWidth = Math.max(0, Math.min(24, columns - summary.length - label.length - 26))
    const filled = Math.round((percent / 100) * barWidth)
    const bar = barWidth > 0
      ? `${colorize("\u2588".repeat(filled), "brightGreen")}${colorize("\u2591".repeat(barWidth - filled), "gray")} `
      : ""

    this.write(`\r\u001b[K  ${label} ${colorize(spinner, "brightGreen")} ${bar}${colorize(summary, "gray")}`)
  }

  private formatDuration(milliseconds: number): string {
    const seconds = Math.floor(milliseconds / 1000)

    return seconds < 60 ? `${seconds}s` : `${Math.floor(seconds / 60)}m${String(seconds % 60).padStart(2, "0")}s`
  }
}
