import { colorize, hyperlink } from "@herb-tools/highlighter"
import { UNRELEASED_VERSION, DIAGNOSTIC_SEVERITIES, compareSemver, meetsSeverityThreshold } from "@herb-tools/core"

import { ruleDocumentationUrl } from "../urls.js"

import type { DiagnosticSeverity } from "@herb-tools/core"
import type { VersionSkippedRule } from "../linter.js"

const SEVERITY_COLORS: Record<DiagnosticSeverity, "brightRed" | "brightYellow" | "cyan" | "gray"> = {
  error: "brightRed",
  warning: "brightYellow",
  info: "cyan",
  hint: "gray"
}

export interface SummaryData {
  files: string[]
  totalErrors: number
  totalWarnings: number
  totalInfo?: number
  totalHints?: number
  totalIgnored: number
  totalWouldBeIgnored?: number
  filesWithOffenses: number
  filesFailing?: number
  filesNotFailing?: number
  failLevel?: DiagnosticSeverity
  logLevel?: DiagnosticSeverity
  ruleCount: number
  startTime: number
  startDate: Date
  showTiming: boolean
  ruleOffenses: Map<string, { count: number, files: Set<string> }>
  autofixableCount: number
  unsafeAutofixableCount?: number
  ignoreDisableComments?: boolean
  rulesSkippedByVersion?: VersionSkippedRule[]
  rulesDisabledByConfig?: number
  rulesNotEnabledByDefault?: number
  configVersion?: string
  configPath?: string
  hasConfigFile?: boolean
  toolVersion?: string
  only?: string[]
  allRules?: boolean
}

export class SummaryReporter {
  private pluralize(count: number, singular: string, plural?: string): string {
    return count === 1 ? singular : (plural || `${singular}s`)
  }

  private severityPart(severity: DiagnosticSeverity, count: number): string {
    const label = severity === "info" ? `${count} info` : `${count} ${this.pluralize(count, severity)}`

    return colorize(colorize(label, SEVERITY_COLORS[severity]), "bold")
  }

