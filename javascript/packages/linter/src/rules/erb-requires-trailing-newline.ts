import { BaseSourceRuleVisitor, createEndOfFileLocation } from "./rule-utils.js"
import { SourceRule } from "../types.js"
import type { LintOffense } from "../types.js"

class ERBRequiresTrailingNewlineVisitor extends BaseSourceRuleVisitor {
  protected visitSource(source: string): void {
    if (source.length === 0) return
    if (source.endsWith('\n')) return

    this.addOffense(
      "File must end with trailing newline",
      createEndOfFileLocation(source),
      "error"
    )
  }
}

export class ERBRequiresTrailingNewlineRule extends SourceRule {
  name = "erb-requires-trailing-newline"

  check(source: string): LintOffense[] {
    const visitor = new ERBRequiresTrailingNewlineVisitor(this.name)
    visitor.visit(source)
    return visitor.offenses
  }
}
