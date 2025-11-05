import { ParserRule } from "../types.js"
import { AttributeVisitorMixin, StaticAttributeStaticValueParams, StaticAttributeDynamicValueParams } from "./rule-utils.js"
import { getValidatableStaticContent, hasERBOutput, filterLiteralNodes, filterERBContentNodes, isERBOutputNode } from "@herb-tools/core"

import type { UnboundLintOffense, LintContext, FullRuleConfig } from "../types.js"
import type { ParseResult, HTMLAttributeNode } from "@herb-tools/core"

class HTMLAriaLevelMustBeValidVisitor extends AttributeVisitorMixin {
  protected checkStaticAttributeStaticValue({ attributeName, attributeValue, attributeNode }: StaticAttributeStaticValueParams) {
    if (attributeName !== "aria-level") return

    this.validateAriaLevel(attributeValue, attributeNode)
  }

  protected checkStaticAttributeDynamicValue({ attributeName, valueNodes, attributeNode }: StaticAttributeDynamicValueParams) {
    if (attributeName !== "aria-level") return

    const validatableContent = getValidatableStaticContent(valueNodes)

    if (validatableContent !== null) {
      this.validateAriaLevel(validatableContent, attributeNode)
      return
    }

    if (!hasERBOutput(valueNodes)) return

    const literalNodes = filterLiteralNodes(valueNodes)
    const erbOutputNodes = filterERBContentNodes(valueNodes).filter(isERBOutputNode)

    if (literalNodes.length > 0 && erbOutputNodes.length > 0) {
      const staticPart = literalNodes.map(node => node.content).join("")

      // TODO: this can be cleaned up using @herb-tools/printer
      const erbPart = erbOutputNodes[0]
      const erbText = `${erbPart.tag_opening?.value || ""}${erbPart.content?.value || ""}${erbPart.tag_closing?.value || ""}`

      this.addOffense(
        `The \`aria-level\` attribute must be an integer between 1 and 6, got \`${staticPart}\` and the ERB expression \`${erbText}\`.`,
        attributeNode.location,
      )
    }
  }

  private validateAriaLevel(attributeValue: string, attributeNode: HTMLAttributeNode): void {
    if (!attributeValue || attributeValue === "") {
      this.addOffense(
        `The \`aria-level\` attribute must be an integer between 1 and 6, got an empty value.`,
        attributeNode.location,
      )

      return
    }

    const number = parseInt(attributeValue)

    if (isNaN(number) || number < 1 || number > 6 || attributeValue !== number.toString()) {
      this.addOffense(
        `The \`aria-level\` attribute must be an integer between 1 and 6, got \`${attributeValue}\`.`,
        attributeNode.location,
      )
    }
  }
}

export class HTMLAriaLevelMustBeValidRule extends ParserRule {
  name = "html-aria-level-must-be-valid"

  get defaultConfig(): FullRuleConfig {
    return {
      enabled: true,
      severity: "error"
    }
  }

  check(result: ParseResult, context?: Partial<LintContext>): UnboundLintOffense[] {
    const visitor = new HTMLAriaLevelMustBeValidVisitor(this.name, context)

    visitor.visit(result.value)

    return visitor.offenses
  }
}
