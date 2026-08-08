import { readFileSync } from "node:fs"
import { resolve } from "node:path"

import { colorize } from "@herb-tools/highlighter"
import { fileUrl } from "../file-url.js"
import { ruleDocumentationUrl } from "../../urls.js"

import { Highlighter } from "@herb-tools/highlighter"
import { BaseFormatter } from "./base-formatter.js"
import { LineWrapper } from "@herb-tools/highlighter"

import type { Diagnostic } from "@herb-tools/core"
import type { ProcessedFile } from "../file-processor.js"
import type { ThemeInput } from "@herb-tools/highlighter"

import { DEFAULT_THEME } from "@herb-tools/highlighter"

export class DetailedFormatter extends BaseFormatter {
  private highlighter: Highlighter | null = null
  private theme: ThemeInput
  private wrapLines: boolean
  private truncateLines: boolean
  private showFixDiff: boolean
  private previewsRendered = false
  private frameSources = new Map<string, string>()

  constructor(theme: ThemeInput = DEFAULT_THEME, wrapLines: boolean = true, truncateLines: boolean = false, projectPath?: string, showFixDiff: boolean = false) {
    super(projectPath)

    this.theme = theme
    this.wrapLines = wrapLines
    this.truncateLines = truncateLines
    this.showFixDiff = showFixDiff
  }

  private offenseSeparator(position: number, total: number): string {
    const progress = `[${position}/${total}]`
    const rightPadding = 16
    const width = LineWrapper.getTerminalWidth()
    const separatorLength = Math.max(0, width - progress.length - 1 - rightPadding)

    return `${"⎯".repeat(separatorLength)}  ${progress} ${"⎯".repeat(4)}`
  }

  private fixDiffHintFor({ autocorrectable, unsafeAutocorrectable }: ProcessedFile): string | undefined {
    if (this.showFixDiff || this.previewsRendered) return undefined
    if (!autocorrectable && !unsafeAutocorrectable) return undefined

    return `
${colorize("        Tip: run with ", "gray")}${colorize("--show-fix-diff", "bold")}${colorize(" to preview the correction", "gray")}
`
  }

  private callChainFor({ renderedFrom }: ProcessedFile): string | undefined {
    if (!renderedFrom || !this.highlighter) return undefined
    if (renderedFrom.frames.length === 0) return undefined

    const indent = "        "
    const sections: string[] = []

    for (const frame of [...renderedFrom.frames].reverse()) {
      if (!frame.location) continue

      const verb = frame.via === "layout" ? "rendered into" : "rendered from"
      const nesting = frame.ancestors.length > 0 ? colorize(`  ${frame.ancestors.map(tag => `<${tag}>`).join(" › ")}`, "gray") : ""
      const heading = `${colorize(verb, "gray")} ${colorize(`${this.absolutePath(frame.file)}:${frame.location.line}:${frame.location.column}`, "cyan")}${nesting}`

      const source = this.sourceOf(frame.file)
      if (source === undefined) continue

      const rendered = this.highlighter.highlight(frame.file, source, {
        focusLine: frame.location.line,
        contextLines: 0,
        wrapLines: this.wrapLines,
        truncateLines: this.truncateLines,
      })

      const gutterLines = rendered.split("\n").filter(line => line.includes("│"))

      if (gutterLines.length === 0) continue

      sections.push(`${indent}${heading}\n${gutterLines.map(line => `${indent}${line}`).join("\n")}`)
    }

    if (sections.length === 0) return undefined

    const others = renderedFrom.occurrences - 1
    const footer = others > 0
      ? `\n${indent}${colorize(`and ${others} other call site${others === 1 ? "" : "s"} nesting it the same way`, "gray")}`
      : ""

    return `\n${sections.join("\n\n")}${footer}\n`
  }

  private absolutePath(filename: string): string {
    return this.projectPath ? resolve(this.projectPath, filename) : resolve(filename)
  }

  private sourceOf(filename: string): string | undefined {
    const cached = this.frameSources.get(filename)

    if (cached !== undefined) return cached || undefined

    const filePath = this.absolutePath(filename)

    try {
      const source = readFileSync(filePath, "utf-8")

      this.frameSources.set(filename, source)

      return source
    } catch {
      this.frameSources.set(filename, "")

      return undefined
    }
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

    this.previewsRendered = allOffenses.some(offense => offense.fixedContent !== undefined)

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
      const sections: string[] = []

      allOffenses.forEach((processed, index) => {
        const { offense } = processed

        const rendered = this.highlighter!.highlightDiagnostic(filename, offense, content, {
          contextLines: 2,
          wrapLines: this.wrapLines,
          truncateLines: this.truncateLines,
          codeUrl: offense.code ? ruleDocumentationUrl(offense.code) : undefined,
          fileUrl: fileUrl(filename),
          suffix: correctableTags.get(offense),
        })

        const callChain = this.callChainFor(processed) ?? ""
        const addition = this.fixDiffFor(processed) ?? this.fixDiffHintFor(processed) ?? ""
        const trailer = `${callChain}${addition}`

        sections.push(trailer ? `${rendered}${trailer}` : rendered)

        if (index < allOffenses.length - 1) {
          sections.push(this.offenseSeparator(index + 1, allOffenses.length))
        }
      })

      const highlighted = sections.join("\n\n")

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

        const callChain = this.callChainFor(allOffenses[i])
        if (callChain) console.log(callChain)

        const fixDiff = this.fixDiffFor(allOffenses[i]) ?? this.fixDiffHintFor(allOffenses[i])
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
