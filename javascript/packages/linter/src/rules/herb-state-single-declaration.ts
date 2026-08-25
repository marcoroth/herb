import { BaseRuleVisitor } from "../utils/rule-utils.js"
import { ParserRule } from "../types.js"
import { isStateDirective } from "../utils/state-directives-utils.js"

import type { UnboundLintOffense, LintContext, FullRuleConfig } from "../types.js"
import type { ParseResult, ERBBlockNode, ERBContentNode } from "@herb-tools/core"

class StateSingleDeclarationVisitor extends BaseRuleVisitor {
  private stack: (ERBBlockNode | null)[] = [null]
  private firstInScope = new Map<ERBBlockNode | null, ERBContentNode>()

  visitERBBlockNode(node: ERBBlockNode): void {
    this.stack.push(node)

    super.visitERBBlockNode(node)

    this.stack.pop()
  }

  visitERBContentNode(node: ERBContentNode): void {
    if (!isStateDirective(node)) return

    const scope = this.stack[this.stack.length - 1]
    const first = this.firstInScope.get(scope)

    if (!first) {
      this.firstInScope.set(scope, node)

      return
    }

    this.addOffense(
      `This scope already declares its states in the \`herb:state\` directive on line ${first.location.start.line}. Merge these states into that signature, so every state of the scope reads from one declaration.`,
      node.location,
    )
  }
}

export class HerbStateSingleDeclarationRule extends ParserRule {
  static ruleName = "herb-state-single-declaration"
  static introducedIn = this.version("unreleased")

  get defaultConfig(): FullRuleConfig {
    return {
      enabled: true,
      severity: "warning"
    }
  }

  check(result: ParseResult, context?: Partial<LintContext>): UnboundLintOffense[] {
    const visitor = new StateSingleDeclarationVisitor(this.ruleName, context)

    visitor.visit(result.value)

    return visitor.offenses
  }
}
