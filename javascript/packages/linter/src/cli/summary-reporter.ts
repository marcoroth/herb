import { colorize } from "@herb-tools/highlighter"

export interface SummaryData {
  files: string[]
  totalErrors: number
  totalWarnings: number
  totalInfo?: number
  totalHints?: number
  totalIgnored: number
  totalWouldBeIgnored?: number
  filesWithOffenses: number
  ruleCount: number
  startTime: number
  startDate: Date
  showTiming: boolean
  ruleOffenses: Map<string, { count: number, files: Set<string> }>
  autofixableCount: number
  ignoreDisableComments?: boolean
}

export class SummaryReporter {
  private pluralize(count: number, singular: string, plural?: string): string {
    return count === 1 ? singular : (plural || `${singular}s`)
  }

  displaySummary(data: SummaryData): void {
    const { files, totalErrors, totalWarnings, totalInfo = 0, totalHints = 0, totalIgnored, totalWouldBeIgnored, filesWithOffenses, ruleCount, startTime, startDate, showTiming, autofixableCount, ignoreDisableComments } = data

    console.log("\n")
    console.log(` ${colorize("Summary:", "bold")}`)

    const labelWidth = 12
    const pad = (label: string) => label.padEnd(labelWidth)

    console.log(`  ${colorize(pad("Checked"), "gray")} ${colorize(`${files.length} ${this.pluralize(files.length, "file")}`, "cyan")}`)

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

    let offensesSummary = ""
    const parts = []

    if (totalErrors > 0) {
      parts.push(colorize(colorize(`${totalErrors} ${this.pluralize(totalErrors, "error")}`, "brightRed"), "bold"))
    }

    if (totalWarnings > 0) {
      parts.push(colorize(colorize(`${totalWarnings} ${this.pluralize(totalWarnings, "warning")}`, "brightYellow"), "bold"))
    } else if (totalErrors > 0) {
      parts.push(colorize(colorize(`${totalWarnings} ${this.pluralize(totalWarnings, "warning")}`, "green"), "bold"))
    }

    if (totalInfo > 0) {
      parts.push(colorize(colorize(`${totalInfo} info`, "brightBlue"), "bold"))
    }

    if (totalHints > 0) {
      parts.push(colorize(colorize(`${totalHints} ${this.pluralize(totalHints, "hint")}`, "gray"), "bold"))
    }

    if (totalIgnored > 0) {
      parts.push(colorize(colorize(`${totalIgnored} ignored`, "gray"), "bold"))
    }

    if (parts.length === 0) {
      offensesSummary = colorize(colorize("0 offenses", "green"), "bold")
    } else {
      offensesSummary = parts.join(" | ")

      let detailText = ""

      const totalOffenses = totalErrors + totalWarnings + totalInfo + totalHints

      if (filesWithOffenses > 0) {
        detailText = `${totalOffenses} ${this.pluralize(totalOffenses, "offense")} across ${filesWithOffenses} ${this.pluralize(filesWithOffenses, "file")}`
      }

      if (detailText) {
        offensesSummary += ` ${colorize(colorize(`(${detailText})`, "gray"), "dim")}`
      }
    }

    console.log(`  ${colorize(pad("Offenses"), "gray")} ${offensesSummary}`)

    if (ignoreDisableComments && totalWouldBeIgnored && totalWouldBeIgnored > 0) {
      const message = `${colorize(colorize(`${totalWouldBeIgnored} additional ${this.pluralize(totalWouldBeIgnored, "offense")} reported (would have been ignored)`, "cyan"), "bold")}`
      console.log(`  ${colorize(pad("Note"), "gray")} ${message}`)
    }

    const totalOffenses = totalErrors + totalWarnings + totalInfo + totalHints

    if (autofixableCount > 0 || totalOffenses > 0) {
      let fixableLine = `${colorize(colorize(`${totalOffenses} ${this.pluralize(totalOffenses, "offense")}`, "brightRed"), "bold")}`

      if (autofixableCount > 0) {
        fixableLine += ` | ${colorize(colorize(`${autofixableCount} autocorrectable using \`--fix\``, "green"), "bold")}`
      }

      console.log(`  ${colorize(pad("Fixable"), "gray")} ${fixableLine}`)
    }

    if (showTiming) {
      const duration = Date.now() - startTime
      const timeString = startDate.toTimeString().split(' ')[0]

      console.log(`  ${colorize(pad("Start at"), "gray")} ${colorize(timeString, "cyan")}`)
      console.log(`  ${colorize(pad("Duration"), "gray")} ${colorize(`${duration}ms`, "cyan")} ${colorize(colorize(`(${ruleCount} ${this.pluralize(ruleCount, "rule")})`, "gray"), "dim")}`)
    }

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
