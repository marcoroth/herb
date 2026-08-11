import { ParserRule } from "../types"
import { ElementStackVisitor, isHeadOnlyTag, isBodyOnlyTag } from "./rule-utils"
import { hasAttribute, getTagLocalName } from "@herb-tools/core"

import type { ParseResult, HTMLElementNode, ParserOptions } from "@herb-tools/core"
import type * as Nodes from "@herb-tools/core"
import type { UnboundLintOffense, LintContext, FullRuleConfig } from "../types"

const inTheBodyNotTheHead = (ancestors: string[]) => ancestors.includes("body") && !ancestors.includes("head")

interface UndecidedElement {
  tagName: string
  node: HTMLElementNode
}

class HeadOnlyElementsVisitor extends ElementStackVisitor {
  private undecided: UndecidedElement[] = []
  private bodyOnlyTagName: string | null = null
  private conditionalDepth = 0

  visitERBIfNode(node: Nodes.ERBIfNode): void {
    this.withinConditional(() => super.visitERBIfNode(node))
  }

  visitERBUnlessNode(node: Nodes.ERBUnlessNode): void {
    this.withinConditional(() => super.visitERBUnlessNode(node))
  }

  visitERBCaseNode(node: Nodes.ERBCaseNode): void {
    this.withinConditional(() => super.visitERBCaseNode(node))
  }

  visitERBCaseMatchNode(node: Nodes.ERBCaseMatchNode): void {
    this.withinConditional(() => super.visitERBCaseMatchNode(node))
  }

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
        } else if (verdict === "unknown" && this.alwaysRenders) {
          this.undecided.push({ tagName, node })
        }
      }
    } else if (tagName && isBodyOnlyTag(tagName) && this.alwaysRenders && !this.bodyOnlyTagName) {
      this.bodyOnlyTagName = tagName
    }

    super.visitHTMLElementNode(node)
  }

  reportContradictions(): void {
    if (!this.bodyOnlyTagName) return

    for (const { tagName, node } of this.undecided) {
      this.addOffense(
        `Element \`<${tagName}>\` must be placed inside the \`<head>\` tag. This template also renders the body-only element \`<${this.bodyOnlyTagName}>\`, so one of the two is misplaced.`,
        node.location,
      )
    }
  }

  private get alwaysRenders(): boolean {
    if (this.conditionalDepth > 0) return false
    if (this.isInsideDetachedBlock) return false
    if (this.isInsideElement("template")) return false

    return !this.isInsideElement("html", "head", "body")
  }

  private withinConditional(visit: () => void): void {
    this.conditionalDepth++
    visit()
    this.conditionalDepth--
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
    visitor.reportContradictions()

    return visitor.offenses
  }
}
