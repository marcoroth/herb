import { BaseRuleVisitor } from "../utils/rule-utils.js"
import { Location } from "@herb-tools/core"

import { parseHerbDisableDirective } from "../herb-disable-comment-utils.js"

import type { HerbDirectiveNode } from "@herb-tools/core"
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

  visitHerbDirectiveNode(node: HerbDirectiveNode): void {
    const content = node.content?.value
    if (!content) return

    this.checkHerbDisableComment(node, content)
  }

  /**
   * Override this method to implement rule-specific logic.
   * This is called for every `<%# herb:... %>` directive node, of any key.
   */
  protected abstract checkHerbDisableComment(node: HerbDirectiveNode, content: string): void

  /**
   * Helper to create a precise location for a specific rule name within the
   * directive's argument list. Returns null if the arguments are not located.
   */
  protected createRuleNameLocation(node: HerbDirectiveNode, ruleDetail: HerbDisableRuleName): Location | null {
    const argumentsLocation = node.arguments?.location
    if (!argumentsLocation) return null

    const startLine = argumentsLocation.start.line
    const startColumn = argumentsLocation.start.column + ruleDetail.offset

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
  protected addOffenseWithFallback(message: string, preciseLocation: Location | null, node: HerbDirectiveNode): void {
    this.addOffense(message, preciseLocation || node.location)
  }
}

/**
 * Base visitor for rules that need to process parsed herb:disable comments.
 * Only calls the abstract method for a `herb:disable` directive whose argument
 * list parses.
 */
export abstract class HerbDisableCommentParsedVisitor extends HerbDisableCommentBaseVisitor {
  protected checkHerbDisableComment(node: HerbDirectiveNode, content: string): void {
    const herbDisable = parseHerbDisableDirective(node)
    if (!herbDisable) return

    this.checkParsedHerbDisable(node, content, herbDisable)
  }

  /**
   * Override this method to implement rule-specific logic for parsed herb:disable comments.
   */
  protected abstract checkParsedHerbDisable(node: HerbDirectiveNode, content: string, herbDisable: HerbDisableComment): void
}
