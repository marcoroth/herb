import { ParserRule } from "../types.js"
import { AttributeVisitorMixin, StaticAttributeStaticValueParams } from "./rule-utils.js"

import type { UnboundLintOffense, LintContext, FullRuleConfig } from "../types.js"
import type { ParseResult } from "@herb-tools/core"

class NoPositiveTabIndexVisitor extends AttributeVisitorMixin {
  protected checkStaticAttributeStaticValue({ attributeName, attributeValue, attributeNode }: StaticAttributeStaticValueParams): void {
    if (attributeName !== "tabindex") return

    const tabIndexValue = parseInt(attributeValue, 10)

    if (!isNaN(tabIndexValue) && tabIndexValue > 0) {
      this.addOffense(
        `Do not use positive \`tabindex\` values as they are error prone and can severely disrupt navigation experience for keyboard users. Use \`tabindex="0"\` to make an element focusable or \`tabindex="-1"\` to remove it from the tab sequence.`,
        attributeNode.location,
      )
    }
  }
}

export class HTMLNoPositiveTabIndexRule extends ParserRule {
  name = "html-no-positive-tab-index"

  get defaultConfig(): FullRuleConfig {
    return {
      enabled: true,
      severity: "error"
    }
  }

  check(result: ParseResult, context?: Partial<LintContext>): UnboundLintOffense[] {
    const visitor = new NoPositiveTabIndexVisitor(this.name, context)

    visitor.visit(result.value)

    return visitor.offenses
  }
}
