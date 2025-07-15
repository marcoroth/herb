import { AttributeVisitorMixin } from "./rule-utils"

import type { Node } from "@herb-tools/core"
import type { LintOffense, Rule } from "../types"

class NoDuplicateIdsVisitor extends AttributeVisitorMixin {
  private documentIds: Set<string> = new Set<string>()

  protected checkAttribute(attributeName: string, attributeValue: string | null, attributeNode: Node): void {
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

export class HTMLNoDuplicateIdsRule implements Rule {
  name = "html-no-duplicate-ids"

  check(node: Node): LintOffense[] {
    const visitor = new NoDuplicateIdsVisitor(this.name)

    visitor.visit(node)

    return visitor.offenses
  }
}
