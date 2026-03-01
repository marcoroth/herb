import dedent from "dedent"

import { ParserRule } from "../types.js"
import { BaseRuleVisitor } from "./rule-utils.js"

import type { ParseResult, HTMLConditionalElementNode } from "@herb-tools/core"
import type { UnboundLintOffense, LintContext, FullRuleConfig } from "../types.js"

class ERBNoConditionalHTMLElementRuleVisitor extends BaseRuleVisitor {
  visitHTMLConditionalElementNode(node: HTMLConditionalElementNode): void {
    const tagName = node.tag_name?.value || "element"
    const condition = node.condition || "condition"

    const suggestion = dedent`
      Consider using a \`capture\` block instead:

        <% content = capture do %>
          ... your content here ...
        <% end %>

        <%= ${condition} ? content_tag(:${tagName}, content) : content %>
    `

    this.addOffense(
      dedent`
        Avoid opening and closing \`<${tagName}>\` tags in separate conditional blocks with the same condition. \
        This pattern is difficult to read and maintain. ${suggestion}
      `,
      node.location,
    )

    this.visitChildNodes(node)
  }
}

export class ERBNoConditionalHTMLElementRule extends ParserRule {
  name = "erb-no-conditional-html-element"

  get defaultConfig(): FullRuleConfig {
    return {
      enabled: true,
      severity: "error"
    }
  }

  check(result: ParseResult, context?: Partial<LintContext>): UnboundLintOffense[] {
    const visitor = new ERBNoConditionalHTMLElementRuleVisitor(this.name, context)

    visitor.visit(result.value)

    return visitor.offenses
  }
}
