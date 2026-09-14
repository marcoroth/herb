import { isERBCommentNode, isERBNode } from "@herb-tools/core"
import { Visitor } from "@herb-tools/core"

import type { ERBNode, Node, ParseResult } from "@herb-tools/core"

const HERB_LINTER_PREFIX = "herb:linter"
const HERB_LINTER_IGNORE_PREFIX = `${HERB_LINTER_PREFIX} ignore`

/**
 * Check if an ERB content node is a herb:linter ignore comment.
 *
 * @param node - The ERB content node to check
 * @returns true if this is a linter ignore directive
 */
export function isHerbLinterIgnoreComment(node: Node): boolean {
  if (!isERBNode(node)) return false
  if (!isERBCommentNode(node)) return false

  const content = node.content?.value || ""

  return content.trim() === HERB_LINTER_IGNORE_PREFIX
}

/**
 * Check if the document contains a herb:linter ignore directive anywhere.
 */
export function hasLinterIgnoreDirective(parseResult: ParseResult): boolean {
  if (parseResult.failed) return false

  const detector = new LinterIgnoreDetector()
  detector.visit(parseResult.value)
  return detector.hasIgnoreDirective
}

/**
 * Visitor that detects if the AST contains a herb:linter ignore directive.
 */
class LinterIgnoreDetector extends Visitor {
  public hasIgnoreDirective = false

  visitERBNode(node: ERBNode): void {
    if (isHerbLinterIgnoreComment(node)) {
      this.hasIgnoreDirective = true
    }
  }
}
