import { ParserRule } from "../types.js"
import { ElementStackVisitor } from "./rule-utils.js"

import { isKeyboardFocusableElement } from "./rule-utils.js"
import { getStaticAttributeValue, getTagLocalName } from "@herb-tools/core"

import type { UnboundLintOffense, LintContext, FullRuleConfig } from "../types.js"
import type { ParseResult, ParserOptions, HTMLElementNode } from "@herb-tools/core"

// TODO: make these classes configurable once https://github.com/marcoroth/herb/issues/1204 lands
const VISUALLY_HIDDEN_CLASSES = ["sr-only"]
const VISUALLY_SHOWN_ON_FOCUS = /(?:^|:)(?:group-)?focus(?:-visible|-within)?:not-sr-only$/

const isUndoClass = (className: string): boolean =>
  className === "not-sr-only" || VISUALLY_SHOWN_ON_FOCUS.test(className)

class NoVisuallyHiddenInteractiveElementsVisitor extends ElementStackVisitor {
  visitHTMLElementNode(node: HTMLElementNode): void {
    const tagName = getTagLocalName(node)

    if (tagName !== "input" && isKeyboardFocusableElement(node)) {
      const classValue = getStaticAttributeValue(node, "class")

      if (classValue) {
        const classes = classValue.split(/\s+/)

        if (VISUALLY_HIDDEN_CLASSES.some((cls) => classes.includes(cls)) && !classes.some(isUndoClass)) {
          this.addOffenseWithCallChain(
            `The keyboard-focusable \`<${tagName}>\` element uses \`sr-only\` without a focus reveal class, so sighted keyboard users may think focus was lost. Remove \`sr-only\` or add a class such as \`focus:not-sr-only\` to reveal the element when it receives focus.`,
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
  static introducedIn = this.version("unreleased")

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
    const visitor = new NoVisuallyHiddenInteractiveElementsVisitor(
      this.ruleName,
      context,
    )

    visitor.visit(result.value)

    return visitor.offenses
  }
}
