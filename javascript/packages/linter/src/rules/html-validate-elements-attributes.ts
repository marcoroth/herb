import { AttributeVisitorMixin, getTagName } from "./utils/rule-utils.js"
import { ParserRule } from "../types.js"

import { VALID_HTML_ELEMENTS, getValidAttributesForElement } from "./utils/html-element-attributes-map.js"
import { getAttributeValueRule } from "./utils/html-attribute-value-types.js"
import { validateAttributeValue } from "./utils/html-attribute-value-validators.js"

import type { LintOffense, LintContext } from "../types.js"
import type { HTMLAttributeNode, HTMLAttributeValueNode, HTMLOpenTagNode, HTMLSelfCloseTagNode, Node } from "@herb-tools/core"

function attributeContainsERB(attributeNode: HTMLAttributeNode): boolean {
  const valueNode = attributeNode.value as HTMLAttributeValueNode | null

  if (!valueNode || valueNode.type !== "AST_HTML_ATTRIBUTE_VALUE_NODE" || !valueNode.children?.length) {
    return false
  }

  for (const child of valueNode.children) {
    if (child.type && child.type.startsWith("AST_ERB_")) {
      return true
    }
  }

  return false
}

class ValidateElementsAttributesVisitor extends AttributeVisitorMixin {
  visitHTMLOpenTagNode(node: HTMLOpenTagNode): void {
    this.checkElement(node)
    super.visitHTMLOpenTagNode(node)
  }

  visitHTMLSelfCloseTagNode(node: HTMLSelfCloseTagNode): void {
    this.checkElement(node)
    super.visitHTMLSelfCloseTagNode(node)
  }

  private checkElement(node: HTMLOpenTagNode | HTMLSelfCloseTagNode): void {
    const tagName = getTagName(node)
    if (!tagName) return

    if (!VALID_HTML_ELEMENTS.has(tagName) && !tagName.includes("-")) {
      this.addOffense(
        `Unknown HTML element \`<${tagName}>\`. This element is not part of the HTML specification.`,
        node.tag_name!.location,
        "error"
      )

      return
    }
  }

  protected checkAttribute(
    attributeName: string,
    attributeValue: string | null,
    attributeNode: HTMLAttributeNode,
    parentNode: HTMLOpenTagNode | HTMLSelfCloseTagNode
  ): void {
    const tagName = getTagName(parentNode)

    if (!tagName) return
    if (!VALID_HTML_ELEMENTS.has(tagName)) return
    if (attributeName.startsWith("data-")) return
    if (attributeName.startsWith("aria-")) return
    if (attributeName.startsWith("on")) return

    const isCustomElement = tagName.includes("-")
    const validAttributes = getValidAttributesForElement(tagName)

    if (!validAttributes.has(attributeName) && !isCustomElement) {
      this.addOffense(
        `Invalid attribute \`${attributeName}\` for \`<${tagName}>\` element. This attribute is not valid for this HTML element.`,
        attributeNode.location,
        "error"
      )

      return
    }

    if (attributeContainsERB(attributeNode)) return

    const valueRule = getAttributeValueRule(tagName, attributeName)

    if (valueRule) {
      const validation = validateAttributeValue(attributeValue, valueRule, tagName, attributeName)

      if (!validation.valid && validation.message) {
        this.addOffense(
          validation.message,
          attributeNode.location,
          "error"
        )
      }
      
      if (validation.valid && validation.warning) {
        this.addOffense(
          validation.warning,
          attributeNode.location,
          "warning"
        )
      }
    }
  }
}

export class HTMLValidateElementsAttributesRule extends ParserRule {
  name = "html-validate-elements-attributes"

  check(node: Node, context?: Partial<LintContext>): LintOffense[] {
    const visitor = new ValidateElementsAttributesVisitor(this.name, context)

    visitor.visit(node)

    return visitor.offenses
  }
}
