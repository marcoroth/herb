import { ParserRule } from "../types"
import { ElementStackVisitor, isHeadOnlyTag } from "./rule-utils"
import { hasAttribute, getTagLocalName } from "@herb-tools/core"

import type { ParseResult, HTMLElementNode, ParserOptions } from "@herb-tools/core"
import type { UnboundLintOffense, LintContext, FullRuleConfig } from "../types"

const inTheBodyNotTheHead = (ancestors: string[]) => ancestors.includes("body") && !ancestors.includes("head")

class HeadOnlyElementsVisitor extends ElementStackVisitor {
  visitHTMLElementNode(node: HTMLElementNode): void {
    const tagName = getTagLocalName(node)

    if (tagName && isHeadOnlyTag(tagName)) {
      const isAllowedInSVG = (tagName === "title" || tagName === "style") && this.isInsideElement("svg")
      const isMetaWithItemprop = tagName === "meta" && hasAttribute(node, "itemprop")

      if (!isAllowedInSVG && !isMetaWithItemprop) {
        const { verdict, chain } = this.placementAcrossCallers(inTheBodyNotTheHead)
        const message = `Element \`<${tagName}>\` must be placed inside the \`<head>\` tag.`

        if (verdict === "always") {
          this.addOffenseWithCallChain(message, node.location, chain)
        } else if (verdict === "mixed") {
          this.addOffenseWithCallChain(`${message} At least one call site renders this file inside the \`<body>\`.`, node.location, chain)
        }
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

  get parserOptions(): Partial<ParserOptions> {
    return {
      action_view_helpers: true,
    }
  }

  check(result: ParseResult, context?: Partial<LintContext>): UnboundLintOffense[] {
    const visitor = new HeadOnlyElementsVisitor(this.ruleName, context)

    visitor.visit(result.value)

    return visitor.offenses
  }
}
