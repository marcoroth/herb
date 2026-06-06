import { ParserRule } from "../types.js"
import { BaseRuleVisitor } from "./rule-utils.js"

import { getTagLocalName, getStaticAttributeValue, hasAttribute } from "@herb-tools/core"

import type { ParseResult, ParserOptions, HTMLElementNode } from "@herb-tools/core"
import type { UnboundLintOffense, LintContext, FullRuleConfig } from "../types.js"

const GENERIC_ELEMENTS = ["span", "div"]
const NAME_RESTRICTED_ELEMENTS = ["h1", "h2", "h3", "h4", "h5", "h6", "strong", "em", "i", "p", "b", "code"]

// https://w3c.github.io/aria/#namefromprohibited
const ROLES_WHICH_CANNOT_BE_NAMED = [
  "caption",
  "code",
  "definition",
  "deletion",
  "emphasis",
  "generic",
  "insertion",
  "mark",
  "none",
  "paragraph",
  "presentation",
  "strong",
  "subscript",
  "suggestion",
  "superscript",
  "term",
  "time",
  "tooltip",
]

const MESSAGE = "`aria-label` and `aria-labelledby` usage are only reliably supported on interactive elements and a subset of ARIA roles."

class NoAriaLabelMisuseVisitor extends BaseRuleVisitor {
  visitHTMLElementNode(node: HTMLElementNode): void {
    this.checkElement(node)
    super.visitHTMLElementNode(node)
  }

  private checkElement(node: HTMLElementNode): void {
    const tagName = getTagLocalName(node)

    if (!tagName) return
    if (!hasAttribute(node, "aria-label") && !hasAttribute(node, "aria-labelledby")) return

    if (NAME_RESTRICTED_ELEMENTS.includes(tagName)) {
      this.addOffense(MESSAGE, node.tag_name!.location)
      return
    }

    if (!GENERIC_ELEMENTS.includes(tagName)) return

    const role = getStaticAttributeValue(node, "role")

    if (!hasAttribute(node, "role")) {
      this.addOffense(MESSAGE, node.tag_name!.location)
      return
    }

    if (role === null) return

    if (ROLES_WHICH_CANNOT_BE_NAMED.includes(role)) {
      this.addOffense(MESSAGE, node.tag_name!.location)
    }
  }
}

export class A11yNoAriaLabelMisuseRule extends ParserRule {
  static ruleName = "a11y-no-aria-label-misuse"
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
    const visitor = new NoAriaLabelMisuseVisitor(this.ruleName, context)

    visitor.visit(result.value)

    return visitor.offenses
  }
}
