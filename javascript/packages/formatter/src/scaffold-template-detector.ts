import { Visitor, isERBEscapedNode } from "@herb-tools/core"
import type { ERBNode, ParseResult } from "@herb-tools/core"

export const isScaffoldTemplate = (result: ParseResult): boolean => {
  const detector = new ScaffoldTemplateDetector()

  detector.visit(result.value)

  return detector.hasEscapedERB
}

/**
 * Visitor that detects if the AST represents a Rails scaffold template.
 * Scaffold templates contain escaped ERB tags (<%%= or <%%)
 * and should not be formatted to preserve their exact structure.
 */
export class ScaffoldTemplateDetector extends Visitor {
  public hasEscapedERB = false

  visitERBNode(node: ERBNode): void {
    if (isERBEscapedNode(node)) {
      this.hasEscapedERB = true
    }
  }
}
