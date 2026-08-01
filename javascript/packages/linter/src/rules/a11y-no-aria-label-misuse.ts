import { ParserRule } from "../types.js"
import { BaseRuleVisitor } from "./rule-utils.js"

import { getTagLocalName, getStaticAttributeValue, hasAttribute, getAttribute } from "@herb-tools/core"

import type { ParseResult, ParserOptions, HTMLElementNode } from "@herb-tools/core"
import type { UnboundLintOffense, LintContext, FullRuleConfig } from "../types.js"

const GENERIC_ELEMENTS = ["span", "div"]
const NAME_RESTRICTED_ELEMENTS = ["h1", "h2", "h3", "h4", "h5", "h6", "strong", "em", "i", "p", "b", "code"]
const LABEL_ATTRIBUTES = ["aria-label", "aria-labelledby"] as const

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

class NoAriaLabelMisuseVisitor extends BaseRuleVisitor {
  visitHTMLElementNode(node: HTMLElementNode): void {
    this.checkElement(node)
    super.visitHTMLElementNode(node)
  }

  private checkElement(node: HTMLElementNode): void {
    const tagName = getTagLocalName(node)
    if (!tagName) return

    for (const attributeName of LABEL_ATTRIBUTES) {
      const attribute = getAttribute(node, attributeName)
      if (!attribute) continue

      if (NAME_RESTRICTED_ELEMENTS.includes(tagName)) {
        this.addOffense(
          `The \`${attributeName}\` attribute must not be used on the \`<${tagName}>\` element. Assistive technologies do not reliably support naming on this element. Use visible text content instead, or wrap the content in an element that supports naming.`,
          attribute.location,
        )

        continue
      }

      if (!GENERIC_ELEMENTS.includes(tagName)) continue

      if (!hasAttribute(node, "role")) {
        this.addOffense(
          `The \`${attributeName}\` attribute on \`<${tagName}>\` requires a permitted ARIA \`role\`. Add a valid \`role\` attribute (e.g. \`role="region"\`, \`role="group"\`, or \`role="img"\`), or use an interactive element like \`<button>\` or \`<a>\` instead.`,
          attribute.location,
        )

        continue
      }

      const role = getStaticAttributeValue(node, "role")
      if (role === null) continue

      if (ROLES_WHICH_CANNOT_BE_NAMED.includes(role)) {
        this.addOffense(
          `The \`${attributeName}\` attribute on \`<${tagName}>\` is not allowed with ARIA role \`${role}\` because that role cannot be named. Change the \`role\` to one that supports naming, or remove the \`${attributeName}\` attribute.`,
          attribute.location,
        )
      }
    }
  }
}

export class A11yNoAriaLabelMisuseRule extends ParserRule {
  static ruleName = "a11y-no-aria-label-misuse"
  static introducedIn = this.version("0.10.2")

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
