import { ParserRule } from "../types.js"
import {
  AttributeVisitorMixin,
  StaticAttributeStaticValueParams,
  StaticAttributeDynamicValueParams,
  DynamicAttributeStaticValueParams,
  DynamicAttributeDynamicValueParams
} from "./rule-utils.js"
import { getStaticContentFromNodes } from "@herb-tools/core"
import { IdentityPrinter } from "@herb-tools/printer"
import type { LintContext, LintOffense } from "../types.js"
import type { ParseResult, HTMLAttributeNode } from "@herb-tools/core"

class HTMLNoUnderscoresInAttributeNamesVisitor extends AttributeVisitorMixin {
  protected checkStaticAttributeStaticValue({ attributeName, attributeNode }: StaticAttributeStaticValueParams): void {
    this.check(attributeName, attributeNode)
  }

  protected checkStaticAttributeDynamicValue({ attributeName, attributeNode }: StaticAttributeDynamicValueParams): void {
    this.check(attributeName, attributeNode)
  }

  protected checkDynamicAttributeStaticValue({ nameNodes, attributeNode }: DynamicAttributeStaticValueParams) {
    const attributeName = getStaticContentFromNodes(nameNodes)

    this.check(attributeName, attributeNode)
  }

  protected checkDynamicAttributeDynamicValue({ nameNodes, attributeNode }: DynamicAttributeDynamicValueParams) {
    const attributeName = getStaticContentFromNodes(nameNodes)

    this.check(attributeName, attributeNode)
  }

  private check(attributeName: string | null, attributeNode: HTMLAttributeNode): void {
    if (!attributeName) return

    if (attributeName.includes("_")) {
      this.addOffense(
        `Attribute \`${IdentityPrinter.print(attributeNode.name)}\` should not contain underscores. Use hyphens (-) instead.`,
        attributeNode.value!.location,
        "warning"
      )
    }
  }
}

export class HTMLNoUnderscoresInAttributeNamesRule extends ParserRule {
  name = "html-no-underscores-in-attribute-names"

  check(result: ParseResult, context?: Partial<LintContext>): LintOffense[] {
    const visitor = new HTMLNoUnderscoresInAttributeNamesVisitor(this.name, context)

    visitor.visit(result.value)

    return visitor.offenses
  }
}
