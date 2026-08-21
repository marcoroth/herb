import { BaseRuleVisitor } from "../utils/rule-utils.js"
import { ERBContentNode, Location } from "@herb-tools/core"

import { parseHerbCounterContent } from "../herb-counter-comment-utils.js"

import type { LintContext } from "../types.js"
import type { HerbCounterComment } from "../herb-counter-comment-utils.js"

/**
 * Base visitor for herb:counter comment meta-rules. Mirrors the shape of
 * `HerbDisableCommentBaseVisitor` so the two families read the same way.
 */
export abstract class HerbCounterCommentBaseVisitor extends BaseRuleVisitor {
  constructor(ruleName: string, context?: Partial<LintContext>) {
    super(ruleName, context)
  }

  visitERBContentNode(node: ERBContentNode): void {
    if (node.tag_opening?.value !== "<%#") return

    const content = node.content?.value
    if (!content) return

    this.checkHerbCounterComment(node, content)
  }

  protected abstract checkHerbCounterComment(node: ERBContentNode, content: string): void

  /** Precise location for a subspan of the comment content. */
  protected createSpanLocation(node: ERBContentNode, offset: number, length: number): Location | null {
    const contentLocation = node.content?.location
    if (!contentLocation) return null

    const startLine = contentLocation.start.line
    const startColumn = contentLocation.start.column + offset

    return Location.from(
      startLine,
      startColumn,
      startLine,
      startColumn + length,
    )
  }

  protected addOffenseWithFallback(message: string, preciseLocation: Location | null, node: ERBContentNode): void {
    this.addOffense(message, preciseLocation || node.location)
  }
}

/**
 * Base visitor for rules that need to process successfully-parsed
 * herb:counter comments. Only calls `checkParsedHerbCounter` when the
 * content parses cleanly.
 */
export abstract class HerbCounterCommentParsedVisitor extends HerbCounterCommentBaseVisitor {
  protected checkHerbCounterComment(node: ERBContentNode, content: string): void {
    const parsed = parseHerbCounterContent(content)
    if (!parsed) return

    this.checkParsedHerbCounter(node, content, parsed)
  }

  protected abstract checkParsedHerbCounter(node: ERBContentNode, content: string, herbCounter: HerbCounterComment): void
}
