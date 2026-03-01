import { ParserRule } from "../types.js"
import { AttributeVisitorMixin, StaticAttributeStaticValueParams, DynamicAttributeStaticValueParams } from "./rule-utils.js"
import { IdentityPrinter } from "@herb-tools/printer"
import { Visitor, isERBOutputNode } from "@herb-tools/core"

import type { UnboundLintOffense, LintContext, FullRuleConfig } from "../types.js"
import type { ParseResult, HTMLAttributeNode, ERBContentNode, LiteralNode, Node } from "@herb-tools/core"

const RESTRICTED_ATTRIBUTES = new Set([
  'id',
  'class',
  'name',
  'for',
  'src',
  'href',
  'title',
  'data',
  'role'
])

function isRestrictedAttribute(attributeName: string): boolean {
  if (RESTRICTED_ATTRIBUTES.has(attributeName)) {
    return true
  }

  if (attributeName.startsWith('data-')) {
    return true
  }

  if (attributeName.startsWith('aria-')) {
    return true
  }

  return false
}

function isDataAttribute(attributeName: string): boolean {
  return attributeName.startsWith('data-')
}

/**
 * Visitor that checks if a node tree contains any output content.
 * Output content includes:
 * - Non-whitespace literal text (LiteralNode)
 * - ERB output tags (<%= %>, <%== %>)
 */
class ContainsOutputContentVisitor extends Visitor {
  public hasOutputContent: boolean = false

  visitLiteralNode(node: LiteralNode): void {
    if (this.hasOutputContent) return

    if (node.content && node.content.trim() !== "") {
      this.hasOutputContent = true

      return
    }

    this.visitChildNodes(node)
  }

  visitERBContentNode(node: ERBContentNode): void {
    if (this.hasOutputContent) return

    if (isERBOutputNode(node)) {
      this.hasOutputContent = true

      return
    }

    this.visitChildNodes(node)
  }
}


function containsOutputContent(node: Node): boolean {
  const visitor = new ContainsOutputContentVisitor()

  visitor.visit(node)

  return visitor.hasOutputContent
}


class NoEmptyAttributesVisitor extends AttributeVisitorMixin {
  protected checkStaticAttributeStaticValue({ attributeName, attributeValue, attributeNode }: StaticAttributeStaticValueParams): void {
    this.checkEmptyAttribute(attributeName, attributeValue, attributeNode)
  }

  protected checkDynamicAttributeStaticValue({ combinedName, attributeValue, attributeNode }: DynamicAttributeStaticValueParams): void {
    const name = (combinedName || "").toLowerCase()
    this.checkEmptyAttribute(name, attributeValue, attributeNode)
  }

  private checkEmptyAttribute(attributeName: string, attributeValue: string, attributeNode: HTMLAttributeNode): void {
    if (!isRestrictedAttribute(attributeName)) return
    if (attributeValue.trim() !== "") return

    if (!attributeNode?.value) return
    if (containsOutputContent(attributeNode.value)) return

    const hasExplicitValue = attributeNode.value !== null

    if (isDataAttribute(attributeName)) {
      if (hasExplicitValue) {
        this.addOffense(
          `Data attribute \`${attributeName}\` should not have an empty value. Either provide a meaningful value or use \`${attributeName}\` instead of \`${IdentityPrinter.print(attributeNode)}\`.`,
          attributeNode.location,
        )
      }

      return
    }

    this.addOffense(
      `Attribute \`${attributeName}\` must not be empty. Either provide a meaningful value or remove the attribute entirely.`,
      attributeNode.location,
    )
  }
}

export class HTMLNoEmptyAttributesRule extends ParserRule {
  name = "html-no-empty-attributes"

  get defaultConfig(): FullRuleConfig {
    return {
      enabled: true,
      severity: "warning"
    }
  }

  check(result: ParseResult, context?: Partial<LintContext>): UnboundLintOffense[] {
    const visitor = new NoEmptyAttributesVisitor(this.name, context)

    visitor.visit(result.value)

    return visitor.offenses
  }
}
