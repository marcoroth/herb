import { ParserRule } from "../types.js"
import { AttributeVisitorMixin, StaticAttributeStaticValueParams, DynamicAttributeStaticValueParams } from "./rule-utils.js"

import type { LintOffense, LintContext } from "../types.js"
import type { ParseResult } from "@herb-tools/core"

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

class NoEmptyAttributesVisitor extends AttributeVisitorMixin {
  protected checkStaticAttributeStaticValue({ attributeName, attributeValue, attributeNode }: StaticAttributeStaticValueParams): void {
    if (!isRestrictedAttribute(attributeName)) return
    if (attributeValue.trim() !== "") return

    this.addOffense(
      `Attribute \`${attributeName}\` must not be empty. Either provide a meaningful value or remove the attribute entirely.`,
      attributeNode.name!.location,
      "warning"
    )
  }

  protected checkDynamicAttributeStaticValue({ combinedName, attributeValue, attributeNode }: DynamicAttributeStaticValueParams): void {
    const name = (combinedName || "").toLowerCase()
    if (!isRestrictedAttribute(name)) return
    if (attributeValue.trim() !== "") return

    this.addOffense(
      `Attribute \`${combinedName}\` must not be empty. Either provide a meaningful value or remove the attribute entirely.`,
      attributeNode.name!.location,
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
