import { BaseRuleVisitor } from "./rule-utils.js"
import { ParserRule, BaseAutofixContext, Mutable } from "../types.js"

import type { UnboundLintOffense, LintOffense, LintContext, FullRuleConfig } from "../types.js"
import type { ParseResult, HTMLAttributeNode } from "@herb-tools/core"

interface AttributeEqualsSpacingAutofixContext extends BaseAutofixContext {
  node: Mutable<HTMLAttributeNode>
}

class HTMLAttributeEqualsSpacingVisitor extends BaseRuleVisitor<AttributeEqualsSpacingAutofixContext> {
  visitHTMLAttributeNode(attribute: HTMLAttributeNode): void {
    if (!attribute.equals || !attribute.name || !attribute.value) {
      return
    }

    if (attribute.equals.value.startsWith(" ")) {
      this.addOffense(
        "Remove whitespace before `=` in HTML attribute",
        attribute.equals.location,
        { node: attribute }
      )
    }

    if (attribute.equals.value.endsWith(" ")) {
      this.addOffense(
        "Remove whitespace after `=` in HTML attribute",
        attribute.equals.location,
        { node: attribute }
      )
    }
  }
}

export class HTMLAttributeEqualsSpacingRule extends ParserRule<AttributeEqualsSpacingAutofixContext> {
  static autocorrectable = true
  name = "html-attribute-equals-spacing"

  get defaultConfig(): FullRuleConfig {
    return {
      enabled: true,
      severity: "error"
    }
  }

  check(result: ParseResult, context?: Partial<LintContext>): UnboundLintOffense<AttributeEqualsSpacingAutofixContext>[] {
    const visitor = new HTMLAttributeEqualsSpacingVisitor(this.name, context)

    visitor.visit(result.value)

    return visitor.offenses
  }

  autofix(offense: LintOffense<AttributeEqualsSpacingAutofixContext>, result: ParseResult, _context?: Partial<LintContext>): ParseResult | null {
    if (!offense.autofixContext) return null

    const { node: { equals } } = offense.autofixContext

    if (!equals) return null

    equals.value = "="

    return result
  }
}
