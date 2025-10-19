import { SourceRule } from "../types.js"
import { BaseSourceRuleVisitor, createEndOfFileLocation } from "./rule-utils.js"

import type { LintOffense, LintContext } from "../types.js"

class ERBRequireTrailingNewlineVisitor extends BaseSourceRuleVisitor {
  protected visitSource(source: string): void {
    if (source.length === 0) return
    if (!this.context.fileName) return

    if (!source.endsWith('\n')) {
      this.addOffense(
        "File must end with trailing newline.",
        createEndOfFileLocation(source),
        "error"
      )
    } else if (source.endsWith('\n\n')) {
      this.addOffense(
        "File must end with exactly one trailing newline.",
        createEndOfFileLocation(source),
        "error"
      )
    }
  }
}

export class ERBRequireTrailingNewlineRule extends SourceRule {
  static autocorrectable = true
  name = "erb-require-trailing-newline"

  check(source: string, context?: Partial<LintContext>): LintOffense[] {
    const visitor = new ERBRequireTrailingNewlineVisitor(this.name, context)

    visitor.visit(source)

    return visitor.offenses
  }

  autofix(_offense: LintOffense, source: string, _context?: Partial<LintContext>): string | null {
    return source.trimEnd() + "\n"
  }
}
