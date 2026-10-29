import { z } from "zod"

import { ParserRule } from "../types.js"
import { BaseRuleVisitor } from "../utils/rule-utils.js"
import { getTagLocalName, getAttribute, getStaticAttributeValue, hasAttributeValue } from "@herb-tools/core"

import type { UnboundLintOffense, LintContext, FullRuleConfig, BaseAutofixContext, RuleOptions } from "../types.js"
import type { HTMLAttributeNode, HTMLOpenTagNode, ParseResult } from "@herb-tools/core"

export interface HTMLAllowedScriptTypeOptions extends RuleOptions {
  allowedTypes: string[]
  allowBlank: boolean
}

class AllowedScriptTypeVisitor extends BaseRuleVisitor {
  private readonly options: HTMLAllowedScriptTypeOptions

  constructor(ruleName: string, options: HTMLAllowedScriptTypeOptions, context?: Partial<LintContext>) {
    super(ruleName, context)

    this.options = options
  }

  visitHTMLOpenTagNode(node: HTMLOpenTagNode): void {
    if (getTagLocalName(node) === "script") {
      this.visitScriptNode(node)
    }
  }

  private visitScriptNode(node: HTMLOpenTagNode): void {
    const typeAttribute = getAttribute(node, "type")

    if (!typeAttribute) {
      if (!this.options.allowBlank) {
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

    const { allowedTypes, allowBlank } = this.options

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
  static defaultEnabledIn = this.version("0.9.0")

  static optionsSchema = z.object({
    allowedTypes: z.array(z.string()),
    allowBlank: z.boolean(),
  }).strict()

  get defaultOptions(): HTMLAllowedScriptTypeOptions {
    return {
      allowedTypes: ["text/javascript", "module", "importmap", "speculationrules", "application/ld+json"],
      allowBlank: true,
    }
  }

  get defaultConfig(): FullRuleConfig {
    return {
      enabled: true,
      severity: "error"
    }
  }

  check(result: ParseResult, context?: Partial<LintContext>): UnboundLintOffense[] {
    const visitor = new AllowedScriptTypeVisitor(this.ruleName, this.options, context)

    visitor.visit(result.value)

    return visitor.offenses
  }
}
