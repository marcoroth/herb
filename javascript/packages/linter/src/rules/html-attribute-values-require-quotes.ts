import { Token, Location } from "@herb-tools/core"
import { ParserRule, BaseAutofixContext, Mutable } from "../types.js"
import { AttributeVisitorMixin, StaticAttributeStaticValueParams, StaticAttributeDynamicValueParams } from "./rule-utils.js"

import type { UnboundLintOffense, LintOffense, LintContext, FullRuleConfig } from "../types.js"
import type { HTMLAttributeNode, ParseResult,  } from "@herb-tools/core"

interface AttributeValuesRequireQuotesAutofixContext extends BaseAutofixContext {
  node: Mutable<HTMLAttributeNode>
  unquotedValue: string
}

class AttributeValuesRequireQuotesVisitor extends AttributeVisitorMixin<AttributeValuesRequireQuotesAutofixContext> {
  protected checkStaticAttributeStaticValue({ attributeName, attributeValue, attributeNode }: StaticAttributeStaticValueParams): void {
    if (this.hasAttributeValue(attributeNode)) return
    if (this.isQuoted(attributeNode)) return

    this.addOffense(
      `Attribute value should be quoted: \`${attributeName}="${attributeValue}"\`. Always wrap attribute values in quotes.`,
      attributeNode.value!.location,
      {
        node: attributeNode,
        unquotedValue: attributeValue
      }
    )
  }

  protected checkStaticAttributeDynamicValue({ attributeName, attributeNode, combinedValue }: StaticAttributeDynamicValueParams): void {
    if (this.hasAttributeValue(attributeNode)) return
    if (this.isQuoted(attributeNode)) return

    this.addOffense(
      `Attribute value should be quoted: \`${attributeName}="${combinedValue}"\`. Always wrap attribute values in quotes.`,
      attributeNode.value!.location,
      {
        node: attributeNode,
        unquotedValue: combinedValue || ""
      }
    )
  }

  private hasAttributeValue(attributeNode: HTMLAttributeNode): boolean {
    return attributeNode.value?.type !== "AST_HTML_ATTRIBUTE_VALUE_NODE"
  }

  private isQuoted(attributeNode: HTMLAttributeNode): boolean {
    const valueNode = attributeNode.value

    return valueNode ? valueNode.quoted : false
  }
}

export class HTMLAttributeValuesRequireQuotesRule extends ParserRule<AttributeValuesRequireQuotesAutofixContext> {
  static autocorrectable = true
  name = "html-attribute-values-require-quotes"

  get defaultConfig(): FullRuleConfig {
    return {
      enabled: true,
      severity: "error"
    }
  }

  check(result: ParseResult, context?: Partial<LintContext>): UnboundLintOffense<AttributeValuesRequireQuotesAutofixContext>[] {
    const visitor = new AttributeValuesRequireQuotesVisitor(this.name, context)

    visitor.visit(result.value)

    return visitor.offenses
  }

  autofix(offense: LintOffense<AttributeValuesRequireQuotesAutofixContext>, result: ParseResult, _context?: Partial<LintContext>): ParseResult | null {
    if (!offense.autofixContext) return null

    const { node: { value } } = offense.autofixContext

    if (!value) return null

    const quote = Token.from({ type: "TOKEN_QUOTE", value: '"', location: Location.zero, range: [0, 0] })

    if (value.open_quote) {
      value.open_quote.value = '"'
    } else {
      value.open_quote = quote
    }

    if (value.close_quote) {
      value.close_quote.value = '"'
    } else {
      value.close_quote = quote
    }

    value.quoted = true

    return result
  }
}
