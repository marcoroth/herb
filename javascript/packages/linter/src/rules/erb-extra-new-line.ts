import { BaseSourceRuleVisitor } from "./rule-utils.js"
import { SourceRule } from "../types.js"
import { Location, Position } from "@herb-tools/core"
import type { LintOffense, LintContext } from "../types.js"

function positionFromOffset(source: string, offset: number): Position {
  let line = 1
  let column = 0
  let currentOffset = 0

  for (let i = 0; i < source.length && currentOffset < offset; i++) {
    const char = source[i]
    currentOffset++
    if (char === "\n") {
      line++
      column = 0
    } else {
      column++
    }
  }

  return new Position(line, column)
}

function locationFromMatch(source: string, match: RegExpExecArray): Location {
  const startOffset = match.index
  const endOffset = match.index + match[0].length
  const start = positionFromOffset(source, startOffset)
  const end = positionFromOffset(source, endOffset)
  return new Location(start, end)
}

class ERBExtraNewLineVisitor extends BaseSourceRuleVisitor {
  protected visitSource(source: string): void {
    if (source.length === 0) return

    const regex = /\n{3,}/g
    let match: RegExpExecArray | null

    while ((match = regex.exec(source)) !== null) {
      const location = locationFromMatch(source, match)

      this.addOffense(
        "Extra blank line detected.",
        location,
        "error"
      )
    }
  }
}

export class ERBExtraNewLineRule extends SourceRule {
  name = "erb-extra-new-line"

  check(source: string, context?: Partial<LintContext>): LintOffense[] {
    const visitor = new ERBExtraNewLineVisitor(this.name, context)

    visitor.visit(source)

    return visitor.offenses
  }
}
