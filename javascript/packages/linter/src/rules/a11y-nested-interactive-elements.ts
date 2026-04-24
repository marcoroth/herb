import { ElementStackVisitor } from "./rule-utils.js"
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
      }
    }

    super.visitHTMLElementNode(node)
  }

  private findInteractiveAncestor(childTagName: string): string | null {
    const ancestor = this.currentElement

    if (!ancestor) return null

    const ancestorTag = getTagLocalName(ancestor)
    if (!ancestorTag || !INTERACTIVE_ELEMENTS.has(ancestorTag)) return null

    if (ancestorTag === "summary" && childTagName === "a") return null

    return ancestorTag
  }
}

export class A11yNestedInteractiveElementsRule extends ParserRule {
  static ruleName = "a11y-nested-interactive-elements"
  static introducedIn = this.version("unreleased")

  get defaultConfig(): FullRuleConfig {
    return {
      enabled: false,
      severity: "error"
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
