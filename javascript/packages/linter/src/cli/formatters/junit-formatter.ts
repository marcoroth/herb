import { meetsSeverityThreshold } from "@herb-tools/core"

import { ruleDocumentationUrl } from "../../urls.js"

import type { DiagnosticSeverity } from "@herb-tools/core"
import type { ProcessedFile } from "../file-processor.js"

const SUITE_NAME = "herb-lint"

interface JUnitFormatOptions {
  files: string[]
  failLevel: DiagnosticSeverity
  /** Duration of the run in milliseconds */
  duration?: number
}

/**
 * Renders lint results as JUnit XML, so CI systems can report offenses as test failures.
 *
 * Every linted file becomes a <testsuite>, and every rule with offenses in that file becomes
 * a <testcase> (classname = file, name = rule). Grouping by rule rather than by offense keeps
 * test identities stable when lines move. A file without offenses gets one passing testcase.
 * Offenses below the fail level are reported in <system-out> of a passing testcase, so the
 * report fails exactly when herb-lint exits with an error. A rule that gets fixed, or a file
 * that gets offenses, changes which testcases exist rather than turning one green.
 */
export class JUnitFormatter {
  render(offenses: ProcessedFile[], { files, failLevel, duration }: JUnitFormatOptions): string {
    const offensesByFile = new Map<string, ProcessedFile[]>(files.map(file => [file, []]))

    for (const processed of offenses) {
      const fileOffenses = offensesByFile.get(processed.filename) ?? []

      fileOffenses.push(processed)
      offensesByFile.set(processed.filename, fileOffenses)
    }

    let totalTests = 0
    let totalFailures = 0
    const suites: string[] = []

    for (const [filename, fileOffenses] of offensesByFile) {
      const testcases: string[] = []
      let failures = 0

      if (fileOffenses.length === 0) {
        testcases.push(`    <testcase classname="${escape(filename)}" name="${escape(filename)}" file="${escape(filename)}" time="0"/>`)
      }

      for (const [rule, ruleOffenses] of this.groupByRule(fileOffenses)) {
        const failing = ruleOffenses.filter(({ offense }) => meetsSeverityThreshold(offense.severity, failLevel))
        const details = ruleOffenses.map(processed => this.describe(processed)).join("\n")
        const { line } = (failing[0] ?? ruleOffenses[0]).offense.location.start
        const attributes = `classname="${escape(filename)}" name="${escape(rule)}" file="${escape(filename)}" line="${line}" time="0"`

        if (failing.length > 0) {
          const { message, severity } = failing[0].offense
          const summary = failing.length > 1 ? `${message} (and ${failing.length - 1} more)` : message

          failures++
          testcases.push(
            `    <testcase ${attributes}>\n` +
            `      <failure message="${escape(summary)}" type="${escape(severity)}">${escape(`${details}\n\n${ruleDocumentationUrl(rule)}`)}</failure>\n` +
            `    </testcase>`
          )
        } else {
          testcases.push(
            `    <testcase ${attributes}>\n` +
            `      <system-out>${escape(details)}</system-out>\n` +
            `    </testcase>`
          )
        }
      }

      totalTests += testcases.length
      totalFailures += failures

      suites.push(
        `  <testsuite name="${escape(filename)}" tests="${testcases.length}" failures="${failures}" errors="0" skipped="0" time="0">\n` +
        `${testcases.join("\n")}\n` +
        `  </testsuite>`
      )
    }

    const time = duration === undefined ? "" : ` time="${(duration / 1000).toFixed(3)}"`
    const open = `<testsuites name="${SUITE_NAME}" tests="${totalTests}" failures="${totalFailures}" errors="0"${time}>`

    return suites.length === 0
      ? `${XML_DECLARATION}\n${open}</testsuites>`
      : `${XML_DECLARATION}\n${open}\n${suites.join("\n")}\n</testsuites>`
  }

  /**
   * Renders a run that failed before linting (e.g. an invalid configuration) as a single
   * erroring testcase, so CI still gets a report explaining why.
   */
  renderError(message: string): string {
    return this.renderSingle(`<error message="${escape(message)}">${escape(message)}</error>`, { errors: 1, skipped: 0 })
  }

  /**
   * Renders a run that had nothing to lint (e.g. the linter is disabled) as a single skipped
   * testcase, since some CI systems reject a report without any testcases.
   */
  renderSkipped(message: string): string {
    return this.renderSingle(`<skipped message="${escape(message)}">${escape(message)}</skipped>`, { errors: 0, skipped: 1 })
  }

  private renderSingle(element: string, { errors, skipped }: { errors: number, skipped: number }): string {
    return (
      `${XML_DECLARATION}\n` +
      `<testsuites name="${SUITE_NAME}" tests="1" failures="0" errors="${errors}" skipped="${skipped}">\n` +
      `  <testsuite name="${SUITE_NAME}" tests="1" failures="0" errors="${errors}" skipped="${skipped}" time="0">\n` +
      `    <testcase classname="${SUITE_NAME}" name="${SUITE_NAME}" time="0">\n` +
      `      ${element}\n` +
      `    </testcase>\n` +
      `  </testsuite>\n` +
      `</testsuites>`
    )
  }

  private groupByRule(offenses: ProcessedFile[]): Map<string, ProcessedFile[]> {
    const groups = new Map<string, ProcessedFile[]>()

    for (const processed of offenses) {
      const rule = processed.offense.code || SUITE_NAME
      const ruleOffenses = groups.get(rule) ?? []

      ruleOffenses.push(processed)
      groups.set(rule, ruleOffenses)
    }

    return groups
  }

  private describe({ filename, offense }: ProcessedFile): string {
    const { line, column } = offense.location.start

    return `${filename}:${line}:${column}: ${offense.severity}: ${offense.message}`
  }
}

const XML_DECLARATION = `<?xml version="1.0" encoding="UTF-8"?>`

// Terminal colors (CSI sequences) and hyperlinks (OSC 8 sequences) from colorized messages
// oxlint-disable-next-line no-control-regex
const ANSI_SEQUENCES = /\u001B\[[0-?]*[ -/]*[@-~]|\u001B\][^\u0007\u001B]*(?:\u0007|\u001B\\)/g

// Characters that XML 1.0 doesn't allow at all, even escaped
// oxlint-disable-next-line no-control-regex
const INVALID_XML_CHARACTERS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g

function escape(value: string): string {
  return value
    .replace(ANSI_SEQUENCES, "")
    .replace(INVALID_XML_CHARACTERS, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
}
