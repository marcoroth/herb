import { ParserRule } from "../types.js"
import { BaseRuleVisitor, getTagName, hasAttribute, getAttributeValue, findAttributeByName, getAttributes } from "./rule-utils.js"

import type { UnboundLintOffense, LintContext, FullRuleConfig } from "../types.js"
import type { HTMLOpenTagNode, ParseResult } from "@herb-tools/core"

class NoAriaHiddenBodyVisitor extends BaseRuleVisitor {
  visitHTMLOpenTagNode(node: HTMLOpenTagNode): void {
    this.checkAriaHiddenOnBody(node)
    super.visitHTMLOpenTagNode(node)
  }

  private checkAriaHiddenOnBody(node: HTMLOpenTagNode): void {
    const tagName = getTagName(node)?.toLowerCase()

    if (tagName !== "body") return

    if (this.hasAriaHidden(node)) {
      this.addOffense(
        "The `aria-hidden` attribute should never be present on the `<body>` element, as it hides the entire document from assistive technology users.",
        node.tag_name!.location,
      )
    }
  }

  private hasAriaHidden(node: HTMLOpenTagNode): boolean {
    if (!hasAttribute(node, "aria-hidden")) return false

    const attributes = getAttributes(node)
    const ariaHiddenAttr = findAttributeByName(attributes, "aria-hidden")

    if (!ariaHiddenAttr) return false

    const value = getAttributeValue(ariaHiddenAttr)

    return value === null || value === "" || value === "true"
  }
}

export class HTMLNoAriaHiddenOnBodyRule extends ParserRule {
  name = "html-no-aria-hidden-on-body"

  get defaultConfig(): FullRuleConfig {
    return {
      enabled: true,
      severity: "error"
    }
  }

  check(result: ParseResult, context?: Partial<LintContext>): UnboundLintOffense[] {
    const visitor = new NoAriaHiddenBodyVisitor(this.name, context)

    visitor.visit(result.value)

    return visitor.offenses
  }
}
