import { AttributeVisitorMixin } from "./rule-utils.js"
import { IdentityPrinter } from "@herb-tools/printer"
import { ParserRule, BaseAutofixContext, Mutable } from "../types.js"

import { getStaticAttributeValue, hasAttributeValue, isERBOpenTagNode } from "@herb-tools/core"

import type { StaticAttributeStaticValueParams, StaticAttributeDynamicValueParams } from "./rule-utils.js"
import type { UnboundLintOffense, LintOffense, LintContext, FullRuleConfig } from "../types.js"
import type { HTMLAttributeNode, HTMLOpenTagNode, ERBOpenTagNode, ParseResult, ParserOptions } from "@herb-tools/core"

interface TurboPermanentAutofixContext extends BaseAutofixContext {
  node: Mutable<HTMLAttributeNode>
}

class TurboPermanentNoMisleadingValueVisitor extends AttributeVisitorMixin<TurboPermanentAutofixContext> {
  protected checkStaticAttributeStaticValue({ attributeName, attributeNode, parentNode }: StaticAttributeStaticValueParams): void {
    this.checkTurboPermanentAttribute(attributeName, attributeNode, parentNode)
  }

  protected checkStaticAttributeDynamicValue({ attributeName, attributeNode, parentNode }: StaticAttributeDynamicValueParams): void {
    if (isERBOpenTagNode(parentNode)) return

    this.checkTurboPermanentAttribute(attributeName, attributeNode, parentNode)
  }

  private checkTurboPermanentAttribute(attributeName: string, attributeNode: HTMLAttributeNode, parentNode: HTMLOpenTagNode | ERBOpenTagNode): void {
    if (attributeName !== "data-turbo-permanent") return
    if (!hasAttributeValue(attributeNode)) return

    const autofixContext = isERBOpenTagNode(parentNode) ? undefined : { node: attributeNode }
    const isTruthyValue = getStaticAttributeValue(attributeNode)?.trim().toLowerCase() === "true"

    const explanation = isTruthyValue
      ? `is redundant, because Turbo only checks whether the attribute is present.`
      : `still makes the element permanent, because Turbo only checks whether the attribute is present.`

    this.addOffense(
      `Attribute \`data-turbo-permanent\` should not have a value. \`${IdentityPrinter.print(attributeNode)}\` ${explanation} Use \`data-turbo-permanent\` instead.`,
      attributeNode.value!.location,
      autofixContext
    )
  }
}

export class TurboPermanentNoMisleadingValueRule extends ParserRule<TurboPermanentAutofixContext> {
  static autocorrectable = true
  static ruleName = "turbo-permanent-no-misleading-value"
  static introducedIn = this.version("unreleased")

  get defaultConfig(): FullRuleConfig {
    return {
      enabled: true,
      severity: "error"
    }
  }

  get parserOptions(): Partial<ParserOptions> {
    return {
      action_view_helpers: true,
    }
  }

  check(result: ParseResult, context?: Partial<LintContext>): UnboundLintOffense<TurboPermanentAutofixContext>[] {
    const visitor = new TurboPermanentNoMisleadingValueVisitor(this.ruleName, context)

    visitor.visit(result.value)

    return visitor.offenses
  }

  autofix(offense: LintOffense<TurboPermanentAutofixContext>, result: ParseResult, _context?: Partial<LintContext>): ParseResult | null {
    if (!offense.autofixContext) return null

    const { node } = offense.autofixContext

    node.equals = null
    node.value = null

    return result
  }
}
