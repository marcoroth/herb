import { ParserRule } from "../types.js"
import { AttributeVisitorMixin, ABSTRACT_ARIA_ROLES, StaticAttributeStaticValueParams } from "./rule-utils.js"

import type { UnboundLintOffense, LintContext, FullRuleConfig } from "../types.js"
import type { ParseResult } from "@herb-tools/core"

class NoAbstractRolesVisitor extends AttributeVisitorMixin {
  protected checkStaticAttributeStaticValue({ attributeName, attributeValue, attributeNode }: StaticAttributeStaticValueParams): void {
    if (attributeName !== "role") return
    if (!attributeValue) return

    const normalizedValue = attributeValue.toLowerCase()

    if (!ABSTRACT_ARIA_ROLES.has(normalizedValue)) return

    this.addOffense(
      `The \`role\` attribute must not use abstract ARIA role \`${attributeValue}\`. Abstract roles are not meant to be used directly.`,
      attributeNode.location,
    )
  }
}

export class HTMLNoAbstractRolesRule extends ParserRule {
  name = "html-no-abstract-roles"

  get defaultConfig(): FullRuleConfig {
    return {
      enabled: true,
      severity: "error"
    }
  }

  check(result: ParseResult, context?: Partial<LintContext>): UnboundLintOffense[] {
    const visitor = new NoAbstractRolesVisitor(this.name, context)

    visitor.visit(result.value)

    return visitor.offenses
  }
}
