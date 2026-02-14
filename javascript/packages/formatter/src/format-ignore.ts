import { isERBCommentNode } from "@herb-tools/core"
import { Visitor } from "@herb-tools/core"

import type { Node, ERBContentNode } from "@herb-tools/core"

const HERB_FORMATTER_PREFIX = "herb:formatter"
const HERB_FORMATTER_IGNORE_PREFIX = `${HERB_FORMATTER_PREFIX} ignore`

/**
 * Check if an ERB content node is a herb:formatter ignore comment
 */
export function isHerbFormatterIgnoreComment(node: Node): boolean {
  if (!isERBCommentNode(node)) return false

  const content = node?.content?.value || ""

  return content.trim() === HERB_FORMATTER_IGNORE_PREFIX
}

/**
 * Check if the document contains a herb:formatter ignore directive anywhere.
 */
export function hasFormatterIgnoreDirective(node: Node): boolean {
  const detector = new FormatterIgnoreDetector()
  detector.visit(node)
  return detector.hasIgnoreDirective
}

/**
* Visitor that detects if the AST contains a herb:formatter ignore directive.
*/
class FormatterIgnoreDetector extends Visitor {
  public hasIgnoreDirective = false

  visitERBContentNode(node: ERBContentNode): void {
    if (isHerbFormatterIgnoreComment(node)) {
      this.hasIgnoreDirective = true
      return
    }

    if (this.hasIgnoreDirective) return

    this.visitChildNodes(node)
  }
}
