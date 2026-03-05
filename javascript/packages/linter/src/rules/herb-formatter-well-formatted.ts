import { Herb } from "@herb-tools/node-wasm"
import { Location } from "@herb-tools/core"
import { Formatter } from "@herb-tools/formatter"

import { SourceRule } from "../types.js"
import { positionFromOffset } from "./rule-utils.js"

import type { UnboundLintOffense, LintContext, FullRuleConfig } from "../types.js"

interface DiffRange {
  startOffset: number
  endOffset: number
  originalContent: string
  formattedContent: string
}

export class HerbFormatterWellFormattedRule extends SourceRule {
  static autocorrectable = false
  name = "herb-formatter-well-formatted"

  get defaultConfig(): FullRuleConfig {
    return {
      enabled: false,
      severity: "warning"
    }
  }

  isEnabled(_source: string, context?: Partial<LintContext>): boolean {
    const config = context?.config

    if (!config) return true
    if (!config.isFormatterEnabled) return false
    if (context?.fileName && !config.isFormatterEnabledForPath(context.fileName)) return false

    return true
  }

  check(source: string, context?: Partial<LintContext>): UnboundLintOffense[] {
    const offenses: UnboundLintOffense[] = []

    if (source.length === 0) return offenses

    try {
      const config = context?.config
      const filePath = context?.fileName
      const formatter = config ? Formatter.from(Herb, config) : new Formatter(Herb)
      const formatted = formatter.format(source, {}, filePath)

      if (source === formatted) return offenses

      const diffs = this.computeDiffs(source, formatted)

      for (const diff of diffs) {
        const startPosition = positionFromOffset(source, diff.startOffset)
        const endPosition = positionFromOffset(source, diff.endOffset)
        const location = Location.from(startPosition.line, startPosition.column, endPosition.line, endPosition.column)
        const message = this.generateMessage(diff)

        offenses.push({
          rule: this.name,
          code: this.name,
          source: "Herb Linter",
          message,
          location
        })
      }
    } catch {
      // Skip silently on formatting errors
    }

    return offenses
  }

  private computeDiffs(original: string, formatted: string): DiffRange[] {
    const diffs: DiffRange[] = []
    const originalLength = original.length
    const formattedLength = formatted.length

    let originalIndex = 0
    let formattedIndex = 0

    while (originalIndex < originalLength || formattedIndex < formattedLength) {
      if (originalIndex < originalLength && formattedIndex < formattedLength && original[originalIndex] === formatted[formattedIndex]) {
        originalIndex++
        formattedIndex++
        continue
      }

      const diffStartOriginal = originalIndex
      const diffStartFormatted = formattedIndex
      const syncPoint = this.findSyncPoint(original, formatted, originalIndex, formattedIndex)

      if (syncPoint) {
        const originalEnd = syncPoint.originalIndex
        const formattedEnd = syncPoint.formattedIndex

        if (originalEnd > diffStartOriginal || formattedEnd > diffStartFormatted) {
          diffs.push({
            startOffset: diffStartOriginal,
            endOffset: Math.max(diffStartOriginal + 1, originalEnd),
            originalContent: original.slice(diffStartOriginal, originalEnd),
            formattedContent: formatted.slice(diffStartFormatted, formattedEnd)
          })
        }

        originalIndex = originalEnd
        formattedIndex = formattedEnd
      } else {
        diffs.push({
          startOffset: diffStartOriginal,
          endOffset: originalLength,
          originalContent: original.slice(diffStartOriginal),
          formattedContent: formatted.slice(diffStartFormatted)
        })

        break
      }
    }

    return this.coalesceDiffs(diffs)
  }

  private findSyncPoint(original: string, formatted: string, originalStart: number, formattedStart: number): { originalIndex: number; formattedIndex: number } | null {
    const originalLength = original.length
    const formattedLength = formatted.length
    const maxLookahead = 100
    const minMatchLength = 3

    for (let originalOffset = 1; originalOffset <= maxLookahead && originalStart + originalOffset <= originalLength; originalOffset++) {
      for (let formattedOffset = 1; formattedOffset <= maxLookahead && formattedStart + formattedOffset <= formattedLength; formattedOffset++) {
        const originalPosition = originalStart + originalOffset
        const formattedPosition = formattedStart + formattedOffset

        let matchLength = 0

        while (
          originalPosition + matchLength < originalLength &&
          formattedPosition + matchLength < formattedLength &&
          original[originalPosition + matchLength] === formatted[formattedPosition + matchLength]
        ) {
          matchLength++
          if (matchLength >= minMatchLength) {
            return { originalIndex: originalPosition, formattedIndex: formattedPosition }
          }
        }

        if (originalPosition === originalLength && formattedPosition === formattedLength) {
          return { originalIndex: originalPosition, formattedIndex: formattedPosition }
        }
      }
    }

    if (originalStart >= originalLength && formattedStart < formattedLength) {
      return { originalIndex: originalLength, formattedIndex: formattedLength }
    }

    if (formattedStart >= formattedLength && originalStart < originalLength) {
      return { originalIndex: originalLength, formattedIndex: formattedLength }
    }

    return null
  }

  private coalesceDiffs(diffs: DiffRange[]): DiffRange[] {
    if (diffs.length <= 1) return diffs

    const coalesced: DiffRange[] = []
    let current = diffs[0]

    for (let i = 1; i < diffs.length; i++) {
      const next = diffs[i]

      if (next.startOffset <= current.endOffset + 1) {
        current = {
          startOffset: current.startOffset,
          endOffset: Math.max(current.endOffset, next.endOffset),
          originalContent: current.originalContent + next.originalContent,
          formattedContent: current.formattedContent + next.formattedContent
        }
      } else {
        coalesced.push(current)
        current = next
      }
    }

    coalesced.push(current)

    return coalesced
  }

  private generateMessage(diff: DiffRange): string {
    const { originalContent, formattedContent } = diff

    const originalIndentMatch = originalContent.match(/^[ \t]+/)
    const formattedIndentMatch = formattedContent.match(/^[ \t]+/)

    if (originalIndentMatch || formattedIndentMatch) {
      const originalIndent = originalIndentMatch?.[0] || ""
      const formattedIndent = formattedIndentMatch?.[0] || ""

      if (originalIndent !== formattedIndent) {
        const originalSpaces = this.countIndentation(originalIndent)
        const formattedSpaces = this.countIndentation(formattedIndent)

        if (originalSpaces !== formattedSpaces) {
          return `Incorrect indentation: expected ${formattedSpaces} spaces, found ${originalSpaces}`
        }
      }
    }

    const originalIsWhitespace = /^[\s]+$/.test(originalContent)
    const formattedIsWhitespace = /^[\s]+$/.test(formattedContent)

    if (originalIsWhitespace && formattedContent === "") {
      return "Unexpected whitespace"
    }

    if (originalContent === "" && formattedIsWhitespace) {
      return "Missing whitespace"
    }

    const originalNewlines = (originalContent.match(/\n/g) || []).length
    const formattedNewlines = (formattedContent.match(/\n/g) || []).length

    if (originalNewlines !== formattedNewlines) {
      return "Incorrect line breaks"
    }

    return "Formatting differs from expected"
  }

  private countIndentation(indent: string): number {
    let count = 0

    for (const char of indent) {
      if (char === "\t") {
        count += 2
      } else {
        count++
      }
    }

    return count
  }
}
