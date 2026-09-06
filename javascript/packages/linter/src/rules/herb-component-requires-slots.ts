import { BaseRuleVisitor } from "../utils/rule-utils.js"
import { ParserRule } from "../types.js"
import { slotsDirectiveMode } from "../utils/state-directives-utils.js"
import { getTagName, isKnownHTMLElement } from "@herb-tools/core"

import type { UnboundLintOffense, LintContext, FullRuleConfig } from "../types.js"
import type { ParseResult, ERBContentNode, HTMLOpenTagNode, XMLDeclarationNode } from "@herb-tools/core"

class ComponentRequiresSlotsVisitor extends BaseRuleVisitor {
  public declaresSlots = false
  public xml = false
  public components: HTMLOpenTagNode[] = []

  visitXMLDeclarationNode(_node: XMLDeclarationNode): void {
    this.xml = true
  }

  visitERBContentNode(node: ERBContentNode): void {
    if (slotsDirectiveMode(node) !== null) {
      this.declaresSlots = true
    }
  }

  visitHTMLOpenTagNode(node: HTMLOpenTagNode): void {
    const name = getTagName(node)

    if (name && /^[A-Z]/.test(name) && !isKnownHTMLElement(name.toLowerCase())) {
      this.components.push(node)
    }

    super.visitHTMLOpenTagNode(node)
  }

  reportOutsideSlots(): void {
    if (this.declaresSlots || this.xml) return

    for (const component of this.components) {
      this.addOffense(
        `\`<${getTagName(component)}>\` is written like a component, but this template never opts into slots, so the browser renders it as a literal unknown element. Add \`<%# herb:slots client %>\` to compile it, or lowercase the tag if it is meant as plain HTML.`,
        component.location,
      )
    }
  }
}

export class HerbComponentRequiresSlotsRule extends ParserRule {
  static ruleName = "herb-component-requires-slots"
  static introducedIn = this.version("unreleased")

  get defaultConfig(): FullRuleConfig {
    return {
      enabled: true,
      severity: "error"
    }
  }

  check(result: ParseResult, context?: Partial<LintContext>): UnboundLintOffense[] {
    if (context?.fileName?.endsWith(".xml.erb")) return []

    const visitor = new ComponentRequiresSlotsVisitor(this.ruleName, context)

    visitor.visit(result.value)
    visitor.reportOutsideSlots()

    return visitor.offenses
  }
}
