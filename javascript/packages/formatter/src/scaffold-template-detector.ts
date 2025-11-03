import { Visitor } from "@herb-tools/core"
import type { ERBContentNode, ParseResult } from "@herb-tools/core"

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

  visitERBContentNode(node: ERBContentNode): void {
    const opening = node.tag_opening?.value

    if (opening && opening.startsWith("<%%")) {
      this.hasEscapedERB = true

      return
    }

    if (this.hasEscapedERB) return

    this.visitChildNodes(node)
  }
}
