import { colorize } from "@herb-tools/highlighter"

import type { FormatSkipReason } from "../formatter.js"

export interface SkippedFile {
  path: string
  reason: FormatSkipReason
  errorCount: number
}

export interface SummaryData {
  fileCount: number
  changedFiles: string[]
  skippedFiles: SkippedFile[]
  erroredCount: number
  isCheckMode: boolean
  startTime: number
  startDate: Date
  showTiming: boolean
}

const SKIP_LABELS: Record<FormatSkipReason, string> = {
  "parse-errors": "with parse errors",
  "scaffold": "scaffold templates",
  "ignore-directive": "with herb:formatter ignore"
}

export class SummaryReporter {
  private pluralize(count: number, singular: string, plural: string = `${singular}s`): string {
    return count === 1 ? singular : plural
  }

  private parseErrorFiles(data: SummaryData): SkippedFile[] {
    return data.skippedFiles.filter(file => file.reason === "parse-errors")
  }

  displaySkipped(data: SummaryData): void {
    const skipped = data.skippedFiles

    if (skipped.length === 0) return

    const parseErrors = this.parseErrorFiles(data)

    if (parseErrors.length > 0) {
      console.log("")
      console.log(` ${colorize("Skipped:", "bold")} ${colorize(`${parseErrors.length} ${this.pluralize(parseErrors.length, "file")} could not be parsed and ${this.pluralize(parseErrors.length, "was", "were")} left unchanged`, "gray")}`)

      for (const file of parseErrors) {
        const detail = `(${file.errorCount} ${this.pluralize(file.errorCount, "parser error")})`

        console.log(`  ${colorize("!", "yellow")} ${colorize(file.path, "cyan")} ${colorize(detail, "gray")}`)
      }
    }
  }

  displaySummary(data: SummaryData): void {
    const { fileCount, changedFiles, skippedFiles, erroredCount, isCheckMode } = data

    const skippedCount = skippedFiles.length
    const changedCount = changedFiles.length
    const cleanCount = fileCount - changedCount - skippedCount - erroredCount

    console.log("\n")
    console.log(` ${colorize("Summary:", "bold")}`)

    const labelWidth = 12
    const pad = (label: string) => label.padEnd(labelWidth)
    const line = (label: string, value: string) => console.log(`  ${colorize(pad(label), "gray")} ${value}`)

    line("Checked", colorize(`${fileCount} ${this.pluralize(fileCount, "file")}`, "cyan"))

    const fileParts: string[] = []

    if (changedCount > 0) {
      const label = isCheckMode ? `${changedCount} unformatted` : `${changedCount} formatted`
      const color = isCheckMode ? "brightRed" : "green"

      fileParts.push(colorize(colorize(label, color), "bold"))
    }

    if (cleanCount > 0) {
      const label = isCheckMode ? `${cleanCount} clean` : `${cleanCount} unchanged`

      fileParts.push(colorize(colorize(label, "green"), "bold"))
    }

    if (skippedCount > 0) {
      fileParts.push(colorize(colorize(`${skippedCount} skipped`, "yellow"), "bold"))
    }

    if (erroredCount > 0) {
      fileParts.push(colorize(colorize(`${erroredCount} errored`, "brightRed"), "bold"))
    }

    if (fileParts.length === 0) {
      fileParts.push(colorize(colorize("0 files", "gray"), "bold"))
    }

    line("Files", `${fileParts.join(" | ")} ${colorize(`(${fileCount} total)`, "gray")}`)

    if (skippedCount > 0) {
      const byReason = new Map<FormatSkipReason, number>()

      for (const file of skippedFiles) {
        byReason.set(file.reason, (byReason.get(file.reason) ?? 0) + 1)
      }

      const reasonParts = Array.from(byReason.entries()).map(([reason, count]) => {
        return colorize(colorize(`${count} ${SKIP_LABELS[reason]}`, "yellow"), "bold")
      })

      line("Skipped", reasonParts.join(" | "))
    }

    if (data.showTiming) {
      const duration = Date.now() - data.startTime
      const timeString = data.startDate.toTimeString().split(" ")[0]

      line("Start at", colorize(timeString, "cyan"))
      line("Duration", colorize(`${duration}ms`, "cyan"))
    }

    this.displayTips(data)
  }

  private displayTips(data: SummaryData): void {
    const parseErrors = this.parseErrorFiles(data)

    if (parseErrors.length > 0) {
      console.log("")
      console.log(` ${colorize("TIP:", "bold")} Herb won't format a file it can't parse, so these are left as-is.`)
      console.log(`      Run ${colorize("herb-lint", "cyan")} to see the parser errors in context.`)

      return
    }

    if (data.changedFiles.length === 0 && data.fileCount > 1 && data.erroredCount === 0) {
      console.log("")

      const message = data.isCheckMode ? "All files are properly formatted!" : "All files are already formatted!"

      console.log(` ${colorize("✓", "brightGreen")} ${colorize(message, "green")}`)
    }
  }
}
