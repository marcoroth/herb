import { ParserRule, BaseAutofixContext, Mutable } from "../types.js"
import { AttributeVisitorMixin, StaticAttributeStaticValueParams, StaticAttributeDynamicValueParams, getAttributeValueQuoteType, hasAttributeValue } from "./rule-utils.js"
import { filterLiteralNodes } from "@herb-tools/core"

import type { UnboundLintOffense, LintOffense, LintContext, FullRuleConfig } from "../types.js"
import type { ParseResult, HTMLAttributeNode } from "@herb-tools/core"

interface AttributeDoubleQuotesAutofixContext extends BaseAutofixContext {
  node: Mutable<HTMLAttributeNode>
  valueContent: string
}

class AttributeDoubleQuotesVisitor extends AttributeVisitorMixin<AttributeDoubleQuotesAutofixContext> {
  protected checkStaticAttributeStaticValue({ attributeName, attributeValue, attributeNode }: StaticAttributeStaticValueParams) {
    if (!hasAttributeValue(attributeNode)) return
    if (getAttributeValueQuoteType(attributeNode) !== "single") return
    if (attributeValue?.includes('"')) return

    this.addOffense(
      `Attribute \`${attributeName}\` uses single quotes. Prefer double quotes for HTML attribute values: \`${attributeName}="${attributeValue}"\`.`,
      attributeNode.value!.location,
      {
        node: attributeNode,
        valueContent: attributeValue
      }
    )
  }

  protected checkStaticAttributeDynamicValue({ attributeName, valueNodes, attributeNode, combinedValue }: StaticAttributeDynamicValueParams) {
    if (!hasAttributeValue(attributeNode)) return
    if (getAttributeValueQuoteType(attributeNode) !== "single") return
    if (filterLiteralNodes(valueNodes).some(node => node.content?.includes('"'))) return

    this.addOffense(
      `Attribute \`${attributeName}\` uses single quotes. Prefer double quotes for HTML attribute values: \`${attributeName}="${combinedValue}"\`.`,
      attributeNode.value!.location,
      {
        node: attributeNode,
        valueContent: combinedValue || ""
      }
    )
  }
}

export class HTMLAttributeDoubleQuotesRule extends ParserRule<AttributeDoubleQuotesAutofixContext> {
  static autocorrectable = true
  name = "html-attribute-double-quotes"

  get defaultConfig(): FullRuleConfig {
    return {
      enabled: true,
      severity: "warning"
    }
  }

  check(result: ParseResult, context?: Partial<LintContext>): UnboundLintOffense<AttributeDoubleQuotesAutofixContext>[] {
    const visitor = new AttributeDoubleQuotesVisitor(this.name, context)

    visitor.visit(result.value)

    return visitor.offenses
  }

  autofix(offense: LintOffense<AttributeDoubleQuotesAutofixContext>, result: ParseResult, _context?: Partial<LintContext>): ParseResult | null {
    if (!offense.autofixContext) return null

    const { node: { value } } = offense.autofixContext

    if (!value) return null
    if (!value.open_quote) return  null
    if (!value.close_quote) return  null

    value.open_quote.value = '"'
    value.close_quote.value = '"'

    return result
  }
}
