import { ParserRule } from "../types.js"
import { BaseRuleVisitor, getTagName, getAttributes, findAttributeByName, getAttributeValue, HEADING_TAGS, getOpenTag } from "./rule-utils.js"
import { isLiteralNode, isHTMLTextNode, isHTMLElementNode, isERBOutputNode, isERBControlFlowNode } from "@herb-tools/core"

import type { Node } from "@herb-tools/core"
import type { UnboundLintOffense, LintContext, FullRuleConfig } from "../types.js"
import type { HTMLElementNode, HTMLOpenTagNode, ParseResult } from "@herb-tools/core"

class NoEmptyHeadingsVisitor extends BaseRuleVisitor {
  visitHTMLElementNode(node: HTMLElementNode): void {
    const tagName = getTagName(node)?.toLowerCase()
    if (tagName === "template") return

    this.checkHeadingElement(node)
    super.visitHTMLElementNode(node)
  }

  private checkHeadingElement(node: HTMLElementNode): void {
    const openTag = getOpenTag(node)
    if (!openTag) return

    const tagName = getTagName(node)
    if (!tagName) return

    const isStandardHeading = HEADING_TAGS.has(tagName)
    const isAriaHeading = this.hasHeadingRole(openTag)

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

  private hasHeadingRole(node: HTMLOpenTagNode): boolean {
    const attributes = getAttributes(node)
    const roleAttribute = findAttributeByName(attributes, "role")

    if (!roleAttribute) {
      return false
    }

    const roleValue = getAttributeValue(roleAttribute)
    return roleValue === "heading"
  }

  private isElementAccessible(node: HTMLElementNode): boolean {
    const openTag = getOpenTag(node)
    if (!openTag) return true

    const attributes = getAttributes(openTag)
    const ariaHiddenAttribute = findAttributeByName(attributes, "aria-hidden")

    if (ariaHiddenAttribute) {
      const ariaHiddenValue = getAttributeValue(ariaHiddenAttribute)

      if (ariaHiddenValue === "true") {
        return false
      }
    }

    if (!node.body || node.body.length === 0) {
      return false
    }

    return this.hasAccessibleContent(node.body)
  }
}

export class HTMLNoEmptyHeadingsRule extends ParserRule {
  name = "html-no-empty-headings"

  get defaultConfig(): FullRuleConfig {
    return {
      enabled: true,
      severity: "error"
    }
  }

  check(result: ParseResult, context?: Partial<LintContext>): UnboundLintOffense[] {
    const visitor = new NoEmptyHeadingsVisitor(this.name, context)
    visitor.visit(result.value)
    return visitor.offenses
  }
}
