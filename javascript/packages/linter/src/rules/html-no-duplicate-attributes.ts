import { BaseRuleVisitor, forEachAttribute } from "./rule-utils.js"

import { ParserRule } from "../types.js"
import type { LintOffense } from "../types.js"
import type { HTMLOpenTagNode, HTMLSelfCloseTagNode, HTMLAttributeNameNode, Node } from "@herb-tools/core"

class NoDuplicateAttributesVisitor extends BaseRuleVisitor {
  visitHTMLOpenTagNode(node: HTMLOpenTagNode): void {
    this.checkDuplicateAttributes(node)
    super.visitHTMLOpenTagNode(node)
  }

  visitHTMLSelfCloseTagNode(node: HTMLSelfCloseTagNode): void {
    this.checkDuplicateAttributes(node)
    super.visitHTMLSelfCloseTagNode(node)
  }

  private checkDuplicateAttributes(node: HTMLOpenTagNode | HTMLSelfCloseTagNode): void {
    const attributeNames = new Map<string, HTMLAttributeNameNode[]>()

    forEachAttribute(node, (attributeNode) => {
      if (attributeNode.name?.type !== "AST_HTML_ATTRIBUTE_NAME_NODE") return

      const nameNode = attributeNode.name as HTMLAttributeNameNode
      if (!nameNode.name) return

      const attributeName = nameNode.name.value.toLowerCase() // HTML attributes are case-insensitive

      if (!attributeNames.has(attributeName)) {
        attributeNames.set(attributeName, [])
      }

      attributeNames.get(attributeName)!.push(nameNode)
    })

    for (const [attributeName, nameNodes] of attributeNames) {
      if (nameNodes.length > 1) {
        for (let i = 1; i < nameNodes.length; i++) {
          const nameNode = nameNodes[i]

          this.addOffense(
            `Duplicate attribute \`${attributeName}\` found on tag. Remove the duplicate occurrence.`,
            nameNode.location,
            "error"
          )
        }
      }
    }
  }
}

export class HTMLNoDuplicateAttributesRule extends ParserRule {
  name = "html-no-duplicate-attributes"

  check(node: Node): LintOffense[] {
    const visitor = new NoDuplicateAttributesVisitor(this.name)
    visitor.visit(node)
    return visitor.offenses
  }
}
