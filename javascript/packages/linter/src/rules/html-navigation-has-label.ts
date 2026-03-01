import { ParserRule } from "../types.js"
import { BaseRuleVisitor, getTagName, hasAttribute, getAttributeValue, findAttributeByName, getAttributes } from "./rule-utils.js"

import type { UnboundLintOffense, LintContext, FullRuleConfig } from "../types.js"
import type { HTMLOpenTagNode, ParseResult } from "@herb-tools/core"

class NavigationHasLabelVisitor extends BaseRuleVisitor {
  visitHTMLOpenTagNode(node: HTMLOpenTagNode): void {
    this.checkNavigationElement(node)
    super.visitHTMLOpenTagNode(node)
  }

  private checkNavigationElement(node: HTMLOpenTagNode): void {
    const tagName = getTagName(node)
    const isNavElement = tagName === "nav"
    const hasNavigationRole = this.hasRoleNavigation(node)

    if (!isNavElement && !hasNavigationRole) {
      return
    }

    const hasAriaLabel = hasAttribute(node, "aria-label")
    const hasAriaLabelledby = hasAttribute(node, "aria-labelledby")

    if (!hasAriaLabel && !hasAriaLabelledby) {
      let message = `The navigation landmark should have a unique accessible name via \`aria-label\` or \`aria-labelledby\`. Remember that the name does not need to include "navigation" or "nav" since it will already be announced.`

      if (hasNavigationRole && !isNavElement) {
        message += ` Additionally, you can safely drop the \`role="navigation"\` and replace it with the native HTML \`<nav>\` element.`
      }

      this.addOffense(
        message,
        node.tag_name!.location,
      )
    }
  }

  private hasRoleNavigation(node: HTMLOpenTagNode): boolean {
    const attributes = getAttributes(node)
    const roleAttribute = findAttributeByName(attributes, "role")

    if (!roleAttribute) {
      return false
    }

    const roleValue = getAttributeValue(roleAttribute)

    return roleValue === "navigation"
  }
}

export class HTMLNavigationHasLabelRule extends ParserRule {
  name = "html-navigation-has-label"

  get defaultConfig(): FullRuleConfig {
    return {
      enabled: false,
      severity: "error"
    }
  }

  check(result: ParseResult, context?: Partial<LintContext>): UnboundLintOffense[] {
    const visitor = new NavigationHasLabelVisitor(this.name, context)

    visitor.visit(result.value)

    return visitor.offenses
  }
}
