import { ParserRule } from "../types"
import { ElementStackVisitor, isHeadOnlyTag } from "./rule-utils"
import { hasAttribute, getTagLocalName } from "@herb-tools/core"

import type { ParseResult, HTMLElementNode } from "@herb-tools/core"
import type { UnboundLintOffense, LintContext, FullRuleConfig } from "../types"

class HeadOnlyElementsVisitor extends ElementStackVisitor {
  visitHTMLElementNode(node: HTMLElementNode): void {
    const tagName = getTagLocalName(node)

    if (tagName && !this.isInsideElement("head") && this.isInsideElement("body") && isHeadOnlyTag(tagName)) {
      const isAllowedInSVG = (tagName === "title" || tagName === "style") && this.isInsideElement("svg")
      const isMetaWithItemprop = tagName === "meta" && hasAttribute(node, "itemprop")

      if (!isAllowedInSVG && !isMetaWithItemprop) {
        this.addOffense(
          `Element \`<${tagName}>\` must be placed inside the \`<head>\` tag.`,
          node.location,
        )
      }
    }

    super.visitHTMLElementNode(node)
  }
}

export class HTMLHeadOnlyElementsRule extends ParserRule {
  static autocorrectable = false
  static ruleName = "html-head-only-elements"
  static introducedIn = this.version("0.8.0")

  get defaultConfig(): FullRuleConfig {
    return {
      enabled: true,
      severity: "error",
      exclude: ["**/*.xml", "**/*.xml.erb"]
    }
  }

  check(result: ParseResult, context?: Partial<LintContext>): UnboundLintOffense[] {
    const visitor = new HeadOnlyElementsVisitor(this.ruleName, context)

    visitor.visit(result.value)

    return visitor.offenses
  }
}
