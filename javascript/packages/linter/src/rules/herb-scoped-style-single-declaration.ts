import { getTagLocalName, hasAttribute } from "@herb-tools/core"

import { BaseRuleVisitor } from "../utils/rule-utils.js"
import { ParserRule } from "../types.js"

import type { ParseResult, HTMLElementNode } from "@herb-tools/core"
import type { UnboundLintOffense, LintContext, FullRuleConfig } from "../types.js"

class ScopedStyleSingleDeclarationVisitor extends BaseRuleVisitor {
  private first: HTMLElementNode | null = null

  visitHTMLElementNode(node: HTMLElementNode): void {
    if (getTagLocalName(node) === "style" && hasAttribute(node, "scoped")) {
      if (this.first) {
        this.addOffense(
          `This file already declares its scoped styles in the \`<style scoped>\` block on line ${this.first.location.start.line}. A file declares its scoped styles once, so merge these rules into that block.`,
          node.open_tag!.location,
        )
      } else {
        this.first = node
      }
    }

    super.visitHTMLElementNode(node)
  }
}

export class HerbScopedStyleSingleDeclarationRule extends ParserRule {
  static ruleName = "herb-scoped-style-single-declaration"
  static introducedIn = this.version("unreleased")

  get defaultConfig(): FullRuleConfig {
    return {
      enabled: true,
      severity: "warning"
    }
  }

  check(result: ParseResult, context?: Partial<LintContext>): UnboundLintOffense[] {
    const visitor = new ScopedStyleSingleDeclarationVisitor(this.ruleName, context)

    visitor.visit(result.value)

    return visitor.offenses
  }
}
