import { colorize } from "@herb-tools/highlighter"

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
    lines.push(` ${colorize("Backend comparison:", "bold")}`)
    lines.push(`  ${colorize(pad("Checked"), "gray")} ${colorize(`${totalFiles} ${pluralize(totalFiles, "file")}`, "cyan")}`)
    lines.push(`  ${colorize(pad("Result"), "gray")} ${colorize(colorize("all files matched", "green"), "bold")}`)

    return lines.join("\n")
  }

  const matchedFiles = totalFiles - mismatches.length

  lines.push("\n")
  lines.push(` ${colorize("Backend comparison:", "bold")}`)
  lines.push(`  ${colorize(pad("Checked"), "gray")} ${colorize(`${totalFiles} ${pluralize(totalFiles, "file")}`, "cyan")}`)
  lines.push(`  ${colorize(pad("Result"), "gray")} ${colorize(colorize(`${mismatches.length} ${pluralize(mismatches.length, "file")} with differences`, "brightRed"), "bold")} | ${colorize(colorize(`${matchedFiles} matched`, "green"), "bold")} ${colorize(`(${totalFiles} total)`, "gray")}`)

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
  lines.push(`  ${colorize("Please report this bug at https://github.com/marcoroth/herb/issues", "gray")}`)

  return lines.join("\n")
}
