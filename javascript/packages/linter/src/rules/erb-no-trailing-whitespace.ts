import  { type Node, Location } from "@herb-tools/core"

import { BaseSourceRuleVisitor, positionFromOffset } from "./rule-utils.js"
import { SourceRule } from "../types.js"
import type { UnboundLintOffense, LintOffense, LintContext, BaseAutofixContext, FullRuleConfig } from "../types.js"

interface ERBNoTrailingWhitespaceAutofixContext extends BaseAutofixContext {
  startOffset: number
  endOffset: number
}

class ERBNoTrailingWhitespaceVisitor extends BaseSourceRuleVisitor<ERBNoTrailingWhitespaceAutofixContext> {
  protected visitSource(source: string): void {
    if (source.length === 0) return

    const regex = /[ \t\r]+(?=\n|$)/g

    let match: RegExpExecArray | null

    while ((match = regex.exec(source)) !== null) {
      const startOffset = match.index
      const endOffset = match.index + match[0].length
      const start = positionFromOffset(source, startOffset)
      const end = positionFromOffset(source, endOffset)
      const location = new Location(start, end)

      this.addOffense(
        "Extra whitespace detected at end of line.",
        location,
        {
          node: null as any as Node,
          startOffset,
          endOffset,
        }
      )
    }
  }
}

export class ERBNoTrailingWhitespaceRule extends SourceRule {
  static autocorrectable = false
  name = "erb-no-trailing-whitespace"

  get defaultConfig(): FullRuleConfig {
    return {
      enabled: true,
      severity: "error",
    }
  }

  check(source: string, context?: Partial<LintContext>): UnboundLintOffense[] {
    const visitor = new ERBNoTrailingWhitespaceVisitor(this.name, context)

    visitor.visit(source)

    return visitor.offenses
  }

  autofix(offense: LintOffense<ERBNoTrailingWhitespaceAutofixContext>, source: string, _context?: Partial<LintContext>): string | null {
    if (!offense.autofixContext) return null

    const { startOffset, endOffset } = offense.autofixContext

    const before = source.substring(0, startOffset)
    const after = source.substring(endOffset)

    return before + after
  }
}
