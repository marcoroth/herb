import { ParserRule } from "../types.js"
import { BaseRuleVisitor, getAttribute, getStaticAttributeValue, hasAttributeValue } from "./rule-utils.js"
import { getTagName } from "@herb-tools/core"

import type { UnboundLintOffense, LintContext, FullRuleConfig } from "../types.js"
import type { HTMLAttributeNode, HTMLOpenTagNode, ParseResult } from "@herb-tools/core"

const ALLOWED_TYPES = ["text/javascript"]
const ALLOW_BLANK = false

class AllowedScriptTypeVisitor extends BaseRuleVisitor {
  visitHTMLOpenTagNode(node: HTMLOpenTagNode): void {
    if (getTagName(node) === "script") {
      this.visitScriptNode(node)
    }
  }

  private visitScriptNode(node: HTMLOpenTagNode): void {
    const typeAttribute = getAttribute(node, "type")
    const isTypePresent = typeAttribute && hasAttributeValue(typeAttribute)

    if (isTypePresent) {
      this.validateTypeAttribute(typeAttribute)
    } else if (!ALLOW_BLANK) {
      this.addOffense(
        "`type` attribute required for `<script>` tag.",
        node.location
      )
    }
  }

  private validateTypeAttribute(typeAttribute: HTMLAttributeNode): void {
    const typeValue = getStaticAttributeValue(typeAttribute)
    if (!typeValue) return
    if (ALLOWED_TYPES.includes(typeValue)) return

    this.addOffense(
      `Avoid using "${typeValue}" as type for \`<script>\` tag. ` +
      `Must be one of: ${ALLOWED_TYPES.join(", ")}` +
      `${ALLOW_BLANK ? " or blank" : ""}.`,
      typeAttribute.location
    )
  }
}

export class HTMLAllowedScriptTypeRule extends ParserRule {
  name = "html-allowed-script-type"

  get defaultConfig(): FullRuleConfig {
    return {
      enabled: true,
      severity: "error"
    }
  }

  check(result: ParseResult, context?: Partial<LintContext>): UnboundLintOffense[] {
    const visitor = new AllowedScriptTypeVisitor(this.name, context)

    visitor.visit(result.value)

    return visitor.offenses
  }
}
