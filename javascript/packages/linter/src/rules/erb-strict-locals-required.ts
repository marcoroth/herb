import { ParserRule } from "../types.js"
import { Location, ERBStrictLocalsNode, createLiteral } from "@herb-tools/core"
import { BaseRuleVisitor } from "./rule-utils.js"

import { isPartialFile } from "./file-utils.js"

import type { UnboundLintOffense, LintOffense, LintContext, FullRuleConfig } from "../types.js"
import type { ParseResult, DocumentNode } from "@herb-tools/core"

class ERBStrictLocalsRequiredVisitor extends BaseRuleVisitor {
  foundStrictLocals: boolean = false

  visitERBStrictLocalsNode(_node: ERBStrictLocalsNode): void {
    this.foundStrictLocals = true
  }
}

export class ERBStrictLocalsRequiredRule extends ParserRule {
  static unsafeAutocorrectable = true
  static ruleName = "erb-strict-locals-required"

  get parserOptions() {
    return { strict_locals: true }
  }

  get defaultConfig(): FullRuleConfig {
    return {
      enabled: false,
      severity: "error",
    }
  }

  check(result: ParseResult, context?: Partial<LintContext>): UnboundLintOffense[] {
    if (isPartialFile(context?.fileName) !== true) return []

    const visitor = new ERBStrictLocalsRequiredVisitor(this.ruleName, context)
    visitor.visit(result.value)

    if (visitor.foundStrictLocals) return []

    const document = result.value
    const firstChild = document.children[0]
    const end = firstChild ? firstChild.location.end : Location.zero.end

    return [
      this.createOffense(
        "Partial is missing a strict locals declaration. Add `<%# locals: (...) %>` at the top of the file.",
        Location.from(1, 0, end.line, end.column)
      )
    ]
  }

  autofix(_offense: LintOffense, result: ParseResult): ParseResult | null {
    result.value.children.unshift(createLiteral("<%# locals: () %>\n\n"))

    return result
  }
}
