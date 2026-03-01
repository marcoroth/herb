import { BaseRuleVisitor } from "./rule-utils.js"
import { ERBContentNode, Location } from "@herb-tools/core"

import { parseHerbDisableContent } from "../herb-disable-comment-utils.js"

import type { LintContext } from "../types.js"
import type { HerbDisableComment, HerbDisableRuleName } from "../herb-disable-comment-utils.js"

/**
 * Base visitor class for herb:disable comment validation rules.
 * Handles common patterns like checking ERB comments and parsing herb:disable content.
 */
export abstract class HerbDisableCommentBaseVisitor extends BaseRuleVisitor {
  constructor(ruleName: string, context?: Partial<LintContext>) {
    super(ruleName, context)
  }

  visitERBContentNode(node: ERBContentNode): void {
    if (node.tag_opening?.value !== "<%#") return

    const content = node.content?.value
    if (!content) return

    this.checkHerbDisableComment(node, content)
  }

  /**
   * Override this method to implement rule-specific logic.
   * This is called for every ERB comment node.
   */
  protected abstract checkHerbDisableComment(node: ERBContentNode, content: string): void

  /**
   * Helper to create a precise location for a specific rule name within the comment.
   * Returns null if content location is not available.
   */
  protected createRuleNameLocation(node: ERBContentNode, ruleDetail: HerbDisableRuleName): Location | null {
    const contentLocation = node.content?.location
    if (!contentLocation) return null

    const startLine = contentLocation.start.line
    const startColumn = contentLocation.start.column + ruleDetail.offset

    return Location.from(
      startLine,
      startColumn,
      startLine,
      startColumn + ruleDetail.length
    )
  }

  /**
   * Helper to add an offense with a fallback to node location if precise location unavailable.
   */
  protected addOffenseWithFallback(message: string, preciseLocation: Location | null, node: ERBContentNode): void {
    this.addOffense(message, preciseLocation || node.location)
  }
}

/**
 * Base visitor for rules that need to process parsed herb:disable comments.
 * Only calls the abstract method if the content successfully parses as a herb:disable comment.
 */
export abstract class HerbDisableCommentParsedVisitor extends HerbDisableCommentBaseVisitor {
  protected checkHerbDisableComment(node: ERBContentNode, content: string): void {
    const herbDisable = parseHerbDisableContent(content)
    if (!herbDisable) return

    this.checkParsedHerbDisable(node, content, herbDisable)
  }

  /**
   * Override this method to implement rule-specific logic for parsed herb:disable comments.
   */
  protected abstract checkParsedHerbDisable(node: ERBContentNode, content: string, herbDisable: HerbDisableComment): void
}
