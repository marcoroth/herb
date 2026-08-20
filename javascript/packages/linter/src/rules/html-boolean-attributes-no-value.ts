import { ParserRule, BaseAutofixContext, Mutable } from "../types.js"
import { AttributeVisitorMixin, StaticAttributeStaticValueParams, StaticAttributeDynamicValueParams, isBooleanAttribute } from "../utils/rule-utils.js"
import { StateScopeMap } from "../utils/state-directives-utils.js"
import { bareReadName } from "@herb-tools/client/directives"
import { hasAttributeValue, getAttributeValueNodes, isERBContentNode } from "@herb-tools/core"
import { IdentityPrinter } from "@herb-tools/printer"

import type { UnboundLintOffense, LintOffense, LintContext, FullRuleConfig } from "../types.js"
import type { ParseResult, HTMLAttributeNode } from "@herb-tools/core"

interface BooleanAttributeAutofixContext extends BaseAutofixContext {
  node: Mutable<HTMLAttributeNode>
}

class BooleanAttributesNoValueVisitor extends AttributeVisitorMixin<BooleanAttributeAutofixContext> {
  public states: string[] = []

  protected checkStaticAttributeStaticValue({ originalAttributeName, attributeNode }: StaticAttributeStaticValueParams) {
    this.checkAttribute(originalAttributeName, attributeNode)
  }

  protected checkStaticAttributeDynamicValue({ originalAttributeName, attributeNode }: StaticAttributeDynamicValueParams) {
    if (this.bindsDeclaredState(attributeNode)) return

    this.checkAttribute(originalAttributeName, attributeNode)
  }

  private bindsDeclaredState(attributeNode: HTMLAttributeNode): boolean {
    if (this.states.length === 0) return false

    const outputs = getAttributeValueNodes(attributeNode).filter((child) =>
      isERBContentNode(child) && (child.tag_opening?.value === "<%=" || child.tag_opening?.value === "<%=="),
    )

    if (outputs.length !== 1 || getAttributeValueNodes(attributeNode).length !== 1) return false

    const name = bareReadName((outputs[0] as { content?: { value: string } | null }).content?.value ?? "")

    return name !== null && this.states.includes(name)
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
  static ruleName = "html-boolean-attributes-no-value"
  static introducedIn = this.version("0.4.0")

  get defaultConfig(): FullRuleConfig {
    return {
      enabled: true,
      severity: "error"
    }
  }

  check(result: ParseResult, context?: Partial<LintContext>): UnboundLintOffense<BooleanAttributeAutofixContext>[] {
    const visitor = new BooleanAttributesNoValueVisitor(this.ruleName, context)

    visitor.states = StateScopeMap.collect(result.value).allNames()
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
