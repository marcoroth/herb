import { colorize } from "@herb-tools/highlighter"

import { BaseFormatter } from "./base-formatter.js"

import type { Diagnostic } from "@herb-tools/core"
import type { ProcessedFile } from "../file-processor.js"

export class SimpleFormatter extends BaseFormatter {
  async format(allOffenses: ProcessedFile[]): Promise<void> {
    if (allOffenses.length === 0) return

    const groupedOffenses = new Map<string, Diagnostic[]>()

    for (const { filename, offense } of allOffenses) {
      const offenses = groupedOffenses.get(filename) || []
      offenses.push(offense)
      groupedOffenses.set(filename, offenses)
    }

    for (const [filename, offenses] of groupedOffenses) {
      console.log("")
      this.formatFile(filename, offenses)
    }
  }

  formatFile(filename: string, offenses: Diagnostic[]): void {
    console.log(`${colorize(filename, "cyan")}:`)

    for (const offense of offenses) {
      const isError = offense.severity === "error"
      const severity = isError ? colorize("✗", "brightRed") : colorize("⚠", "brightYellow")
      const rule = colorize(`(${offense.code})`, "blue")
      const locationString = `${offense.location.start.line}:${offense.location.start.column}`
      const paddedLocation = locationString.padEnd(4) // Pad to 4 characters for alignment

      console.log(`  ${colorize(paddedLocation, "gray")} ${severity} ${offense.message} ${rule}`)
    }
    console.log("")
  }
}
