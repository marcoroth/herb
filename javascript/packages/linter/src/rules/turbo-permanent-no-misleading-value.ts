import { BaseRuleVisitor } from "./rule-utils.js"
import { getAttribute, hasAttributeValue } from "@herb-tools/core"

import { ParserRule, BaseAutofixContext, Mutable } from "../types.js"
import type { UnboundLintOffense, LintOffense, LintContext, FullRuleConfig } from "../types.js"
import type { HTMLAttributeNode, HTMLOpenTagNode, ParseResult } from "@herb-tools/core"

interface TurboPermanentAutofixContext extends BaseAutofixContext {
  node: Mutable<HTMLAttributeNode>
}

class TurboPermanentNoMisleadingValueVisitor extends BaseRuleVisitor<TurboPermanentAutofixContext> {
  visitHTMLOpenTagNode(node: HTMLOpenTagNode): void {
    this.checkTurboPermanentAttribute(node)
    super.visitHTMLOpenTagNode(node)
  }

  private checkTurboPermanentAttribute(node: HTMLOpenTagNode): void {
    const attribute = getAttribute(node, "data-turbo-permanent")

    if (!attribute) return
    if (!hasAttributeValue(attribute)) return

    this.addOffense(
      "Attribute `data-turbo-permanent` should not contain any value. Its presence alone enables the behavior, so values like `\"true\"` or `\"false\"` are misleading.",
      attribute.value!.location,
      {
        node: attribute
      }
    )
  }
}

export class TurboPermanentNoMisleadingValueRule extends ParserRule<TurboPermanentAutofixContext> {
  static autocorrectable = true
  static ruleName = "turbo-permanent-no-misleading-value"
  static introducedIn = this.version("0.9.0")

  get defaultConfig(): FullRuleConfig {
    return {
      enabled: true,
      severity: "error"
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
