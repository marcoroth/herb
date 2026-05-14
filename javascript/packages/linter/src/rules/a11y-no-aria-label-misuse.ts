import { type ParseResult, type ParserOptions, type HTMLElementNode, getTagLocalName, getStaticAttributeValue, hasAttribute } from "@herb-tools/core"

import { BaseRuleVisitor } from "./rule-utils.js"
import { ParserRule } from "../types.js"
import type { UnboundLintOffense, LintContext, FullRuleConfig } from "../types.js"

const GENERIC_ELEMENTS = ["span", "div"]

const NAME_RESTRICTED_ELEMENTS = ["h1", "h2", "h3", "h4", "h5", "h6", "strong", "i", "p", "b", "code"]

// https://w3c.github.io/aria/#namefromprohibited
const ROLES_WHICH_CANNOT_BE_NAMED = [
  "caption",
  "code",
  "definition",
  "deletion",
  "emphasis",
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
]

const MESSAGE =
  "`aria-label` and `aria-labelledby` usage are only reliably supported on interactive elements and a subset of ARIA roles."

class NoAriaLabelMisuseVisitor extends BaseRuleVisitor {
  visitHTMLElementNode(node: HTMLElementNode): void {
    const tagName = getTagLocalName(node)

    if (tagName && this.hasAriaLabelAttribute(node)) {
      if (NAME_RESTRICTED_ELEMENTS.includes(tagName)) {
        this.addOffense(MESSAGE, node.tag_name!.location)
      } else if (GENERIC_ELEMENTS.includes(tagName)) {
        const role = getStaticAttributeValue(node, "role")

        if (role) {
          if (ROLES_WHICH_CANNOT_BE_NAMED.includes(role)) {
            this.addOffense(MESSAGE, node.tag_name!.location)
          }
        } else {
          this.addOffense(MESSAGE, node.tag_name!.location)
        }
      }
    }

    super.visitHTMLElementNode(node)
  }

  private hasAriaLabelAttribute(node: HTMLElementNode): boolean {
    return hasAttribute(node, "aria-label") || hasAttribute(node, "aria-labelledby")
  }
}

export class A11yNoAriaLabelMisuseRule extends ParserRule {
  static ruleName = "a11y-no-aria-label-misuse"
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
    const visitor = new NoAriaLabelMisuseVisitor(this.ruleName, context)

    visitor.visit(result.value)

    return visitor.offenses
  }
}
