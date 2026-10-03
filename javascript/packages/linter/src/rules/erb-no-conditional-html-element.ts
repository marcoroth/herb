import dedent from "dedent"

import { ParserRule } from "../types.js"
import { BaseRuleVisitor } from "../utils/rule-utils.js"

import { DEFAULT_FRAMEWORK } from "@herb-tools/core"

import type { ParseResult, HTMLConditionalElementNode } from "@herb-tools/core"
import type { UnboundLintOffense, LintContext, FullRuleConfig } from "../types.js"

class ERBNoConditionalHTMLElementRuleVisitor extends BaseRuleVisitor {
  visitHTMLConditionalElementNode(node: HTMLConditionalElementNode): void {
    const tagName = node.tag_name?.value || "element"
    const condition = node.condition || "condition"

    this.addOffense(
      dedent`
        Avoid opening and closing \`<${tagName}>\` tags in separate conditional blocks with the same condition. \
        This pattern is difficult to read and maintain. ${this.suggestionFor(tagName, condition)}
      `,
      node.location,
    )

    this.visitChildNodes(node)
  }

  private suggestionFor(tagName: string, condition: string): string {
    if ((this.context.framework ?? DEFAULT_FRAMEWORK) !== "actionview") {
      return "Keep the opening and closing tag in the same branch, or build the content once and wrap it conditionally."
    }

    return dedent`
      Consider using a \`capture\` block instead:

        <% content = capture do %>
          ... your content here ...
        <% end %>

        <%= ${condition} ? content_tag(:${tagName}, content) : content %>
    `
  }
}

export class ERBNoConditionalHTMLElementRule extends ParserRule {
  static ruleName = "erb-no-conditional-html-element"
  static introducedIn = this.version("0.9.0")
  static defaultEnabledIn = this.version("0.9.0")

  get defaultConfig(): FullRuleConfig {
    return {
      enabled: true,
      severity: "error"
    }
  }

  check(result: ParseResult, context?: Partial<LintContext>): UnboundLintOffense[] {
    const visitor = new ERBNoConditionalHTMLElementRuleVisitor(this.ruleName, context)

    visitor.visit(result.value)

    return visitor.offenses
  }
}
