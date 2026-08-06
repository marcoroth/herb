import { colorize, Highlighter, type ThemeInput, DEFAULT_THEME } from "@herb-tools/highlighter"

import { ruleDocumentationUrl } from "../../urls.js"
import { fileUrl } from "../file-url.js"

import { BaseFormatter } from "./base-formatter.js"
import { LineWrapper } from "@herb-tools/highlighter"

import type { Diagnostic } from "@herb-tools/core"
import type { ProcessedFile } from "../file-processor.js"

export class DetailedFormatter extends BaseFormatter {
  private highlighter: Highlighter | null = null
  private theme: ThemeInput
  private wrapLines: boolean
  private truncateLines: boolean

  constructor(theme: ThemeInput = DEFAULT_THEME, wrapLines: boolean = true, truncateLines: boolean = false, projectPath?: string) {
    super(projectPath)

    this.theme = theme
    this.wrapLines = wrapLines
    this.truncateLines = truncateLines
  }

  private fixDiffFor(processed: ProcessedFile): string | undefined {
    const { filename, fixedContent, unsafeAutocorrectable } = processed

    if (!fixedContent || !this.highlighter) return undefined

    const content = this.contentFor(processed)
    if (!content) return undefined

    const indent = "        "

    const diff = this.highlighter.highlightDiff(filename, content, fixedContent, {
      contextLines: 1,
      wrapLines: this.wrapLines,
      truncateLines: this.truncateLines,
      indent,
    })

    if (!diff) return undefined

    const flag = unsafeAutocorrectable ? "--fix-unsafely" : "--fix"
    const heading = `${colorize("Running ", "gray")}${colorize(flag, "bold")}${colorize(" would correct this to:", "gray")}`

    return `\n${indent}${heading}\n\n${diff}\n`
  }

  async format(allOffenses: ProcessedFile[], isSingleFile: boolean = false): Promise<void> {
    if (allOffenses.length === 0) return

    if (!this.highlighter) {
      this.highlighter = new Highlighter(this.theme)
      await this.highlighter.initialize()
    }

    const correctableTag = colorize(colorize("[Correctable]", "green"), "bold")
    const unsafeCorrectableTag = colorize(colorize("[Correctable with --fix-unsafely]", "yellow"), "bold")

    const correctableTagFor = ({ autocorrectable, unsafeAutocorrectable }: ProcessedFile) => {
      if (autocorrectable) return correctableTag
      if (unsafeAutocorrectable) return unsafeCorrectableTag

      return undefined
    }

    const correctableTags = new Map(
      allOffenses.map(item => [item.offense, correctableTagFor(item)])
    )

    if (isSingleFile) {
      const { filename } = allOffenses[0]
      const content = this.contentFor(allOffenses[0])
      const diagnostics = allOffenses.map(item => item.offense)

      const highlighted = this.highlighter.highlight(filename, content, {
        diagnostics: diagnostics,
        splitDiagnostics: true,
        contextLines: 2,
        wrapLines: this.wrapLines,
        truncateLines: this.truncateLines,
        codeUrlBuilder: ruleDocumentationUrl,
        fileUrlBuilder: (path) => fileUrl(path),
        suffixBuilder: (diagnostic) => correctableTags.get(diagnostic),
      })

      console.log(`\n${highlighted}`)
    } else {
      const totalMessageCount = allOffenses.length

      for (let i = 0; i < allOffenses.length; i++) {
        const { filename, offense } = allOffenses[i]
        const content = this.contentFor(allOffenses[i])
        const codeUrl = offense.code ? ruleDocumentationUrl(offense.code) : undefined
        const suffix = correctableTagFor(allOffenses[i])

        const formatted = this.highlighter.highlightDiagnostic(filename, offense, content, {
          contextLines: 2,
          wrapLines: this.wrapLines,
          truncateLines: this.truncateLines,
          codeUrl,
          fileUrl: fileUrl(filename),
          suffix,
        })

        console.log(`\n${formatted}`)

        const fixDiff = this.fixDiffFor(allOffenses[i])
        if (fixDiff) console.log(fixDiff)

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
