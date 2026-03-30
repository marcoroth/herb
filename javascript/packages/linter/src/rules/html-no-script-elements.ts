import { getTagLocalName } from "@herb-tools/core"
import type { ParseResult, ParserOptions, HTMLElementNode } from "@herb-tools/core"

import { BaseRuleVisitor, isJavaScriptTagElement, findElementAttribute } from "./rule-utils.js"
import { ParserRule } from "../types.js"
import type { UnboundLintOffense, LintContext, FullRuleConfig } from "../types.js"

const IGNORED_ELEMENT_SOURCES = new Set([
  "ActionView::Helpers::AssetTagHelper#javascript_include_tag",
  "ActionView::Helpers::JavaScriptHelper#javascript_tag",
])

function isExternalScript(node: HTMLElementNode): boolean {
  return !!findElementAttribute(node, "src") && node.body.length === 0
}

class HTMLNoScriptElementsVisitor extends BaseRuleVisitor {
  visitHTMLElementNode(node: HTMLElementNode): void {
    if (this.isInlineScript(node)) {
      this.addOffense(
        "Avoid inline `<script>` tags. Use `javascript_include_tag` to include external JavaScript files instead.",
        node.open_tag!.location,
      )
    }

    super.visitHTMLElementNode(node)
  }

  private isInlineScript(node: HTMLElementNode): boolean {
    if (getTagLocalName(node) !== "script") return false
    if (!isJavaScriptTagElement(node)) return false
    if (IGNORED_ELEMENT_SOURCES.has(node.element_source)) return false
    if (isExternalScript(node)) return false

    return true
  }
}

export class HTMLNoScriptElementsRule extends ParserRule {
  static ruleName = "html-no-script-elements"
  static introducedIn = this.version("unreleased")

  get defaultConfig(): FullRuleConfig {
    return {
      enabled: false,
      severity: "warning"
    }
  }

  get parserOptions(): Partial<ParserOptions> {
    return {
      action_view_helpers: true,
    }
  }

  check(result: ParseResult, context?: Partial<LintContext>): UnboundLintOffense[] {
    const visitor = new HTMLNoScriptElementsVisitor(this.ruleName, context)

    visitor.visit(result.value)

    return visitor.offenses
  }
}
