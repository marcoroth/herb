import { colorize, Highlighter, type ThemeInput, DEFAULT_THEME } from "@herb-tools/highlighter"

import { BaseFormatter } from "./base-formatter.js"
import { LineWrapper } from "@herb-tools/highlighter"
import { ruleDocumentationUrl, fileUrl } from "../../urls.js"

import type { Diagnostic } from "@herb-tools/core"
import type { ProcessedFile } from "../file-processor.js"

export class DetailedFormatter extends BaseFormatter {
  private highlighter: Highlighter | null = null
  private theme: ThemeInput
  private wrapLines: boolean
  private truncateLines: boolean

  constructor(theme: ThemeInput = DEFAULT_THEME, wrapLines: boolean = true, truncateLines: boolean = false) {
    super()
    this.theme = theme
    this.wrapLines = wrapLines
    this.truncateLines = truncateLines
  }

  async format(allOffenses: ProcessedFile[], isSingleFile: boolean = false): Promise<void> {
    if (allOffenses.length === 0) return

    if (!this.highlighter) {
      this.highlighter = new Highlighter(this.theme)
      await this.highlighter.initialize()
    }

    const correctableTag = colorize(colorize("[Correctable]", "green"), "bold")
    const autocorrectableSet = new Set(
      allOffenses.filter(item => item.autocorrectable).map(item => item.offense)
    )

    if (isSingleFile) {
      const { filename, content } = allOffenses[0]
      const diagnostics = allOffenses.map(item => item.offense)

      const highlighted = this.highlighter.highlight(filename, content, {
        diagnostics: diagnostics,
        splitDiagnostics: true,
        contextLines: 2,
        wrapLines: this.wrapLines,
        truncateLines: this.truncateLines,
        codeUrlBuilder: ruleDocumentationUrl,
        fileUrlBuilder: (path) => fileUrl(path),
        suffixBuilder: (diagnostic) => autocorrectableSet.has(diagnostic) ? correctableTag : undefined,
      })

      console.log(`\n${highlighted}`)
    } else {
      const totalMessageCount = allOffenses.length

      for (let i = 0; i < allOffenses.length; i++) {
        const { filename, offense, content, autocorrectable } = allOffenses[i]

        const codeUrl = offense.code ? ruleDocumentationUrl(offense.code) : undefined
        const suffix = autocorrectable ? correctableTag : undefined
        const formatted = this.highlighter.highlightDiagnostic(filename, offense, content, {
          contextLines: 2,
          wrapLines: this.wrapLines,
          truncateLines: this.truncateLines,
          codeUrl,
          fileUrl: fileUrl(filename),
          suffix,
        })
        console.log(`\n${formatted}`)

        const width = LineWrapper.getTerminalWidth()
        const progressText = `[${i + 1}/${totalMessageCount}]`
        const rightPadding = 16
        const separatorLength = Math.max(0, width - progressText.length - 1 - rightPadding)
        const separator = '⎯'
        const leftSeparator = colorize(separator.repeat(separatorLength), "gray")
        const rightSeparator = colorize(separator.repeat(4), "gray")
        const progress = colorize(progressText, "gray")

        console.log(colorize(`${leftSeparator}  ${progress}`, "dim") + colorize(` ${rightSeparator}\n`, "dim"))
      }
    }
  }

  formatFile(_filename: string, _offenses: Diagnostic[]): void {
    throw new Error("formatFile is not implemented for DetailedFormatter")
  }
}
