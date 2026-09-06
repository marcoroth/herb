import { BaseRuleVisitor } from "../utils/rule-utils.js"
import { ParserRule } from "../types.js"
import { slotsDirectiveMode } from "../utils/state-directives-utils.js"

import type { UnboundLintOffense, LintContext, FullRuleConfig } from "../types.js"
import type { ParseResult, ERBContentNode } from "@herb-tools/core"

interface SlotsDirective {
  node: ERBContentNode
  mode: "server" | "client"
}

class SlotsSingleDirectiveVisitor extends BaseRuleVisitor {
  public directives: SlotsDirective[] = []

  visitERBContentNode(node: ERBContentNode): void {
    const mode = slotsDirectiveMode(node)

    if (mode !== null) {
      this.directives.push({ node, mode })
    }
  }

  reportDuplicates(): void {
    const [first, ...rest] = this.directives

    if (!first || rest.length === 0) return

    for (const duplicate of rest) {
      this.addOffense(
        `This template already declares \`herb:slots ${first.mode}\` on line ${first.node.location.start.line}, and the engine reads only the first directive, so this one does nothing. Remove it, and put the mode the template should use on the first directive.`,
        duplicate.node.location,
      )
    }
  }
}

export class HerbSlotsSingleDirectiveRule extends ParserRule {
  static ruleName = "herb-slots-single-directive"
  static introducedIn = this.version("unreleased")

  get defaultConfig(): FullRuleConfig {
    return {
      enabled: true,
      severity: "error"
    }
  }

  check(result: ParseResult, context?: Partial<LintContext>): UnboundLintOffense[] {
    const visitor = new SlotsSingleDirectiveVisitor(this.ruleName, context)

    visitor.visit(result.value)
    visitor.reportDuplicates()

    return visitor.offenses
  }
}
