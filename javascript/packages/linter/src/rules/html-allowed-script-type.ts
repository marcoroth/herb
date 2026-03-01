import { ParserRule } from "../types.js"
import { BaseRuleVisitor, getAttribute, getStaticAttributeValue, hasAttributeValue } from "./rule-utils.js"
import { getTagName } from "@herb-tools/core"

import type { UnboundLintOffense, LintContext, FullRuleConfig } from "../types.js"
import type { HTMLAttributeNode, HTMLOpenTagNode, ParseResult } from "@herb-tools/core"

const ALLOWED_TYPES = ["text/javascript"]
// NOTE: Rules are not configurable for now, keep some sane defaults
//   See https://github.com/marcoroth/herb/issues/1204
const ALLOW_BLANK = true

class AllowedScriptTypeVisitor extends BaseRuleVisitor {
  visitHTMLOpenTagNode(node: HTMLOpenTagNode): void {
    if (getTagName(node) === "script") {
      this.visitScriptNode(node)
    }
  }

  private visitScriptNode(node: HTMLOpenTagNode): void {
    const typeAttribute = getAttribute(node, "type")

    if (!typeAttribute) {
      if (!ALLOW_BLANK) {
        this.addOffense("`type` attribute required for `<script>` tag.", node.location)
      }

      return
    }

    if (!hasAttributeValue(typeAttribute)) {
      this.addOffense(
        "Avoid using an empty `type` attribute on the `<script>` tag. Either set a valid type or remove the attribute entirely.",
        typeAttribute.location
      )

      return
    }

    this.validateTypeAttribute(typeAttribute)
  }

  private validateTypeAttribute(typeAttribute: HTMLAttributeNode): void {
    const typeValue = getStaticAttributeValue(typeAttribute)
    if (typeValue === null) return

    if (typeValue === "") {
      this.addOffense(
        "Avoid using an empty `type` attribute on the `<script>` tag. Either set a valid type or remove the attribute entirely.",
        typeAttribute.location
      )

      return
    }

    if (ALLOWED_TYPES.includes(typeValue)) return

    this.addOffense(
      `Avoid using \`${typeValue}\` as the \`type\` attribute for the \`<script>\` tag. ` +
      `Must be one of: ${ALLOWED_TYPES.map(t => `\`${t}\``).join(", ")}` +
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
