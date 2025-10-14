import { colorize } from "@herb-tools/highlighter"

import { BaseFormatter } from "./base-formatter.js"

import type { Diagnostic } from "@herb-tools/core"
import type { ProcessedFile } from "../file-processor.js"

export class SimpleFormatter extends BaseFormatter {
  async format(allOffenses: ProcessedFile[]): Promise<void> {
    if (allOffenses.length === 0) return

    const groupedOffenses = new Map<string, ProcessedFile[]>()

    for (const processedFile of allOffenses) {
      const offenses = groupedOffenses.get(processedFile.filename) || []
      offenses.push(processedFile)
      groupedOffenses.set(processedFile.filename, offenses)
    }

    for (const [filename, processedFiles] of groupedOffenses) {
      console.log("")
      this.formatFileProcessed(filename, processedFiles)
    }
  }

  formatFile(filename: string, offenses: Diagnostic[]): void {
    console.log(`${colorize(filename, "cyan")}:`)

    for (const offense of offenses) {
      const isError = offense.severity === "error"
      const severity = isError ? colorize("✗", "brightRed") : colorize("⚠", "brightYellow")
      const rule = colorize(`(${offense.code})`, "blue")
      const locationString = `${offense.location.start.line}:${offense.location.start.column}`
      const paddedLocation = locationString.padEnd(4)

      console.log(`  ${colorize(paddedLocation, "gray")} ${severity} ${offense.message} ${rule}`)
    }
    console.log("")
  }

  formatFileProcessed(filename: string, processedFiles: ProcessedFile[]): void {
    console.log(`${colorize(filename, "cyan")}:`)

    for (const { offense, autocorrectable } of processedFiles) {
      const isError = offense.severity === "error"
      const severity = isError ? colorize("✗", "brightRed") : colorize("⚠", "brightYellow")
      const rule = colorize(`(${offense.code})`, "blue")
      const locationString = `${offense.location.start.line}:${offense.location.start.column}`
      const paddedLocation = locationString.padEnd(4)
      const correctable = autocorrectable ? colorize(colorize(" [Correctable]", "green"), "bold") : ""

      console.log(`  ${colorize(paddedLocation, "gray")} ${severity} ${offense.message} ${rule}${correctable}`)
    }
    console.log("")
  }
}
