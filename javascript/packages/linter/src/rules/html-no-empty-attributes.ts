import { ParserRule } from "../types.js"
import { AttributeVisitorMixin, StaticAttributeStaticValueParams, DynamicAttributeStaticValueParams } from "./rule-utils.js"
import { IdentityPrinter } from "@herb-tools/printer"

import type { LintOffense, LintContext } from "../types.js"
import type { ParseResult, HTMLAttributeNode } from "@herb-tools/core"

// Attributes that must not have empty values
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

// Check if attribute name matches any restricted patterns
function isRestrictedAttribute(attributeName: string): boolean {
  // Check direct matches
  if (RESTRICTED_ATTRIBUTES.has(attributeName)) {
    return true
  }

  // Check for data-* attributes
  if (attributeName.startsWith('data-')) {
    return true
  }

  // Check for aria-* attributes
  if (attributeName.startsWith('aria-')) {
    return true
  }

  return false
}

function isDataAttribute(attributeName: string): boolean {
  return attributeName.startsWith('data-')
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

    const hasExplicitValue = attributeNode.value !== null

    if (isDataAttribute(attributeName)) {
      if (hasExplicitValue) {
        this.addOffense(
          `Data attribute \`${attributeName}\` should not have an empty value. Either provide a meaningful value or use \`${attributeName}\` instead of \`${IdentityPrinter.print(attributeNode)}\`.`,
          attributeNode.location,
          "warning"
        )
      }

      return
    }

    this.addOffense(
      `Attribute \`${attributeName}\` must not be empty. Either provide a meaningful value or remove the attribute entirely.`,
      attributeNode.location,
      "warning"
    )
  }
}

export class HTMLNoEmptyAttributesRule extends ParserRule {
  name = "html-no-empty-attributes"

  check(result: ParseResult, context?: Partial<LintContext>): LintOffense[] {
    const visitor = new NoEmptyAttributesVisitor(this.name, context)

    visitor.visit(result.value)

    return visitor.offenses
  }
}
