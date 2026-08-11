import { ParserRule } from "../types.js"
import { BaseRuleVisitor } from "./rule-utils.js"
import { getTagLocalName, getAttribute, getStaticAttributeValue, hasAttributeValue } from "@herb-tools/core"
import { z } from "zod"

import type { BaseAutofixContext, UnboundLintOffense, LintContext, FullRuleConfig } from "../types.js"
import type { HTMLAttributeNode, HTMLOpenTagNode, ParseResult } from "@herb-tools/core"

export interface HTMLAllowedScriptTypeOptions {
  allowedTypes: string[]
  allowBlank: boolean
}

class AllowedScriptTypeVisitor extends BaseRuleVisitor {
  private readonly options: HTMLAllowedScriptTypeOptions

  constructor(ruleName: string, context: Partial<LintContext> | undefined, options: HTMLAllowedScriptTypeOptions) {
    super(ruleName, context)

    this.options = options
  }

  visitHTMLOpenTagNode(node: HTMLOpenTagNode): void {
    if (getTagLocalName(node) === "script") {
      this.visitScriptNode(node)
    }
  }

  private visitScriptNode(node: HTMLOpenTagNode): void {
    const { allowBlank } = this.options
    const typeAttribute = getAttribute(node, "type")

    if (!typeAttribute) {
      if (!allowBlank) {
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
    const { allowedTypes, allowBlank } = this.options
    const typeValue = getStaticAttributeValue(typeAttribute)
    if (typeValue === null) return

    if (typeValue === "") {
      this.addOffense(
        "Avoid using an empty `type` attribute on the `<script>` tag. Either set a valid type or remove the attribute entirely.",
        typeAttribute.location
      )

      return
    }

    if (allowedTypes.includes(typeValue)) return

    this.addOffense(
      `Avoid using \`${typeValue}\` as the \`type\` attribute for the \`<script>\` tag. ` +
      `Must be one of: ${allowedTypes.map(t => `\`${t}\``).join(", ")}` +
      `${allowBlank ? " or blank" : ""}.`,
      typeAttribute.location
    )
  }
}

export class HTMLAllowedScriptTypeRule extends ParserRule<BaseAutofixContext, HTMLAllowedScriptTypeOptions> {
  static ruleName = "html-allowed-script-type"
  static introducedIn = this.version("0.9.0")

  get defaultConfig(): FullRuleConfig {
    return {
      enabled: true,
      severity: "error"
    }
  }

  get defaultOptions(): HTMLAllowedScriptTypeOptions {
    return {
      allowedTypes: ["text/javascript", "module", "importmap", "speculationrules", "application/ld+json"],
      allowBlank: true
    }
  }

  get optionsSchema(): z.ZodType<HTMLAllowedScriptTypeOptions> {
    return z.object({
      allowedTypes: z.array(z.string()),
      allowBlank: z.boolean()
    }).strict()
  }

  check(result: ParseResult, context?: Partial<LintContext>): UnboundLintOffense[] {
    const visitor = new AllowedScriptTypeVisitor(this.ruleName, context, this.options)

    visitor.visit(result.value)

    return visitor.offenses
  }
}
