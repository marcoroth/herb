import { ParserRule } from "../types.js"
import { BaseRuleVisitor } from "./rule-utils.js"
import { getTagLocalName, isERBOpenTagNode } from "@herb-tools/core"

import type { UnboundLintOffense, LintContext, FullRuleConfig } from "../types.js"
import type { ParseResult, ParserOptions, HTMLElementNode } from "@herb-tools/core"

const JAVASCRIPT_TAG_ELEMENT_SOURCE = "ActionView::Helpers::JavaScriptHelper#javascript_tag"

class ERBNoJavascriptTagHelperVisitor extends BaseRuleVisitor {
  visitHTMLElementNode(node: HTMLElementNode): void {
    if (this.isJavascriptTagHelper(node)) {
      this.addOffense(
        "Avoid `javascript_tag`. Use inline `<script>` tags instead.",
        node.open_tag!.location,
      )
    }

    super.visitHTMLElementNode(node)
  }

  private isJavascriptTagHelper(node: HTMLElementNode): node is HTMLElementNode {
    if (getTagLocalName(node) !== "script") return false
    if (!isERBOpenTagNode(node.open_tag)) return false

    return node.element_source === JAVASCRIPT_TAG_ELEMENT_SOURCE
  }
}

export class ERBNoJavascriptTagHelperRule extends ParserRule {
  static ruleName = "erb-no-javascript-tag-helper"
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
    const visitor = new ERBNoJavascriptTagHelperVisitor(this.ruleName, context)

    visitor.visit(result.value)

    return visitor.offenses
  }
}
