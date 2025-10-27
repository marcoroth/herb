import { BaseSourceRuleVisitor } from "./rule-utils.js"
import { SourceRule } from "../types.js"
import { Location, Position } from "@herb-tools/core"

import type { Node } from "@herb-tools/core"
import type { UnboundLintOffense, LintOffense, LintContext, BaseAutofixContext, FullRuleConfig } from "../types.js"

interface ERBNoExtraNewLineAutofixContext extends BaseAutofixContext {
  startOffset: number
  endOffset: number
}

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

class ERBNoExtraNewLineVisitor extends BaseSourceRuleVisitor<ERBNoExtraNewLineAutofixContext> {
  protected visitSource(source: string): void {
    if (source.length === 0) return

    const regex = /\n{4,}/g

    let match: RegExpExecArray | null

    while ((match = regex.exec(source)) !== null) {
      const startOffset = match.index + 3
      const endOffset = match.index + match[0].length
      const start = positionFromOffset(source, startOffset)
      const end = positionFromOffset(source, endOffset)
      const location = new Location(start, end)

      const extraLines = match[0].length - 3

      this.addOffense(
        `Extra blank line detected. Remove ${extraLines} blank ${extraLines === 1 ? "line" : "lines"} to maintain consistent spacing (max 2 allowed).`,
        location,
        {
          node: null as any as Node,
          startOffset,
          endOffset
        }
      )
    }
  }
}

export class ERBNoExtraNewLineRule extends SourceRule {
  static autocorrectable = true
  name = "erb-no-extra-newline"

  get defaultConfig(): FullRuleConfig {
    return {
      enabled: true,
      severity: "error"
    }
  }

  check(source: string, context?: Partial<LintContext>): UnboundLintOffense[] {
    const visitor = new ERBNoExtraNewLineVisitor(this.name, context)

    visitor.visit(source)

    return visitor.offenses
  }

  autofix(offense: LintOffense<ERBNoExtraNewLineAutofixContext>, source: string, _context?: Partial<LintContext>): string | null {
    if (!offense.autofixContext) return null

    const { startOffset, endOffset } = offense.autofixContext

    const before = source.substring(0, startOffset)
    const after = source.substring(endOffset)

    return before + after
  }
}
