import { ERBNode, HTMLAttributeNode, Node } from "@herb-tools/core";
import { AttributeVisitorMixin } from "./rule-utils";
import { LintOffense, Rule } from "../types";

function attributeValueContainsERB(attributeNode: HTMLAttributeNode): boolean {
  return (
    attributeNode.value?.type === "AST_HTML_ATTRIBUTE_VALUE_NODE" &&
    attributeNode.value.children?.some((child: Node) =>
      child.type === "AST_ERB_CONTENT_NODE"
    )
  );
}

function extractERBContents(attributeNode: HTMLAttributeNode): string[] {
  if (attributeNode.value?.type !== "AST_HTML_ATTRIBUTE_VALUE_NODE") return [];

  return attributeNode.value.children
    .filter((child) => child.type === "AST_ERB_CONTENT_NODE")
    .map((child) => (child as ERBNode)?.content?.value.trim());
}

class NoDuplicateIdsVisitor extends AttributeVisitorMixin {
  protected checkAttribute(attributeName: string, attributeValue: string | null, attributeNode: HTMLAttributeNode): void {
    if (attributeName.toLowerCase() !== "id") return; // Only check 'id' attributes

    let id;

    if (attributeValueContainsERB(attributeNode)) {
      id = `<%= ${extractERBContents(attributeNode).join(", ")} %>`;
    } else {
      id = attributeValue ? attributeValue.trim() : null;
    }

    if(!id) return; // Skip empty IDs

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
