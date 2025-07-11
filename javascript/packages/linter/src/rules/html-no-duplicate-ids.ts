import { Node } from "@herb-tools/core";
import { AttributeVisitorMixin } from "./rule-utils";
import { LintOffense, Rule } from "../types";

class NoDuplicateIdsVisitor extends AttributeVisitorMixin {
  protected checkAttribute(attributeName: string, attributeValue: string | null, attributeNode: Node): void {
    if (attributeName.toLowerCase() !== "id") return; // Only check 'id' attributes

    if (!attributeValue) return; // Skip empty IDs

    const id = attributeValue.trim();

    // Check for duplicates in the current document
    const existingIds = this.getDocumentIds();
    if (existingIds.has(id)) {
      this.addOffense(
        `Duplicate ID \`${id}\` found. IDs must be unique within a document.`,
        attributeNode.location,
        "error"
      );
    } else {
      existingIds.add(id); // Add to the set of seen IDs
    }
  }

  private getDocumentIds(): Set<string> {
    return this.documentIds || (this.documentIds = new Set<string>());
  }

  private documentIds: Set<string> | null = null;

}

export class HTMLNoDuplicateIdsRule implements Rule {
  name = "html-no-duplicated-id";

  check(node: Node): LintOffense[] {
    const visitor = new NoDuplicateIdsVisitor(this.name);
    visitor.visit(node);
    return visitor.offenses;
  }
}
