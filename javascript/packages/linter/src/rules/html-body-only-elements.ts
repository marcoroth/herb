import { ParserRule } from "../types.js"
import { ElementStackVisitor, isBodyOnlyTag } from "./rule-utils.js"
import { getTagLocalName } from "@herb-tools/core"

import type { UnboundLintOffense, LintContext, FullRuleConfig } from "../types.js"
import type { HTMLElementNode, ParseResult } from "@herb-tools/core"

class HTMLBodyOnlyElementsVisitor extends ElementStackVisitor {
  visitHTMLElementNode(node: HTMLElementNode): void {
    const tagName = getTagLocalName(node)

    if (tagName && !this.isInsideElement("body") && this.isInsideElement("head") && isBodyOnlyTag(tagName)) {
      this.addOffense(
        `Element \`<${tagName}>\` must be placed inside the \`<body>\` tag.`,
        node.location,
      )
    }

    super.visitHTMLElementNode(node)
  }
}

export class HTMLBodyOnlyElementsRule extends ParserRule {
  static autocorrectable = false
  static ruleName = "html-body-only-elements"
  static introducedIn = this.version("0.8.0")

  get defaultConfig(): FullRuleConfig {
    return {
      enabled: true,
      severity: "error",
      exclude: ["**/*.xml", "**/*.xml.erb"]
    }
  }

  check(result: ParseResult, context?: Partial<LintContext>): UnboundLintOffense[] {
    const visitor = new HTMLBodyOnlyElementsVisitor(this.ruleName, context)

    visitor.visit(result.value)

    return visitor.offenses
  }
}
