import { type ParseResult, type ParserOptions, type HTMLElementNode, getTagLocalName, getStaticAttributeValue } from "@herb-tools/core"

import { BaseRuleVisitor } from "./rule-utils.js"
import { ParserRule } from "../types.js"
import type { UnboundLintOffense, LintContext, FullRuleConfig } from "../types.js"

const INTERACTIVE_ELEMENTS = ["a", "button", "summary", "select", "option", "textarea"]

const VISUALLY_HIDDEN_CLASSES = ["sr-only"]
const VISUALLY_HIDDEN_UNDO_CLASSES = ["not-sr-only", "focus:not-sr-only", "focus-within:not-sr-only"]

class NoVisuallyHiddenInteractiveElementsVisitor extends BaseRuleVisitor {
  visitHTMLElementNode(node: HTMLElementNode): void {
    const tagName = getTagLocalName(node)

    if (tagName && INTERACTIVE_ELEMENTS.includes(tagName)) {
      const classValue = getStaticAttributeValue(node, "class")

      if (classValue) {
        const classes = classValue.split(/\s+/)

        if (VISUALLY_HIDDEN_CLASSES.some((cls) => classes.includes(cls)) && !VISUALLY_HIDDEN_UNDO_CLASSES.some((cls) => classes.includes(cls))) {
          this.addOffense(
            "Avoid visually hiding interactive elements. Visually hiding interactive elements can be confusing to sighted keyboard users as it appears their focus has been lost when they navigate to the hidden element.",
            node.tag_name!.location,
          )
        }
      }
    }

    super.visitHTMLElementNode(node)
  }
}

export class A11yNoVisuallyHiddenInteractiveElementsRule extends ParserRule {
  static ruleName = "a11y-no-visually-hidden-interactive-elements"
  static introducedIn = this.version("0.9.4")

  get defaultConfig(): FullRuleConfig {
    return {
      enabled: false,
      severity: "warning",
    }
  }

  get parserOptions(): Partial<ParserOptions> {
    return {
      action_view_helpers: true,
    }
  }

  check(result: ParseResult, context?: Partial<LintContext>): UnboundLintOffense[] {
    const visitor = new NoVisuallyHiddenInteractiveElementsVisitor(this.ruleName, context)

    visitor.visit(result.value)

    return visitor.offenses
  }
}
