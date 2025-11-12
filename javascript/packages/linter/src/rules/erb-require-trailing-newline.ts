import { SourceRule } from "../types.js"
import { BaseSourceRuleVisitor, createEndOfFileLocation } from "./rule-utils.js"

import type { UnboundLintOffense, LintOffense, LintContext, FullRuleConfig } from "../types.js"

class ERBRequireTrailingNewlineVisitor extends BaseSourceRuleVisitor {
  protected visitSource(source: string): void {
    if (source.length === 0) return
    if (!this.context.fileName) return

    if (!source.endsWith('\n')) {
      this.addOffense(
        "File must end with trailing newline.",
        createEndOfFileLocation(source),
      )
    } else if (source.endsWith('\n\n')) {
      this.addOffense(
        "File must end with exactly one trailing newline.",
        createEndOfFileLocation(source),
      )
    }
  }
}

export class ERBRequireTrailingNewlineRule extends SourceRule {
  static autocorrectable = true
  name = "erb-require-trailing-newline"

  get defaultConfig(): FullRuleConfig {
    return {
      enabled: true,
      severity: "error"
    }
  }

  check(source: string, context?: Partial<LintContext>): UnboundLintOffense[] {
    const visitor = new ERBRequireTrailingNewlineVisitor(this.name, context)

    visitor.visit(source)

    return visitor.offenses
  }

  autofix(_offense: LintOffense, source: string, _context?: Partial<LintContext>): string | null {
    return source.trimEnd() + "\n"
  }
}
