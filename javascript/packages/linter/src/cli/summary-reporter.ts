import { colorize } from "@herb-tools/highlighter"

export interface SummaryData {
  files: string[]
  totalErrors: number
  totalWarnings: number
  filesWithOffenses: number
  ruleCount: number
  startTime: number
  startDate: Date
  showTiming: boolean
  ruleOffenses: Map<string, { count: number, files: Set<string> }>
}

export class SummaryReporter {
  private pluralize(count: number, singular: string, plural?: string): string {
    return count === 1 ? singular : (plural || `${singular}s`)
  }

  displaySummary(data: SummaryData): void {
    const { files, totalErrors, totalWarnings, filesWithOffenses, ruleCount, startTime, startDate, showTiming } = data

    console.log("\n")
    console.log(` ${colorize("Summary:", "bold")}`)

    // Calculate padding for alignment
    const labelWidth = 12 // Width for the longest label "Offenses"
    const pad = (label: string) => label.padEnd(labelWidth)

    // Checked summary
    console.log(`  ${colorize(pad("Checked"), "gray")} ${colorize(`${files.length} ${this.pluralize(files.length, "file")}`, "cyan")}`)

    // Files summary (for multiple files)
    if (files.length > 1) {
      const filesChecked = files.length
      const filesClean = filesChecked - filesWithOffenses

      let filesSummary = ""
      let shouldDim = false

      if (filesWithOffenses > 0) {
        filesSummary = `${colorize(colorize(`${filesWithOffenses} with offenses`, "brightRed"), "bold")} | ${colorize(colorize(`${filesClean} clean`, "green"), "bold")} ${colorize(colorize(`(${filesChecked} total)`, "gray"), "dim")}`
      } else {
        filesSummary = `${colorize(colorize(`${filesChecked} clean`, "green"), "bold")} ${colorize(colorize(`(${filesChecked} total)`, "gray"), "dim")}`
        shouldDim = true
      }

      if (shouldDim) {
        console.log(colorize(`  ${colorize(pad("Files"), "gray")} ${filesSummary}`, "dim"))
      } else {
        console.log(`  ${colorize(pad("Files"), "gray")} ${filesSummary}`)
      }
    }

    // Offenses summary with file count
    let offensesSummary = ""
    const parts = []

    // Build the main part with errors and warnings
    if (totalErrors > 0) {
      parts.push(colorize(colorize(`${totalErrors} ${this.pluralize(totalErrors, "error")}`, "brightRed"), "bold"))
    }

    if (totalWarnings > 0) {
      parts.push(colorize(colorize(`${totalWarnings} ${this.pluralize(totalWarnings, "warning")}`, "brightYellow"), "bold"))
    } else if (totalErrors > 0) {
      // Show 0 warnings when there are errors but no warnings
      parts.push(colorize(colorize(`${totalWarnings} ${this.pluralize(totalWarnings, "warning")}`, "green"), "bold"))
    }

    if (parts.length === 0) {
      offensesSummary = colorize(colorize("0 offenses", "green"), "bold")
    } else {
      offensesSummary = parts.join(" | ")
      // Add total count and file count
      let detailText = ""

      const totalOffenses = totalErrors + totalWarnings

      if (filesWithOffenses > 0) {
        detailText = `${totalOffenses} ${this.pluralize(totalOffenses, "offense")} across ${filesWithOffenses} ${this.pluralize(filesWithOffenses, "file")}`
      }

      offensesSummary += ` ${colorize(colorize(`(${detailText})`, "gray"), "dim")}`
    }

    console.log(`  ${colorize(pad("Offenses"), "gray")} ${offensesSummary}`)

    // Timing information (if enabled)
    if (showTiming) {
      const duration = Date.now() - startTime
      const timeString = startDate.toTimeString().split(' ')[0] // HH:MM:SS format

      console.log(`  ${colorize(pad("Start at"), "gray")} ${colorize(timeString, "cyan")}`)
      console.log(`  ${colorize(pad("Duration"), "gray")} ${colorize(`${duration}ms`, "cyan")} ${colorize(colorize(`(${ruleCount} ${this.pluralize(ruleCount, "rule")})`, "gray"), "dim")}`)
    }

    // Success message for all files clean
    if (filesWithOffenses === 0 && files.length > 1) {
      console.log("")
      console.log(` ${colorize("✓", "brightGreen")} ${colorize("All files are clean!", "green")}`)
    }
  }

  displayMostViolatedRules(ruleOffenses: Map<string, { count: number, files: Set<string> }>, limit: number = 5): void {
    if (ruleOffenses.size === 0) return

    const allRules = Array.from(ruleOffenses.entries()).sort((a, b) => b[1].count - a[1].count)
    const displayedRules = allRules.slice(0, limit)
    const remainingRules = allRules.slice(limit)

    const title = ruleOffenses.size <= limit ? "Rule offenses:" : "Most frequent rule offenses:"
    console.log(` ${colorize(title, "bold")}`)

    for (const [rule, data] of displayedRules) {
      const fileCount = data.files.size
      const countText = `(${data.count} ${this.pluralize(data.count, "offense")} in ${fileCount} ${this.pluralize(fileCount, "file")})`
      console.log(`  ${colorize(rule, "gray")} ${colorize(colorize(countText, "gray"), "dim")}`)
    }

    if (remainingRules.length > 0) {
      const remainingOffenseCount = remainingRules.reduce((sum, [_, data]) => sum + data.count, 0)
      const remainingRuleCount = remainingRules.length
      console.log(colorize(colorize(`\n  ...and ${remainingRuleCount} more ${this.pluralize(remainingRuleCount, "rule")} with ${remainingOffenseCount} ${this.pluralize(remainingOffenseCount, "offense")}`, "gray"), "dim"))
    }
  }
}
