import { BaseRuleVisitor } from "../utils/rule-utils.js"
import { ParserRule } from "../types.js"
import { slotsDirectiveMode } from "../utils/state-directives-utils.js"
import { forEachAttribute, getAttributeName, getStaticAttributeValueContent, getTagName, hasDynamicOutput, getAttributeValueNodes, isHTMLElementNode } from "@herb-tools/core"

import type { UnboundLintOffense, LintContext, FullRuleConfig } from "../types.js"
import type { ParseResult, ParserOptions, ERBContentNode, HTMLElementNode, HTMLAttributeNode, Node } from "@herb-tools/core"
import type * as Nodes from "@herb-tools/core"

const COMPONENT_NAME = /^[A-Z][A-Za-z0-9]*$/
const WHOLE_NUMBER = /^\d+$/

const BUILT_IN = ["Fragment", "Fallback", "Async", "Lazy"]
const DEFERRED = ["Async", "Lazy"]
const TIMING_ATTRIBUTES = ["delay", "hold", "poll"]

const ALLOWED_ATTRIBUTES: Record<string, string[]> = {
  Fragment: ["delay", "hold", "on"],
  Async: ["delay", "hold", "on", "poll"],
  Lazy: ["delay", "hold", "on", "poll"],
  Fallback: [],
}

function componentName(node: Node): string | null {
  if (!isHTMLElementNode(node)) return null

  const name = getTagName(node)

  if (!name || !COMPONENT_NAME.test(name) || !/[a-z]/.test(name)) return null

  return name
}

class SlotsDirectiveChecker extends BaseRuleVisitor {
  public declaresSlots = false

  visitERBContentNode(node: ERBContentNode): void {
    if (slotsDirectiveMode(node) !== null) {
      this.declaresSlots = true
    }
  }
}

class SlotsValidComponentsVisitor extends BaseRuleVisitor {
  private elementStack: (string | null)[] = []
  private iterationDepth = 0

  visitERBIterationBlockNode(node: Nodes.ERBIterationBlockNode): void {
    this.iterationDepth += 1
    super.visitERBIterationBlockNode(node)
    this.iterationDepth -= 1
  }

  visitHTMLElementNode(node: HTMLElementNode): void {
    const name = componentName(node)

    if (!name) {
      this.elementStack.push(null)
      super.visitHTMLElementNode(node)
      this.elementStack.pop()

      return
    }

    this.checkComponent(node, name)

    this.elementStack.push(name)
    super.visitHTMLElementNode(node)
    this.elementStack.pop()
  }

  private parentComponent(): string | null {
    return this.elementStack[this.elementStack.length - 1] ?? null
  }

  private checkComponent(node: HTMLElementNode, name: string): void {
    if (!BUILT_IN.includes(name)) {
      this.addOffense(
        `\`<${name}>\` is not a component Herb knows.`,
        node.location,
      )

      return
    }

    if (name === "Fallback") {
      this.checkFallback(node)

      return
    }

    this.checkAttributes(node, name)
    this.checkFallbacks(node, name)

    if (name === "Fragment" && this.parentComponent() === "Fallback") {
      this.addOffense(
        "A `<Fragment>` sits inside a `<Fallback>`, which renders once and stays static, so nothing inside it can stay live.",
        node.location,
      )
    }

    if (DEFERRED.includes(name) && this.iterationDepth > 0) {
      this.addOffense(
        `A \`<${name}>\` sits inside a collection, and a deferred block cannot stand per item yet.`,
        node.location,
      )
    }
  }

  private checkFallback(node: HTMLElementNode): void {
    const inside = this.parentComponent()

    if (inside === null || inside === "Fallback") {
      this.addOffense(
        "`<Fallback>` sits outside a `<Fragment>`, so there is nothing for it to stand in for.",
        node.location,
      )
    }

    if (node.open_tag && this.attributesOf(node).length > 0) {
      this.addOffense(
        "`<Fallback>` takes no attributes yet.",
        node.location,
      )
    }
  }

  private checkAttributes(node: HTMLElementNode, name: string): void {
    const allowed = ALLOWED_ATTRIBUTES[name]
    const attributes = this.attributesOf(node)

    if (attributes.some((attribute) => !allowed.includes(getAttributeName(attribute) ?? ""))) {
      this.addOffense(
        `\`<${name}>\` only takes ${allowed.map((attribute) => `\`${attribute}\``).join(" and ")}.`,
        node.location,
      )
    }

    for (const attribute of attributes) {
      const attributeName = getAttributeName(attribute)

      if (!attributeName || !allowed.includes(attributeName)) continue
      if (getAttributeValueNodes(attribute).some((valueNode) => hasDynamicOutput([valueNode]))) continue

      const value = getStaticAttributeValueContent(attribute) ?? ""

      if (TIMING_ATTRIBUTES.includes(attributeName) && !WHOLE_NUMBER.test(value.trim())) {
        this.addOffense(
          `\`${attributeName}\` on a \`<${name}>\` takes a whole number of milliseconds.`,
          attribute.location,
        )
      }

      if (name === "Fragment" && attributeName === "on" && value.split(/[,\s]+/).filter((state) => state !== "").length === 0) {
        this.addOffense(
          "`on` names the states that mask this `<Fragment>`, and it names none.",
          attribute.location,
        )
      }
    }
  }

  private checkFallbacks(node: HTMLElementNode, name: string): void {
    const fallbacks = node.body.filter((child) => componentName(child) === "Fallback")

    if (fallbacks.length > 1) {
      this.addOffense(
        `A \`<${name}>\` holds ${fallbacks.length} \`<Fallback>\` elements, and it can only stand one in.`,
        node.location,
      )
    }

    if (name === "Fragment" && fallbacks.length === 0) {
      this.addOffense(
        "`<Fragment>` holds no `<Fallback>`, so it wraps nothing and compiles away.",
        node.location,
        undefined,
        "warning",
      )
    }
  }

  private attributesOf(node: HTMLElementNode): HTMLAttributeNode[] {
    const attributes: HTMLAttributeNode[] = []

    if (node.open_tag) {
      forEachAttribute(node.open_tag, (attribute) => attributes.push(attribute))
    }

    return attributes
  }
}

export class HerbSlotsValidComponentsRule extends ParserRule {
  static ruleName = "herb-slots-valid-components"
  static introducedIn = this.version("unreleased")

  get parserOptions(): Partial<ParserOptions> {
    return {
      iteration_nodes: true
    }
  }

  get defaultConfig(): FullRuleConfig {
    return {
      enabled: true,
      severity: "error"
    }
  }

  check(result: ParseResult, context?: Partial<LintContext>): UnboundLintOffense[] {
    const directive = new SlotsDirectiveChecker(this.ruleName, context)

    directive.visit(result.value)

    if (!directive.declaresSlots) return []

    const visitor = new SlotsValidComponentsVisitor(this.ruleName, context)

    visitor.visit(result.value)

    return visitor.offenses
  }
}
