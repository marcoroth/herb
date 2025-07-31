import { BaseRuleVisitor, getTagName, findAttributeByName, getAttributes } from "./rule-utils.js"

import type { Rule, LintOffense } from "../types.js"
import type { HTMLOpenTagNode, HTMLSelfCloseTagNode, HTMLAttributeValueNode, ERBContentNode, LiteralNode, Node } from "@herb-tools/core"

class ERBPreferImageTagHelperVisitor extends BaseRuleVisitor {
  visitHTMLOpenTagNode(node: HTMLOpenTagNode): void {
    this.checkImgTag(node)
    super.visitHTMLOpenTagNode(node)
  }

  visitHTMLSelfCloseTagNode(node: HTMLSelfCloseTagNode): void {
    this.checkImgTag(node)
    super.visitHTMLSelfCloseTagNode(node)
  }

  private checkImgTag(node: HTMLOpenTagNode | HTMLSelfCloseTagNode): void {
    const tagName = getTagName(node)

    if (tagName !== "img") {
      return
    }

    const attributes = getAttributes(node)
    const srcAttribute = findAttributeByName(attributes, "src")

    if (!srcAttribute) {
      return
    }

    if (!srcAttribute.value) {
      return
    }

    const valueNode = srcAttribute.value as HTMLAttributeValueNode
    const hasERBContent = this.containsERBContent(valueNode)

    if (hasERBContent) {
      const suggestedExpression = this.buildSuggestedExpression(valueNode)

      this.addOffense(
        `Prefer \`image_tag\` helper over manual \`<img>\` with dynamic ERB expressions. Use \`<%= image_tag ${suggestedExpression}, alt: "..." %>\` instead.`,
        srcAttribute.location,
        "warning"
      )
    }
  }

  private containsERBContent(valueNode: HTMLAttributeValueNode): boolean {
    if (!valueNode.children) return false

    return valueNode.children.some(child => child.type === "AST_ERB_CONTENT_NODE")
  }

  private buildSuggestedExpression(valueNode: HTMLAttributeValueNode): string {
    if (!valueNode.children) return "expression"

    let hasText = false
    let hasERB = false

    for (const child of valueNode.children) {
      if (child.type === "AST_ERB_CONTENT_NODE") {
        hasERB = true
      } else if (child.type === "AST_LITERAL_NODE") {
        const literalNode = child as LiteralNode

        if (literalNode.content && literalNode.content.trim()) {
          hasText = true
        }
      }
    }

    if (hasText && hasERB) {
      let result = '"'

      for (const child of valueNode.children) {
        if (child.type === "AST_ERB_CONTENT_NODE") {
          const erbNode = child as ERBContentNode

          result += `#{${(erbNode.content?.value || "").trim()}}`
        } else if (child.type === "AST_LITERAL_NODE") {
          const literalNode = child as LiteralNode

          result += literalNode.content || ""
        }
      }

      result += '"'

      return result
    }

    if (hasERB && !hasText) {
      const erbNodes = valueNode.children.filter(child => child.type === "AST_ERB_CONTENT_NODE") as ERBContentNode[]

      if (erbNodes.length === 1) {
        return (erbNodes[0].content?.value || "").trim()
      } else if (erbNodes.length > 1) {
        let result = '"'

        for (const erbNode of erbNodes) {
          result += `#{${(erbNode.content?.value || "").trim()}}`
        }

        result += '"'

        return result
      }
    }

    return "expression"
  }
}

export class ERBPreferImageTagHelperRule implements Rule {
  name = "erb-prefer-image-tag-helper"

  check(node: Node): LintOffense[] {
    const visitor = new ERBPreferImageTagHelperVisitor(this.name)
    visitor.visit(node)
    return visitor.offenses
  }
}
