import { readFileSync } from "node:fs"
import { relative, resolve } from "node:path"

import { escapeHTML, meetsSeverityThreshold } from "@herb-tools/core"
import { DiagnosticRenderer } from "@herb-tools/highlighter"

import { ruleDocumentationUrl } from "../../urls.js"

import type { DiagnosticSeverity } from "@herb-tools/core"
import type { ProcessedFile } from "../file-processor.js"

const SUITE_NAME = "herb-lint"
const XML_DECLARATION = `<?xml version="1.0" encoding="UTF-8"?>`

// oxlint-disable-next-line no-control-regex
const ANSI_SEQUENCES = /\u001B\[[0-?]*[ -/]*[@-~]|\u001B\][^\u0007\u001B]*(?:\u0007|\u001B\\)/g

// oxlint-disable-next-line no-control-regex
const INVALID_XML_CHARACTERS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\uD800-\uDFFF\uFFFE\uFFFF]/gu

interface JUnitFormatOptions {
  files: string[]
  failLevel: DiagnosticSeverity
  projectPath?: string
  duration?: number
}

export class JUnitFormatter {
  render(offenses: ProcessedFile[], { files, failLevel, projectPath, duration }: JUnitFormatOptions): string {
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
      const reportPath = projectPath ? relative(projectPath, resolve(projectPath, filename)) : filename
      const testcases: string[] = []
      const nameCounts = new Map<string, number>()
      let failures = 0
      let content = fileOffenses.find(processed => processed.content !== undefined)?.content

      if (content === undefined && fileOffenses.length > 0) {
        try {
          content = readFileSync(resolve(projectPath ?? "", filename), "utf-8")
        } catch {}
      }

      if (fileOffenses.length === 0) {
        testcases.push(`    <testcase classname="${escapeAttribute(reportPath)}" name="${escapeAttribute(reportPath)}" file="${escapeAttribute(reportPath)}" time="0"/>`)
      }

      for (const processed of fileOffenses) {
        const { offense } = processed
        const rule = offense.code || SUITE_NAME
        const { line, column } = offense.location.start
        const baseName = `${rule}:${line}:${column}`
        const count = (nameCounts.get(baseName) ?? 0) + 1
        nameCounts.set(baseName, count)
        const name = count === 1 ? baseName : `${baseName}#${count}`
        const failing = meetsSeverityThreshold(offense.severity, failLevel)
        const details = this.describe({ ...processed, filename: reportPath }, content, !failing)
        const attributes = `classname="${escapeAttribute(reportPath)}" name="${escapeAttribute(name)}" file="${escapeAttribute(reportPath)}" line="${line}" time="0"`

        if (failing) {
          failures++
          testcases.push(
            `    <testcase ${attributes}>\n` +
            `      <failure type="${escapeAttribute(offense.severity)}">${escapeText(`${offense.message}\n\n${details}\n\n${ruleDocumentationUrl(rule)}`)}</failure>\n` +
            `    </testcase>`
          )
        } else {
          testcases.push(
            `    <testcase ${attributes}>\n` +
            `      <system-out>${escapeText(details)}</system-out>\n` +
            `    </testcase>`
          )
        }
      }

      totalTests += testcases.length
      totalFailures += failures

      suites.push(
        `  <testsuite name="${escapeAttribute(reportPath)}" tests="${testcases.length}" failures="${failures}" errors="0" skipped="0" time="0">\n` +
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

  renderError(message: string): string {
    return this.renderSingle(`<error message="${escapeAttribute(message)}">${escapeText(message)}</error>`, { errors: 1, skipped: 0 })
  }

  renderSkipped(message: string): string {
    return this.renderSingle(`<skipped message="${escapeAttribute(message)}">${escapeText(message)}</skipped>`, { errors: 0, skipped: 1 })
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

  private describe({ filename, offense }: ProcessedFile, content: string | undefined, showDiagnostic: boolean): string {
    if (content) {
      return new DiagnosticRenderer().renderSingle(filename, offense, content, {
        contextLines: 2,
        showDiagnostic,
        wrapLines: false,
        truncateLines: false,
      }).trimEnd()
    }

    const { line, column } = offense.location.start

    const location = `${filename}:${line}:${column}`

    return showDiagnostic ? `${location}: ${offense.severity}: ${offense.message}` : location
  }
}

function escapeText(value: string): string {
  return escapeHTML(value
    .replace(ANSI_SEQUENCES, "")
    .replace(INVALID_XML_CHARACTERS, ""))
}

function escapeAttribute(value: string): string {
  return escapeText(value)
    .replace(/\t/g, "&#9;")
    .replace(/\n/g, "&#10;")
    .replace(/\r/g, "&#13;")
}
