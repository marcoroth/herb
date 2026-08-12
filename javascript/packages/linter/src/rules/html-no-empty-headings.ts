import { ParserRule } from "../types.js"
import { BaseRuleVisitor, HEADING_TAGS } from "./rule-utils.js"
import { getTagLocalName } from "@herb-tools/core"
import { isLiteralNode, isHTMLTextNode, isHTMLElementNode, isERBOutputNode, isERBControlFlowNode, getStaticAttributeValue } from "@herb-tools/core"

import type { Node } from "@herb-tools/core"
import type { UnboundLintOffense, LintContext, FullRuleConfig } from "../types.js"
import type { HTMLElementNode, ParseResult } from "@herb-tools/core"

class NoEmptyHeadingsVisitor extends BaseRuleVisitor {
  visitHTMLElementNode(node: HTMLElementNode): void {
    const tagName = getTagLocalName(node)
    if (tagName === "template") return

    this.checkHeadingElement(node)
    super.visitHTMLElementNode(node)
  }

  private checkHeadingElement(node: HTMLElementNode): void {
    const tagName = getTagLocalName(node)
    if (!tagName) return

    const isStandardHeading = HEADING_TAGS.has(tagName)
    const isAriaHeading = this.hasHeadingRole(node)

    if (!isStandardHeading && !isAriaHeading) {
      return
    }

    if (this.isEmptyHeading(node)) {
      const elementDescription = isStandardHeading
        ? `\`<${tagName}>\``
        : `\`<${tagName} role="heading">\``

      this.addOffense(
        `Heading element ${elementDescription} must not be empty. Provide accessible text content for screen readers and SEO.`,
        node.location,
      )
    }
  }

  private isEmptyHeading(node: HTMLElementNode): boolean {
    if (!node.body || node.body.length === 0) {
      return true
    }

    return !this.hasAccessibleContent(node.body)
  }

  private hasAccessibleContent(nodes: Node[]): boolean {
    for (const child of nodes) {
      if (isLiteralNode(child) || isHTMLTextNode(child)) {
        if (child.content.trim().length > 0) {
          return true
        }
      } else if (isHTMLElementNode(child)) {
        if (this.isElementAccessible(child)) {
          return true
        }
      } else if (isERBOutputNode(child)) {
        return true
      } else if (isERBControlFlowNode(child)) {
        if (this.hasAccessibleContentInControlFlow(child)) {
          return true
        }
      }
    }

    return false
  }

  private hasAccessibleContentInControlFlow(node: Node): boolean {
    const nodeWithStatements = node as { statements?: Node[], body?: Node[], subsequent?: Node }

    if (nodeWithStatements.statements && this.hasAccessibleContent(nodeWithStatements.statements)) {
      return true
    }

    if (nodeWithStatements.body && this.hasAccessibleContent(nodeWithStatements.body)) {
      return true
    }

    if (nodeWithStatements.subsequent) {
      return this.hasAccessibleContentInControlFlow(nodeWithStatements.subsequent)
    }

    return false
  }

  private hasHeadingRole(node: HTMLElementNode): boolean {
    return getStaticAttributeValue(node, "role") === "heading"
  }

  private isElementAccessible(node: HTMLElementNode): boolean {
    if (getStaticAttributeValue(node, "aria-hidden") === "true") {
      return false
    }

    if (!node.body || node.body.length === 0) {
      return false
    }

    return this.hasAccessibleContent(node.body)
  }
}

export class HTMLNoEmptyHeadingsRule extends ParserRule {
  static ruleName = "html-no-empty-headings"
  static introducedIn = this.version("0.4.0")

  get defaultConfig(): FullRuleConfig {
    return {
      enabled: true,
      severity: "warning"
    }
  }

  check(result: ParseResult, context?: Partial<LintContext>): UnboundLintOffense[] {
    const visitor = new NoEmptyHeadingsVisitor(this.ruleName, context)
    visitor.visit(result.value)
    return visitor.offenses
  }
}
