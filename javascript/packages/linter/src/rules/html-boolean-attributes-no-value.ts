import { ParserRule, BaseAutofixContext, Mutable } from "../types.js"
import { AttributeVisitorMixin, StaticAttributeStaticValueParams, StaticAttributeDynamicValueParams, isBooleanAttribute } from "../utils/rule-utils.js"
import { StateScopeMap, declaredKind } from "../utils/state-directives-utils.js"
import { bareReadName, classifyDerivedDefault } from "@herb-tools/client/directives"
import { hasAttributeValue, getAttributeValueNodes, isERBContentNode } from "@herb-tools/core"
import { IdentityPrinter } from "@herb-tools/printer"

import type { UnboundLintOffense, LintOffense, LintContext, FullRuleConfig } from "../types.js"
import type { ParseResult, HTMLAttributeNode, ERBBlockNode } from "@herb-tools/core"

interface BooleanAttributeAutofixContext extends BaseAutofixContext {
  node: Mutable<HTMLAttributeNode>
}

class BooleanAttributesNoValueVisitor extends AttributeVisitorMixin<BooleanAttributeAutofixContext> {
  public states = new StateScopeMap()

  private stack: (ERBBlockNode | null)[] = [null]

  visitERBBlockNode(node: ERBBlockNode): void {
    this.stack.push(node)

    super.visitERBBlockNode(node)

    this.stack.pop()
  }

  protected checkStaticAttributeStaticValue({ originalAttributeName, attributeNode }: StaticAttributeStaticValueParams) {
    this.checkAttribute(originalAttributeName, attributeNode)
  }

  protected checkStaticAttributeDynamicValue({ originalAttributeName, attributeNode }: StaticAttributeDynamicValueParams) {
    if (this.bindsDeclaredState(attributeNode)) return

    this.checkAttribute(originalAttributeName, attributeNode)
  }

  private bindsDeclaredState(attributeNode: HTMLAttributeNode): boolean {
    const names = this.states.namesIn(this.stack)

    if (names.length === 0) return false

    const outputs = getAttributeValueNodes(attributeNode).filter((child) =>
      isERBContentNode(child) && (child.tag_opening?.value === "<%=" || child.tag_opening?.value === "<%=="),
    )

    if (outputs.length !== 1 || getAttributeValueNodes(attributeNode).length !== 1) return false

    const expression = (outputs[0] as { content?: { value: string } | null }).content?.value?.trim() ?? ""
    const name = bareReadName(expression)

    if (name !== null) return names.includes(name)

    // The engine accepts the whole condition grammar in a boolean attribute, combos included, so
    // this defers to the same classifier the state rules use instead of matching one `==` by hand.
    const declared = new Map<string, string>()

    for (const candidate of names) {
      const declaration = this.states.resolve(this.stack, candidate)

      if (declaration) declared.set(candidate, declaredKind(declaration))
    }

    const classified = classifyDerivedDefault(expression, declared)

    return classified !== null && classified !== "mixed"
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

    visitor.states = StateScopeMap.collect(result.value)
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
