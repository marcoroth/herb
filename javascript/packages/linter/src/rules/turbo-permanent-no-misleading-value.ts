import { BaseRuleVisitor } from "./rule-utils.js"
import { IdentityPrinter } from "@herb-tools/printer"
import { ParserRule, BaseAutofixContext, Mutable } from "../types.js"

import { findAttributeByName, getStaticAttributeValue, hasAttributeValue, hasStaticAttributeValue } from "@herb-tools/core"

import type { UnboundLintOffense, LintOffense, LintContext, FullRuleConfig } from "../types.js"
import type { HTMLAttributeNode, HTMLOpenTagNode, ERBOpenTagNode, ParseResult, ParserOptions } from "@herb-tools/core"

interface TurboPermanentAutofixContext extends BaseAutofixContext {
  node: Mutable<HTMLAttributeNode>
}

class TurboPermanentNoMisleadingValueVisitor extends BaseRuleVisitor<TurboPermanentAutofixContext> {
  visitHTMLOpenTagNode(node: HTMLOpenTagNode): void {
    const attribute = findAttributeByName(node.children, "data-turbo-permanent")

    if (attribute) {
      this.checkTurboPermanentAttribute(attribute, { node: attribute })
    }

    super.visitHTMLOpenTagNode(node)
  }

  visitERBOpenTagNode(node: ERBOpenTagNode): void {
    const attribute = findAttributeByName(node.children, "data-turbo-permanent")

    if (attribute && hasStaticAttributeValue(attribute)) {
      this.checkTurboPermanentAttribute(attribute, undefined)
    }

    super.visitERBOpenTagNode(node)
  }

  private checkTurboPermanentAttribute(attribute: HTMLAttributeNode, autofixContext: TurboPermanentAutofixContext | undefined): void {
    if (!hasAttributeValue(attribute)) return

    const isTruthyValue = getStaticAttributeValue(attribute)?.trim().toLowerCase() === "true"

    const explanation = isTruthyValue
      ? `is redundant, because Turbo only checks whether the attribute is present.`
      : `still makes the element permanent, because Turbo only checks whether the attribute is present.`

    this.addOffense(
      `Attribute \`data-turbo-permanent\` should not have a value. \`${IdentityPrinter.print(attribute)}\` ${explanation} Use \`data-turbo-permanent\` instead.`,
      attribute.value!.location,
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
