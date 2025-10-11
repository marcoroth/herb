import { BaseSourceRuleVisitor, createEndOfFileLocation } from "./rule-utils.js"
import { SourceRule } from "../types.js"
import type { Node } from "@herb-tools/core"

import type { LintOffense, LintContext, LintFix } from "../types.js"

// Source rules don't have a specific node, so we use a minimal context
interface TrailingNewlineAutofixContext {
  node: Node  // Unused for source rules, but required by interface
}

class ERBRequiresTrailingNewlineVisitor extends BaseSourceRuleVisitor<TrailingNewlineAutofixContext> {
  protected visitSource(source: string): void {
    if (source.length === 0) return
    if (source.endsWith('\n')) return
    if (!this.context.fileName) return

    this.addOffense(
      "File must end with trailing newline",
      createEndOfFileLocation(source),
      "error",
      {
        node: null as any as Node  // Source rules don't operate on nodes
      }
    )
  }
}

export class ERBRequiresTrailingNewlineRule extends SourceRule<TrailingNewlineAutofixContext> {
  static autocorrectable = true
  name = "erb-requires-trailing-newline"

  check(source: string, context?: Partial<LintContext>): LintOffense<TrailingNewlineAutofixContext>[] {
    const visitor = new ERBRequiresTrailingNewlineVisitor(this.name, context)

    visitor.visit(source)

    return visitor.offenses
  }

  autofix(_offense: LintOffense<TrailingNewlineAutofixContext>, source: string, _context?: Partial<LintContext>): LintFix | null {
    return {
      correctedSource: source + "\n",
      description: "Add trailing newline"
    }
  }
}
