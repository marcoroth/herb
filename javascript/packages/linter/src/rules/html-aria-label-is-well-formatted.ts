import { ParserRule } from "../types.js"
import { AttributeVisitorMixin, StaticAttributeStaticValueParams } from "./rule-utils.js"

import type { LintOffense, LintContext } from "../types.js"
import type { ParseResult } from "@herb-tools/core"

class AriaLabelIsWellFormattedVisitor extends AttributeVisitorMixin {
  protected checkStaticAttributeStaticValue({ attributeName, attributeValue, attributeNode }: StaticAttributeStaticValueParams): void {
    if (attributeName !== "aria-label") return

    if (attributeValue.match(/[\r\n]+/) || attributeValue.match(/&#10;|&#13;|&#x0A;|&#x0D;/i)) {
      this.addOffense(
        "The `aria-label` attribute value text should not contain line breaks. Use concise, single-line descriptions.",
        attributeNode.location,
        "error"
      )

      return
    }

    if (this.looksLikeId(attributeValue)) {
      this.addOffense(
        "The `aria-label` attribute value should not be formatted like an ID. Use natural, sentence-case text instead.",
        attributeNode.location,
        "error"
      )

      return
    }

    if (attributeValue.match(/^[a-z]/)) {
      this.addOffense(
        "The `aria-label` attribute value text should be formatted like visual text. Use sentence case (capitalize the first letter).",
        attributeNode.location,
        "error"
      )
    }
  }

  private looksLikeId(text: string): boolean {
    return (
      text.includes('_') ||
      text.includes('-') ||
      /^[a-z]+([A-Z][a-z]*)*$/.test(text)
    ) && !text.includes(' ')
  }
}

export class HTMLAriaLabelIsWellFormattedRule extends ParserRule {
  name = "html-aria-label-is-well-formatted"

  check(result: ParseResult, context?: Partial<LintContext>): LintOffense[] {
    const visitor = new AriaLabelIsWellFormattedVisitor(this.name, context)

    visitor.visit(result.value)

    return visitor.offenses
  }
}
