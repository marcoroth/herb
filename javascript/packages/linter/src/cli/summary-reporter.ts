import { colorize, hyperlink } from "@herb-tools/highlighter"
import { UNRELEASED_VERSION, compareSemver } from "../semver.js"

import { ruleDocumentationUrl } from "../urls.js"

import type { VersionSkippedRule } from "../linter.js"

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
  rulesSkippedByVersion?: VersionSkippedRule[]
  rulesDisabledByConfig?: number
  rulesNotEnabledByDefault?: number
  configVersion?: string
  configPath?: string
  hasConfigFile?: boolean
  toolVersion?: string
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

      if (filesWithOffenses > 0) {
        filesSummary = `${colorize(colorize(`${filesWithOffenses} with offenses`, "brightRed"), "bold")} | ${colorize(colorize(`${filesClean} clean`, "green"), "bold")} ${colorize(`(${filesChecked} total)`, "gray")}`
      } else {
        filesSummary = `${colorize(colorize(`${filesChecked} clean`, "green"), "bold")} ${colorize(`(${filesChecked} total)`, "gray")}`
      }

      console.log(`  ${colorize(pad("Files"), "gray")} ${filesSummary}`)
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
      parts.push(colorize(colorize(`${totalInfo} info`, "cyan"), "bold"))
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
        offensesSummary += ` ${colorize(`(${detailText})`, "gray")}`
      }
    }

    console.log(`  ${colorize(pad("Offenses"), "gray")} ${offensesSummary}`)

    if (ignoreDisableComments && totalWouldBeIgnored && totalWouldBeIgnored > 0) {
      const message = `${colorize(colorize(`${totalWouldBeIgnored} additional ${this.pluralize(totalWouldBeIgnored, "offense")} reported (would have been ignored)`, "cyan"), "bold")}`
      console.log(`  ${colorize(pad("Note"), "gray")} ${message}`)
    }

    const totalOffenses = totalErrors + totalWarnings + totalInfo + totalHints

    {
      let fixableLine: string

      if (autofixableCount > 0) {
        fixableLine = `${colorize(colorize(`${totalOffenses} ${this.pluralize(totalOffenses, "offense")}`, "brightRed"), "bold")} | ${colorize(colorize(`${autofixableCount} autocorrectable using \`--fix\``, "green"), "bold")}`
      } else {
        fixableLine = `${colorize(colorize(`${autofixableCount} ${this.pluralize(autofixableCount, "offense")}`, "gray"), "bold")}`
      }

      console.log(`  ${colorize(pad("Fixable"), "gray")} ${fixableLine}`)
    }

    const notEnabledCount = data.rulesNotEnabledByDefault ?? 0
    const disabledCount = data.rulesDisabledByConfig ?? 0
    const skippedCount = data.rulesSkippedByVersion?.length ?? 0
    const rulesParts = [colorize(colorize(`${ruleCount} enabled`, "green"), "bold")]

    if (notEnabledCount > 0) rulesParts.push(colorize(`${notEnabledCount} not enabled`, "cyan"))
    if (disabledCount > 0) rulesParts.push(colorize(`${disabledCount} disabled`, "yellow"))
    if (skippedCount > 0) rulesParts.push(colorize(`${skippedCount} skipped (version)`, "gray"))

    console.log(`  ${colorize(pad("Rules"), "gray")} ${rulesParts.join(" | ")}`)

    if (showTiming) {
      const duration = Date.now() - startTime
      const timeString = startDate.toTimeString().split(' ')[0]

      console.log(`  ${colorize(pad("Start at"), "gray")} ${colorize(timeString, "cyan")}`)
      console.log(`  ${colorize(pad("Duration"), "gray")} ${colorize(`${duration}ms`, "cyan")}`)
    }

    if (filesWithOffenses === 0 && files.length > 1) {
      console.log("")
      console.log(` ${colorize("✓", "brightGreen")} ${colorize("All files are clean!", "green")}`)
    }

    this.displayVersionSkippedRules(data)
  }

  displayVersionSkippedRules(data: SummaryData): void {
    const { rulesSkippedByVersion: skippedRules, configVersion, configPath, hasConfigFile, toolVersion } = data

    if (!skippedRules || skippedRules.length === 0) return
    if (!hasConfigFile) return

    const ruleCount = skippedRules.length
    const suggestedVersion = toolVersion || configVersion || "latest"

    console.log("")
    console.log(` ${colorize(`New rules available:`, "bold")}`)
    console.log(`  Your ${colorize(".herb.yml", "cyan")} version is ${colorize(configVersion!, "cyan")}. ${colorize(String(ruleCount), "bold")} new ${this.pluralize(ruleCount, "rule")} ${ruleCount === 1 ? "is" : "are"} disabled to ease upgrades:`)

    if (configPath) {
      console.log(`  ${colorize("from Herb config:", "gray")} ${colorize(configPath, "cyan")}`)
    }

    console.log("")

    const grouped = new Map<string, string[]>()

    for (const rule of skippedRules) {
      const existing = grouped.get(rule.introducedIn) || []
      existing.push(rule.ruleName)
      grouped.set(rule.introducedIn, existing)
    }

    const sortedVersions = Array.from(grouped.keys()).sort((a, b) => compareSemver(a, b))

    for (const version of sortedVersions) {
      const ruleNames = grouped.get(version)!
      const versionLabel = version === UNRELEASED_VERSION ? "next release" : version

      for (const ruleName of ruleNames) {
        const ruleText = colorize(ruleName, "white")
        const ruleLink = hyperlink(ruleText, ruleDocumentationUrl(ruleName))
        console.log(`  ${ruleLink} ${colorize(`(introduced in ${versionLabel})`, "gray")}`)
      }
    }

    console.log("")
    console.log(`  Run ${colorize("herb-lint --upgrade", "cyan")} to update the version. Rules with no offenses will be`)
    console.log(`  enabled automatically; rules with offenses will be disabled to ease the upgrade.`)
  }

  displayMostViolatedRules(ruleOffenses: Map<string, { count: number, files: Set<string> }>, limit: number = 5): void {
    if (ruleOffenses.size === 0) return

    const allRules = Array.from(ruleOffenses.entries()).sort((a, b) => b[1].count - a[1].count)
    const displayedRules = allRules.slice(0, limit)
    const remainingRules = allRules.slice(limit)

    const title = ruleOffenses.size <= limit ? "Rule offenses:" : "Most frequent rule offenses:"
    console.log("\n")
    console.log(` ${colorize(title, "bold")}`)

    for (const [rule, data] of displayedRules) {
      const fileCount = data.files.size
      const countText = `(${data.count} ${this.pluralize(data.count, "offense")} in ${fileCount} ${this.pluralize(fileCount, "file")})`
      const ruleText = colorize(rule, "white")
      const ruleLink = hyperlink(ruleText, ruleDocumentationUrl(rule))
      console.log(`  ${ruleLink} ${colorize(countText, "gray")}`)
    }

    if (remainingRules.length > 0) {
      const remainingOffenseCount = remainingRules.reduce((sum, [_, data]) => sum + data.count, 0)
      const remainingRuleCount = remainingRules.length
      console.log(colorize(`\n  ...and ${remainingRuleCount} more ${this.pluralize(remainingRuleCount, "rule")} with ${remainingOffenseCount} ${this.pluralize(remainingOffenseCount, "offense")}`, "gray"))
    }
  }
}