  displaySummary(data: SummaryData): void {
    const { files, totalErrors, totalWarnings, totalInfo = 0, totalHints = 0, totalIgnored, totalWouldBeIgnored, filesWithOffenses, ruleCount, startTime, startDate, showTiming, autofixableCount, ignoreDisableComments } = data

    const failLevel = data.failLevel ?? "error"
    const logLevel = data.logLevel ?? "hint"

    const counts: Record<DiagnosticSeverity, number> = {
      error: totalErrors,
      warning: totalWarnings,
      info: totalInfo,
      hint: totalHints
    }

    const failingSeverities = DIAGNOSTIC_SEVERITIES.filter(severity => meetsSeverityThreshold(severity, failLevel))
    const otherSeverities = DIAGNOSTIC_SEVERITIES.filter(severity => !meetsSeverityThreshold(severity, failLevel))

    const failingCount = failingSeverities.reduce((sum, severity) => sum + counts[severity], 0)
    const otherCount = otherSeverities.reduce((sum, severity) => sum + counts[severity], 0)
    const notReportedCount = DIAGNOSTIC_SEVERITIES
      .filter(severity => !meetsSeverityThreshold(severity, logLevel))
      .reduce((sum, severity) => sum + counts[severity], 0)

    const filesFailing = data.filesFailing ?? filesWithOffenses
    const filesWithOtherOffensesOnly = filesWithOffenses - filesFailing

    console.log("\n")
    console.log(` ${colorize("Summary:", "bold")}`)

    const labelWidth = 12
    const pad = (label: string) => label.padEnd(labelWidth)

    console.log(`  ${colorize(pad("Checked"), "gray")} ${colorize(`${files.length} ${this.pluralize(files.length, "file")}`, "cyan")}`)

    if (files.length > 1) {
      const filesChecked = files.length
      const filesClean = filesChecked - filesWithOffenses
      const fileParts: string[] = []

      if (filesFailing > 0 && filesWithOtherOffensesOnly > 0) {
        fileParts.push(colorize(colorize(`${filesFailing} failing`, "brightRed"), "bold"))
        fileParts.push(colorize(colorize(`${filesWithOtherOffensesOnly} with other offenses`, "brightYellow"), "bold"))
      } else if (filesFailing > 0) {
        fileParts.push(colorize(colorize(`${filesFailing} with offenses`, "brightRed"), "bold"))
      } else if (filesWithOtherOffensesOnly > 0) {
        fileParts.push(colorize(colorize(`${filesWithOtherOffensesOnly} with offenses`, "brightYellow"), "bold"))
      }

      fileParts.push(colorize(colorize(`${filesClean} clean`, "green"), "bold"))

      console.log(`  ${colorize(pad("Files"), "gray")} ${fileParts.join(" | ")} ${colorize(`(${filesChecked} total)`, "gray")}`)
    }

    const parts: string[] = []

    for (const severity of failingSeverities) {
      if (counts[severity] > 0) {
        parts.push(this.severityPart(severity, counts[severity]))
      } else if (severity === "warning" && totalErrors > 0) {
        parts.push(colorize(colorize(`0 ${this.pluralize(0, "warning")}`, "green"), "bold"))
      }
    }

    if (otherCount === 0) {
      for (const severity of otherSeverities) {
        if (counts[severity] > 0) {
          parts.push(this.severityPart(severity, counts[severity]))
        }
      }
    }

    let offensesSummary = ""

    if (parts.length === 0) {
      offensesSummary = colorize(colorize(`0 ${this.pluralize(0, "offense")}`, "green"), "bold")
    } else {
      offensesSummary = parts.join(" | ")

      if (failingCount > 0 && filesFailing > 0) {
        const detailText = `${failingCount} ${this.pluralize(failingCount, "offense")} across ${filesFailing} ${this.pluralize(filesFailing, "file")}`

        offensesSummary += ` ${colorize(`(${detailText})`, "gray")}`
      }
    }

    console.log(`  ${colorize(pad(otherCount > 0 ? "Failing" : "Offenses"), "gray")} ${offensesSummary}`)

    if (otherCount > 0) {
      const otherParts = otherSeverities
        .filter(severity => counts[severity] > 0)
        .map(severity => this.severityPart(severity, counts[severity]))

      const filesNotFailing = data.filesNotFailing ?? filesWithOtherOffensesOnly
      const detailText = `${otherCount} ${this.pluralize(otherCount, "offense")} across ${filesNotFailing} ${this.pluralize(filesNotFailing, "file")}, below --fail-level ${failLevel}`

      console.log(`  ${colorize(pad("Not failing"), "gray")} ${otherParts.join(" | ")} ${colorize(`(${detailText})`, "gray")}`)
    }

    if (totalIgnored > 0) {
      const message = `${totalIgnored} ${this.pluralize(totalIgnored, "offense")} suppressed with herb:disable`

      console.log(`  ${colorize(pad("Ignored"), "gray")} ${colorize(colorize(message, "gray"), "bold")}`)
    }

    if (notReportedCount > 0) {
      const notReportedSeverities = DIAGNOSTIC_SEVERITIES.filter(severity => !meetsSeverityThreshold(severity, logLevel) && counts[severity] > 0)
      const notReportedParts = notReportedSeverities.map(severity => this.severityPart(severity, counts[severity]))
      const lowestSeverity = notReportedSeverities[notReportedSeverities.length - 1]

      const detailText = `${notReportedCount} ${this.pluralize(notReportedCount, "offense")} hidden, show using --log-level=${lowestSeverity}`

      console.log(`  ${colorize(pad("Not shown"), "gray")} ${notReportedParts.join(" | ")} ${colorize(`(${detailText})`, "gray")}`)
    }

    if (ignoreDisableComments && totalWouldBeIgnored && totalWouldBeIgnored > 0) {
      const message = `${colorize(colorize(`${totalWouldBeIgnored} additional ${this.pluralize(totalWouldBeIgnored, "offense")} reported (would have been ignored)`, "cyan"), "bold")}`
      console.log(`  ${colorize(pad("Note"), "gray")} ${message}`)
    }

    const totalOffenses = failingCount + otherCount

    {
      const unsafeAutofixableCount = data.unsafeAutofixableCount ?? 0
      let fixableLine: string

      if (autofixableCount > 0 || unsafeAutofixableCount > 0) {
        const totalColor = failingCount > 0 ? "brightRed" : "brightYellow"
        const fixableParts = [colorize(colorize(`${totalOffenses} ${this.pluralize(totalOffenses, "offense")}`, totalColor), "bold")]

        if (autofixableCount > 0) {
          fixableParts.push(colorize(colorize(`${autofixableCount} autocorrectable using \`--fix\``, "green"), "bold"))
        }

        if (unsafeAutofixableCount > 0) {
          const label = autofixableCount > 0 ? "more" : "autocorrectable"

          fixableParts.push(colorize(colorize(`${unsafeAutofixableCount} ${label} using \`--fix-unsafely\``, "yellow"), "bold"))
        }

        fixableLine = fixableParts.join(" | ")
      } else {
        fixableLine = `${colorize(colorize(`0 ${this.pluralize(0, "offense")}`, "gray"), "bold")}`
      }

      console.log(`  ${colorize(pad("Fixable"), "gray")} ${fixableLine}`)
    }

    const notEnabledCount = data.rulesNotEnabledByDefault ?? 0
    const disabledCount = data.rulesDisabledByConfig ?? 0
    const skippedCount = data.rulesSkippedByVersion?.length ?? 0
    const rulesParts = [colorize(colorize(`${ruleCount} enabled`, "green"), "bold")]

    if (data.only && data.only.length > 0) rulesParts.push(colorize(`filtered by --only`, "cyan"))
    if (data.allRules) rulesParts.push(colorize(`all rules via --all-rules`, "cyan"))
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
