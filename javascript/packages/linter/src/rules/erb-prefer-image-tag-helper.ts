import { ParserRule } from "../types.js"
import { BaseRuleVisitor, getTagName, findAttributeByName, getAttributes } from "./rule-utils.js"

import { ERBToRubyStringPrinter } from "@herb-tools/printer"
import { filterNodes, ERBContentNode, LiteralNode, isNode } from "@herb-tools/core"

import type { UnboundLintOffense, LintContext, FullRuleConfig } from "../types.js"
import type { HTMLOpenTagNode, HTMLAttributeValueNode, ParseResult } from "@herb-tools/core"

class ERBPreferImageTagHelperVisitor extends BaseRuleVisitor {
  visitHTMLOpenTagNode(node: HTMLOpenTagNode): void {
    this.checkImgTag(node)
    super.visitHTMLOpenTagNode(node)
  }

  private checkImgTag(openTag: HTMLOpenTagNode): void {
    const tagName = getTagName(openTag)

    if (tagName !== "img") return

    const attributes = getAttributes(openTag)
    const srcAttribute = findAttributeByName(attributes, "src")

    if (!srcAttribute) return
    if (!srcAttribute.value) return

    const node = srcAttribute.value
    const hasERBContent = this.containsERBContent(node)

    if (hasERBContent) {
      if (this.isDataUri(node)) return

      if (this.shouldFlagAsImageTagCandidate(node)) {
        const suggestedExpression = this.buildSuggestedExpression(node)

        this.addOffense(
          `Prefer \`image_tag\` helper over manual \`<img>\` with dynamic ERB expressions. Use \`<%= image_tag ${suggestedExpression}, alt: "..." %>\` instead.`,
          srcAttribute.location,
        )
      }
    }
  }

  private containsERBContent(node: HTMLAttributeValueNode): boolean {
    return filterNodes(node.children, ERBContentNode).length > 0
  }

  private isOnlyERBContent(node: HTMLAttributeValueNode): boolean {
    return node.children.length > 0 && node.children.length === filterNodes(node.children, ERBContentNode).length
  }

  private getContentofFirstChild(node: HTMLAttributeValueNode): string {
    if (!node.children || node.children.length === 0) return ""

    const firstChild = node.children[0]

    if (isNode(firstChild, LiteralNode)) {
      return (firstChild.content || "").trim()
    }

    return ""
  }

  private isDataUri(node: HTMLAttributeValueNode): boolean {
    return this.getContentofFirstChild(node).startsWith("data:")
  }

  private isFullUrl(node: HTMLAttributeValueNode): boolean {
    const content = this.getContentofFirstChild(node)

    return content.startsWith("http://") || content.startsWith("https://")
  }

  private shouldFlagAsImageTagCandidate(node: HTMLAttributeValueNode): boolean {
    if (this.isOnlyERBContent(node)) return true
    if (this.isFullUrl(node)) return false

    return true
  }

  private buildSuggestedExpression(node: HTMLAttributeValueNode): string {
    if (!node.children) return "expression"

    try {
      return ERBToRubyStringPrinter.print(node, { ignoreErrors: false })
    } catch {
      return "expression"
    }
  }
}

export class ERBPreferImageTagHelperRule extends ParserRule {
  name = "erb-prefer-image-tag-helper"

  get defaultConfig(): FullRuleConfig {
    return {
      enabled: true,
      severity: "warning"
    }
  }

  check(result: ParseResult, context?: Partial<LintContext>): UnboundLintOffense[] {
    const visitor = new ERBPreferImageTagHelperVisitor(this.name, context)
    visitor.visit(result.value)
    return visitor.offenses
  }
}
