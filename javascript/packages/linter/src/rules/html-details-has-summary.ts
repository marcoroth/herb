import { BaseRuleVisitor } from "./rule-utils.js"
import { getTagLocalName, isHTMLElementNode } from "@herb-tools/core"

import { ParserRule } from "../types.js"
import type { UnboundLintOffense, LintContext, FullRuleConfig } from "../types.js"
import type { HTMLElementNode, ParseResult, ParserOptions } from "@herb-tools/core"

class DetailsHasSummaryVisitor extends BaseRuleVisitor {
  visitHTMLElementNode(node: HTMLElementNode): void {
    this.checkDetailsElement(node)
    super.visitHTMLElementNode(node)
  }

  private checkDetailsElement(node: HTMLElementNode): void {
    const tagName = getTagLocalName(node)

    if (tagName !== "details") {
      return
    }

    if (!this.hasDirectSummaryChild(node)) {
      this.addOffense(
        "`<details>` element must have a direct `<summary>` child element.",
        node.location,
      )
    }
  }

  private hasDirectSummaryChild(node: HTMLElementNode): boolean {
    if (!node.body || node.body.length === 0) {
      return false
    }

    for (const child of node.body) {
      if (isHTMLElementNode(child)) {
        const childTagName = getTagLocalName(child)

        if (childTagName === "summary") {
          return true
        }
      }
    }

    return false
  }
}

export class HTMLDetailsHasSummaryRule extends ParserRule {
  static ruleName = "html-details-has-summary"
  static introducedIn = this.version("0.9.0")

  get defaultConfig(): FullRuleConfig {
    return {
      enabled: true,
      severity: "warning"
    }
  }

  get parserOptions(): Partial<ParserOptions> {
    return {
      action_view_helpers: true,
    }
  }

  check(result: ParseResult, context?: Partial<LintContext>): UnboundLintOffense[] {
    const visitor = new DetailsHasSummaryVisitor(this.ruleName, context)
    visitor.visit(result.value)
    return visitor.offenses
  }
}
