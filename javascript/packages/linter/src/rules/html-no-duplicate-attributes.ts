import { ParserRule } from "../types.js"
import { AttributeVisitorMixin, StaticAttributeStaticValueParams, StaticAttributeDynamicValueParams } from "./rule-utils.js"

import type { UnboundLintOffense, LintContext, FullRuleConfig } from "../types.js"
import type { HTMLOpenTagNode, HTMLAttributeNode, ParseResult } from "@herb-tools/core"

class NoDuplicateAttributesVisitor extends AttributeVisitorMixin {
  private attributeNames = new Map<string, HTMLAttributeNode[]>()

  visitHTMLOpenTagNode(node: HTMLOpenTagNode): void {
    this.attributeNames.clear()
    super.visitHTMLOpenTagNode(node)
    this.reportDuplicates()
  }


  protected checkStaticAttributeStaticValue({ attributeName, attributeNode }: StaticAttributeStaticValueParams): void {
    this.trackAttributeName(attributeName, attributeNode)
  }

  protected checkStaticAttributeDynamicValue({ attributeName, attributeNode }: StaticAttributeDynamicValueParams): void {
    this.trackAttributeName(attributeName, attributeNode)
  }

  private trackAttributeName(attributeName: string, attributeNode: HTMLAttributeNode): void {
    if (!this.attributeNames.has(attributeName)) {
      this.attributeNames.set(attributeName, [])
    }

    this.attributeNames.get(attributeName)!.push(attributeNode)
  }

  private reportDuplicates(): void {
    for (const [attributeName, attributeNodes] of this.attributeNames) {
      if (attributeNodes.length > 1) {
        for (let i = 1; i < attributeNodes.length; i++) {
          const attributeNode = attributeNodes[i]

          this.addOffense(
            `Duplicate attribute \`${attributeName}\` found on tag. Remove the duplicate occurrence.`,
            attributeNode.name!.location,
          )
        }
      }
    }
  }
}

export class HTMLNoDuplicateAttributesRule extends ParserRule {
  name = "html-no-duplicate-attributes"

  get defaultConfig(): FullRuleConfig {
    return {
      enabled: true,
      severity: "error"
    }
  }

  check(result: ParseResult, context?: Partial<LintContext>): UnboundLintOffense[] {
    const visitor = new NoDuplicateAttributesVisitor(this.name, context)

    visitor.visit(result.value)

    return visitor.offenses
  }
}
