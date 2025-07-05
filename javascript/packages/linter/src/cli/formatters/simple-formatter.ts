import { colorize } from "@herb-tools/highlighter"

import { BaseFormatter } from "./base-formatter.js"

import type { Diagnostic } from "@herb-tools/core"
import type { ProcessedFile } from "../file-processor.js"

export class SimpleFormatter extends BaseFormatter {
  async format(allDiagnostics: ProcessedFile[]): Promise<void> {
    if (allDiagnostics.length === 0) return

    const groupedDiagnostics = new Map<string, Diagnostic[]>()

    for (const { filename, diagnostic } of allDiagnostics) {
      const diagnostics = groupedDiagnostics.get(filename) || []
      diagnostics.push(diagnostic)
      groupedDiagnostics.set(filename, diagnostics)
    }

    for (const [filename, diagnostics] of groupedDiagnostics) {
      console.log("")
      this.formatFile(filename, diagnostics)
    }
  }

  formatFile(filename: string, diagnostics: Diagnostic[]): void {
    console.log(`${colorize(filename, "cyan")}:`)

    for (const diagnostic of diagnostics) {
      const isError = diagnostic.severity === "error"
      const severity = isError ? colorize("✗", "brightRed") : colorize("⚠", "brightYellow")
      const rule = colorize(`(${diagnostic.code})`, "blue")
      const locationString = `${diagnostic.location.start.line}:${diagnostic.location.start.column}`
      const paddedLocation = locationString.padEnd(4) // Pad to 4 characters for alignment

      console.log(`  ${colorize(paddedLocation, "gray")} ${severity} ${diagnostic.message} ${rule}`)
    }
    console.log("")
  }
}
