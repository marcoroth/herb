import { ParserRule, BaseAutofixContext, Mutable } from "../types.js"
import { AttributeVisitorMixin, StaticAttributeStaticValueParams, StaticAttributeDynamicValueParams, isBooleanAttribute, hasAttributeValue } from "./rule-utils.js"
import { IdentityPrinter } from "@herb-tools/printer"

import type { UnboundLintOffense, LintOffense, LintContext, FullRuleConfig } from "../types.js"
import type { ParseResult, HTMLAttributeNode } from "@herb-tools/core"

interface BooleanAttributeAutofixContext extends BaseAutofixContext {
  node: Mutable<HTMLAttributeNode>
}

class BooleanAttributesNoValueVisitor extends AttributeVisitorMixin<BooleanAttributeAutofixContext> {
  protected checkStaticAttributeStaticValue({ originalAttributeName, attributeNode }: StaticAttributeStaticValueParams) {
    this.checkAttribute(originalAttributeName, attributeNode)
  }

  protected checkStaticAttributeDynamicValue({ originalAttributeName, attributeNode }: StaticAttributeDynamicValueParams) {
    this.checkAttribute(originalAttributeName, attributeNode)
  }

  private checkAttribute(attributeName: string, attributeNode: HTMLAttributeNode) {
    if (!isBooleanAttribute(attributeName)) return
    if (!hasAttributeValue(attributeNode)) return

    this.addOffense(
      `Boolean attribute \`${IdentityPrinter.print(attributeNode.name)}\` should not have a value. Use \`${attributeName.toLowerCase()}\` instead of \`${IdentityPrinter.print(attributeNode)}\`.`,
      attributeNode.value!.location,
      {
        node: attributeNode
      }
    )
  }
}

export class HTMLBooleanAttributesNoValueRule extends ParserRule<BooleanAttributeAutofixContext> {
  static autocorrectable = true
  name = "html-boolean-attributes-no-value"

  get defaultConfig(): FullRuleConfig {
    return {
      enabled: true,
      severity: "error"
    }
  }

  check(result: ParseResult, context?: Partial<LintContext>): UnboundLintOffense<BooleanAttributeAutofixContext>[] {
    const visitor = new BooleanAttributesNoValueVisitor(this.name, context)

    visitor.visit(result.value)

    return visitor.offenses
  }

  autofix(offense: LintOffense<BooleanAttributeAutofixContext>, result: ParseResult, _context?: Partial<LintContext>): ParseResult | null {
    if (!offense.autofixContext) return null

    const { node } = offense.autofixContext

    node.equals = null
    node.value = null

    return result
  }
}
