import { BaseRuleVisitor, getTagName, getAttributes, findAttributeByName, getAttributeValue, HEADING_TAGS } from "./rule-utils.js"

import { ParserRule } from "../types.js"

import type { UnboundLintOffense, LintContext, FullRuleConfig } from "../types.js"
import type { HTMLElementNode, HTMLOpenTagNode, ParseResult, LiteralNode, HTMLTextNode } from "@herb-tools/core"

class NoEmptyHeadingsVisitor extends BaseRuleVisitor {
  visitHTMLElementNode(node: HTMLElementNode): void {
    this.checkHeadingElement(node)
    super.visitHTMLElementNode(node)
  }


  private checkHeadingElement(node: HTMLElementNode): void {
    if (!node.open_tag || node.open_tag.type !== "AST_HTML_OPEN_TAG_NODE") {
      return
    }

    const openTag = node.open_tag as HTMLOpenTagNode
    const tagName = getTagName(openTag)

    if (!tagName) {
      return
    }

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

    let hasAccessibleContent = false

    for (const child of node.body) {
      if (child.type === "AST_LITERAL_NODE") {
        const literalNode = child as LiteralNode

        if (literalNode.content.trim().length > 0) {
          hasAccessibleContent = true
          break
        }
      } else if (child.type === "AST_HTML_TEXT_NODE") {
        const textNode = child as HTMLTextNode

        if (textNode.content.trim().length > 0) {
          hasAccessibleContent = true
          break
        }
      } else if (child.type === "AST_HTML_ELEMENT_NODE") {
        const elementNode = child as HTMLElementNode

        if (this.isElementAccessible(elementNode)) {
          hasAccessibleContent = true
          break
        }
      } else {
        hasAccessibleContent = true
        break
      }
    }

    return !hasAccessibleContent
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
    if (!node.open_tag || node.open_tag.type !== "AST_HTML_OPEN_TAG_NODE") {
      return true
    }

    const openTag = node.open_tag as HTMLOpenTagNode
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

    for (const child of node.body) {
      if (child.type === "AST_LITERAL_NODE") {
        const literalNode = child as LiteralNode
        if (literalNode.content.trim().length > 0) {
          return true
        }
      } else if (child.type === "AST_HTML_TEXT_NODE") {
        const textNode = child as HTMLTextNode
        if (textNode.content.trim().length > 0) {
          return true
        }
      } else if (child.type === "AST_HTML_ELEMENT_NODE") {
        const elementNode = child as HTMLElementNode
        if (this.isElementAccessible(elementNode)) {
          return true
        }
      } else {
        // If there's any non-literal/non-text/non-element content (like ERB), consider it accessible
        return true
      }
    }

    return false
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
