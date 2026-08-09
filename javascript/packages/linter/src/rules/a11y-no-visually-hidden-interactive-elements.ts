import { ParserRule } from "../types.js"
import { ElementStackVisitor } from "./rule-utils.js"

import { isKeyboardFocusableElement } from "./rule-utils.js"
import { getStaticAttributeValue, getTagLocalName } from "@herb-tools/core"

import type { UnboundLintOffense, LintContext, FullRuleConfig } from "../types.js"
import type { AncestorChain, ParseResult, ParserOptions, HTMLElementNode } from "@herb-tools/core"

// TODO: make these classes configurable once https://github.com/marcoroth/herb/issues/1204 lands
const VISUALLY_HIDDEN_CLASSES = ["sr-only"]
const VISUALLY_SHOWN_ON_FOCUS = /(?:^|:)(?:group-)?focus(?:-visible|-within)?:not-sr-only$/
const VISUALLY_SHOWN_ON_DESCENDANT_FOCUS = /(?:^|:)(?:group-)?focus-within:not-sr-only$/

const isUndoClass = (className: string): boolean =>
  className === "not-sr-only" || VISUALLY_SHOWN_ON_FOCUS.test(className)

const isDescendantUndoClass = (className: string): boolean =>
  className === "not-sr-only" || VISUALLY_SHOWN_ON_DESCENDANT_FOCUS.test(className)

function hiddenAncestorIndex(attributes: Record<string, string>[]): number {
  for (let index = attributes.length - 1; index >= 0; index--) {
    const classes = attributes[index].class?.split(/\s+/).filter(Boolean) ?? []

    if (classes.includes("sr-only") && !classes.some(isDescendantUndoClass)) return index
  }

  return -1
}

function hiddenAncestorInChain(chain: AncestorChain | null): { tagName: string, file: string } | null {
  if (!chain) return null

  const index = hiddenAncestorIndex(chain.attributes ?? chain.tags.map(() => ({})))
  if (index < 0) return null

  let frameStart = 0

  for (const frame of chain.frames) {
    const frameEnd = frameStart + frame.ancestors.length

    if (index < frameEnd) {
      return { tagName: chain.tags[index], file: frame.file }
    }

    frameStart = frameEnd
  }

  return null
}

class NoVisuallyHiddenInteractiveElementsVisitor extends ElementStackVisitor {
  visitHTMLElementNode(node: HTMLElementNode): void {
    const tagName = getTagLocalName(node)

    if (tagName === "input" || !isKeyboardFocusableElement(node)) {
      super.visitHTMLElementNode(node)
      return
    }

    const classValue = getStaticAttributeValue(node, "class")
    const classes = classValue ? classValue.split(/\s+/) : []

    if (VISUALLY_HIDDEN_CLASSES.some((cls) => classes.includes(cls)) && !classes.some(isUndoClass)) {
      this.addOffense(
        `The keyboard-focusable \`<${tagName}>\` element uses \`sr-only\` without a focus reveal class, so sighted keyboard users may think focus was lost. Remove \`sr-only\` or add a class such as \`focus:not-sr-only\` to reveal the element when it receives focus.`,
        node.tag_name!.location,
      )
    } else {
      const localHiddenIndex = hiddenAncestorIndex(this.ancestorAttributes)

      if (localHiddenIndex >= 0) {
        const ancestorTagName = this.ancestorTagNames[localHiddenIndex]

        this.addOffense(
          `The keyboard-focusable \`<${tagName}>\` element is inside a \`<${ancestorTagName}>\` hidden by \`sr-only\`, so sighted keyboard users may think focus was lost. Remove \`sr-only\` from the ancestor or add \`focus-within:not-sr-only\` to reveal its contents when they receive focus.`,
          node.tag_name!.location,
        )
      } else {
        const placement = this.placementAcrossCallers((_ancestors, ancestorAttributes) =>
          hiddenAncestorIndex(ancestorAttributes) >= 0
        )

        if (placement.verdict === "always" || placement.verdict === "mixed") {
          const reach = placement.verdict === "always"
            ? "Every call site renders"
            : "At least one call site renders"
          const hiddenAncestor = hiddenAncestorInChain(placement.chain)
          const source = hiddenAncestor
            ? ` The displayed call chain identifies the hidden \`<${hiddenAncestor.tagName}>\` in \`${hiddenAncestor.file}\`.`
            : ""

          this.addOffenseWithCallChain(
            `${reach} the keyboard-focusable \`<${tagName}>\` element inside an ancestor hidden by \`sr-only\`, so sighted keyboard users may think focus was lost.${source} Remove \`sr-only\` from the ancestor or add \`focus-within:not-sr-only\` to reveal its contents when they receive focus.`,
            node.tag_name!.location,
            placement.chain,
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
