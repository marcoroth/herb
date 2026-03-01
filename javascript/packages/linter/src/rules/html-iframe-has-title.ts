import { ParserRule } from "../types.js"
import { BaseRuleVisitor, getTagName, getAttribute, getAttributeValue } from "./rule-utils.js"

import type { UnboundLintOffense, LintContext, FullRuleConfig } from "../types.js"
import type { HTMLOpenTagNode, ParseResult } from "@herb-tools/core"

class IframeHasTitleVisitor extends BaseRuleVisitor {
  visitHTMLOpenTagNode(node: HTMLOpenTagNode): void {
    this.checkIframeElement(node)
    super.visitHTMLOpenTagNode(node)
  }

  private checkIframeElement(node: HTMLOpenTagNode): void {
    const tagName = getTagName(node)

    if (tagName !== "iframe") {
      return
    }

    const ariaHiddenAttribute = getAttribute(node, "aria-hidden")
    if (ariaHiddenAttribute) {
      const ariaHiddenValue = getAttributeValue(ariaHiddenAttribute)
      if (ariaHiddenValue === "true") {
        return
      }
    }

    const attribute = getAttribute(node, "title")

    if (!attribute) {
      this.addOffense(
        "`<iframe>` elements must have a `title` attribute that describes the content of the frame for screen reader users.",
        node.location,
      )

      return
    }

    const value = getAttributeValue(attribute)

    if (!value || value.trim() === "") {
      this.addOffense(
        "`<iframe>` elements must have a `title` attribute that describes the content of the frame for screen reader users.",
        node.location,
      )
    }
  }
}

export class HTMLIframeHasTitleRule extends ParserRule {
  name = "html-iframe-has-title"

  get defaultConfig(): FullRuleConfig {
    return {
      enabled: true,
      severity: "error"
    }
  }

  check(result: ParseResult, context?: Partial<LintContext>): UnboundLintOffense[] {
    const visitor = new IframeHasTitleVisitor(this.name, context)

    visitor.visit(result.value)

    return visitor.offenses
  }
}
