import { ParserRule } from "../types.js"
import { BaseRuleVisitor, getTagName, hasAttribute, getAttributes, findAttributeByName } from "./rule-utils.js"

import type { UnboundLintOffense, LintContext, FullRuleConfig } from "../types.js"
import type { HTMLOpenTagNode, HTMLAttributeValueNode, ParseResult, Node } from "@herb-tools/core"

const ELEMENTS_WITH_NATIVE_DISABLED_ATTRIBUTE_SUPPORT = new Set([
  "button", "fieldset", "input", "optgroup", "option", "select", "textarea"
])

class AvoidBothDisabledAndAriaDisabledVisitor extends BaseRuleVisitor {
  visitHTMLOpenTagNode(node: HTMLOpenTagNode): void {
    this.checkElement(node)
    super.visitHTMLOpenTagNode(node)
  }

  private checkElement(node: HTMLOpenTagNode): void {
    const tagName = getTagName(node)

    if (!tagName || !ELEMENTS_WITH_NATIVE_DISABLED_ATTRIBUTE_SUPPORT.has(tagName)) {
      return
    }

    const hasDisabled = hasAttribute(node, "disabled")
    const hasAriaDisabled = hasAttribute(node, "aria-disabled")

    if ((hasDisabled && this.hasERBContent(node, "disabled")) || (hasAriaDisabled && this.hasERBContent(node, "aria-disabled"))) {
      return
    }

    if (hasDisabled && hasAriaDisabled) {
      this.addOffense(
        "aria-disabled may be used in place of native HTML disabled to allow tab-focus on an otherwise ignored element. Setting both attributes is contradictory and confusing. Choose either disabled or aria-disabled, not both.",
        node.tag_name!.location,
      )
    }
  }

  private hasERBContent(node: HTMLOpenTagNode, attributeName: string): boolean {
    const attributes = getAttributes(node)

    const attribute = findAttributeByName(attributes, attributeName)
    if (!attribute) return false

    const valueNode = attribute.value
    if (!valueNode || valueNode.type !== "AST_HTML_ATTRIBUTE_VALUE_NODE") return false

    const htmlValueNode = valueNode as HTMLAttributeValueNode
    if (!htmlValueNode.children) return false

    return htmlValueNode.children.some((child: Node) => child.type === "AST_ERB_CONTENT_NODE")
  }
}

export class HTMLAvoidBothDisabledAndAriaDisabledRule extends ParserRule {
  name = "html-avoid-both-disabled-and-aria-disabled"

  get defaultConfig(): FullRuleConfig {
    return {
      enabled: true,
      severity: "error"
    }
  }

  check(result: ParseResult, context?: Partial<LintContext>): UnboundLintOffense[] {
    const visitor = new AvoidBothDisabledAndAriaDisabledVisitor(this.name, context)

    visitor.visit(result.value)

    return visitor.offenses
  }
}
