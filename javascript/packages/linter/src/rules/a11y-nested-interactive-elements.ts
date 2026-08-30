import { ElementStackVisitor } from "../utils/rule-utils.js"
import { getTagLocalName, getStaticAttributeValue } from "@herb-tools/core"

import { ParserRule } from "../types.js"
import type { UnboundLintOffense, LintContext, FullRuleConfig } from "../types.js"
import type { HTMLElementNode, ParseResult, ParserOptions } from "@herb-tools/core"

const INTERACTIVE_ELEMENTS = new Set([
  "a",
  "button",
  "input",
  "select",
  "summary",
  "textarea",
])

class NestedInteractiveElementsVisitor extends ElementStackVisitor {
  visitHTMLElementNode(node: HTMLElementNode): void {
    const tagName = getTagLocalName(node)

    if (tagName && INTERACTIVE_ELEMENTS.has(tagName)) {
      if (tagName === "input" && getStaticAttributeValue(node, "type") === "hidden") {
        super.visitHTMLElementNode(node)
        return
      }

      const ancestor = this.findInteractiveAncestor(tagName)

      if (ancestor) {
        this.addOffense(
          `Found \`<${tagName}>\` nested inside of \`<${ancestor}>\`. Nesting interactive elements produces invalid HTML, and assistive technologies, such as screen readers, might ignore or respond unexpectedly to such nested controls.`,
          node.location,
        )
      } else {
        this.checkRenderedInteractiveAncestor(tagName, node)
      }
    }

    super.visitHTMLElementNode(node)
  }

  private checkRenderedInteractiveAncestor(tagName: string, node: HTMLElementNode): void {
    const candidates = [...INTERACTIVE_ELEMENTS].filter(tag => !(tag === "summary" && tagName === "a"))
    const verdict = this.isRenderedInsideElement(...candidates)

    if (verdict !== "always" && verdict !== "mixed") return

    const caller = this.closestRenderedElement(...candidates)
    if (!caller) return

    const reach = verdict === "always"
      ? `Every call site renders this file inside a \`<${caller}>\`.`
      : `At least one call site renders this file inside a \`<${caller}>\`.`

    this.addOffenseWithCallChain(
      `Found \`<${tagName}>\` nested inside of \`<${caller}>\`. ${reach} Nesting interactive elements produces invalid HTML, and assistive technologies, such as screen readers, might ignore or respond unexpectedly to such nested controls.`,
      node.location,
      verdict === "mixed" ? this.renderedChainInside(...candidates) : undefined,
    )
  }

  private findInteractiveAncestor(childTagName: string): string | null {
    for (const ancestor of this.ancestors) {
      const ancestorTag = getTagLocalName(ancestor)

      if (!ancestorTag || !INTERACTIVE_ELEMENTS.has(ancestorTag)) continue
      if (ancestorTag === "summary" && childTagName === "a") continue

      return ancestorTag
    }

    return null
  }
}

export class A11yNestedInteractiveElementsRule extends ParserRule {
  static ruleName = "a11y-nested-interactive-elements"
  static introducedIn = this.version("0.10.2")

  get defaultConfig(): FullRuleConfig {
    return {
      enabled: false,
      severity: "error",
      environments: ["cli", "browser"],
    }
  }

  get parserOptions(): Partial<ParserOptions> {
    return {
      action_view_helpers: true,
    }
  }

  check(result: ParseResult, context?: Partial<LintContext>): UnboundLintOffense[] {
    const visitor = new NestedInteractiveElementsVisitor(this.ruleName, context)
    visitor.visit(result.value)
    return visitor.offenses
  }
}
