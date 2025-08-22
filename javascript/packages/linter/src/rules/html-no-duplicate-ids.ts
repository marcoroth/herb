import { AttributeVisitorMixin } from "./rule-utils"
import { ParserRule } from "../types"

import type { ParseResult, HTMLAttributeNode, HTMLOpenTagNode, HTMLSelfCloseTagNode } from "@herb-tools/core"
import type { LintOffense, LintContext } from "../types"

class NoDuplicateIdsVisitor extends AttributeVisitorMixin {
  private documentIds: Set<string> = new Set<string>()

  protected checkStaticAttributeStaticValue(attributeName: string, attributeValue: string, attributeNode: HTMLAttributeNode, _parentNode: HTMLOpenTagNode | HTMLSelfCloseTagNode): void {
    if (attributeName.toLowerCase() !== "id") return
    if (!attributeValue) return

    const id = attributeValue.trim()

    if (this.documentIds.has(id)) {
      this.addOffense(
        `Duplicate ID \`${id}\` found. IDs must be unique within a document.`,
        attributeNode.location,
        "error"
      )

      return
    }

    this.documentIds.add(id)
  }
}

export class HTMLNoDuplicateIdsRule extends ParserRule {
  name = "html-no-duplicate-ids"

  check(result: ParseResult, context?: Partial<LintContext>): LintOffense[] {
    const visitor = new NoDuplicateIdsVisitor(this.name, context)

    visitor.visit(result.value)

    return visitor.offenses
  }
}
