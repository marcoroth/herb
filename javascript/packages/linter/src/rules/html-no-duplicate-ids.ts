import { AttributeVisitorMixin } from "./utils/rule-utils.js"
import { ParserRule } from "../types.js"
import type { Node } from "@herb-tools/core"
import type { LintOffense, LintContext } from "../types.js"

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

export class HTMLNoDuplicateIdsRule extends ParserRule {
  name = "html-no-duplicate-ids"

  check(node: Node, context?: Partial<LintContext>): LintOffense[] {
    const visitor = new NoDuplicateIdsVisitor(this.name, context)

    visitor.visit(node)

    return visitor.offenses
  }
}
